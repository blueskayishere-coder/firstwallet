import axios from 'axios';
import crypto from 'crypto';
import { query } from '../database/connection';
import { getChainService } from './chains';
import { walletService } from './wallet';
import { config } from '../config';
import { ChainType, CoinType, Withdrawal, WithdrawRequest, WithdrawResponse } from '../types';
import logger from '../utils/logger';

// 获取币种的合约地址
function getTokenContract(coin: CoinType): string | null {
  const contracts: Record<string, string> = {
    USDT_ERC20: config.usdtContracts.ETH,
    USDT_BEP20: config.usdtContracts.BSC,
    USDT_TRC20: config.usdtContracts.TRX,
  };
  return contracts[coin] || null;
}

// 获取币种对应的链
function getCoinChain(coin: CoinType): ChainType {
  const mapping: Record<CoinType, ChainType> = {
    BTC: 'BTC',
    ETH: 'ETH',
    BSC: 'BSC',
    TRX: 'TRX',
    USDT_ERC20: 'ETH',
    USDT_BEP20: 'BSC',
    USDT_TRC20: 'TRX',
  };
  return mapping[coin];
}

export class WithdrawalService {
  private isProcessing = false;
  private processIntervalId: NodeJS.Timeout | null = null;

  // 启动提现处理
  start(): void {
    if (this.processIntervalId) {
      logger.warn('Withdrawal service is already running');
      return;
    }

    logger.info('Starting withdrawal processing service');

    // 定时处理待处理的提现
    this.processIntervalId = setInterval(() => {
      this.processPendingWithdrawals();
    }, 10000); // 每10秒检查一次
  }

  // 停止提现处理
  stop(): void {
    if (this.processIntervalId) {
      clearInterval(this.processIntervalId);
      this.processIntervalId = null;
    }
    logger.info('Withdrawal processing service stopped');
  }

  // 创建提现请求
  async createWithdrawal(request: WithdrawRequest): Promise<WithdrawResponse> {
    const { user_id, chain, coin, to_address, amount } = request;

    // 获取用户地址
    const userAddress = await walletService.getUserAddress(user_id, chain);
    if (!userAddress) {
      throw new Error(`User ${user_id} has no address on ${chain}`);
    }

    // 检查余额
    const balance = await walletService.getBalance(userAddress.address, coin);
    if (parseFloat(balance.balance) < parseFloat(amount)) {
      throw new Error('Insufficient balance');
    }

    // 创建提现记录
    const result = await query<{ insertId: number }>(
      `INSERT INTO withdrawals (user_id, chain, coin, from_address, to_address, amount, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [user_id, chain, coin, userAddress.address, to_address, amount]
    );

    const withdrawalId = (result as unknown as { insertId: number }).insertId;

    logger.info(`Withdrawal request created: ${withdrawalId} (${amount} ${coin} to ${to_address})`);

    return {
      withdrawal_id: withdrawalId,
      status: 'pending',
    };
  }

  // 处理待处理的提现
  private async processPendingWithdrawals(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const pendingWithdrawals = await query<Withdrawal[]>(
        "SELECT * FROM withdrawals WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10"
      );

      for (const withdrawal of pendingWithdrawals) {
        try {
          await this.processWithdrawal(withdrawal);
        } catch (error) {
          logger.error(`Error processing withdrawal ${withdrawal.id}:`, error);
          await this.failWithdrawal(withdrawal.id, (error as Error).message);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    // 更新处理中的提现状态
    await this.updateProcessingWithdrawals();
  }

  // 处理单个提现
  private async processWithdrawal(withdrawal: Withdrawal): Promise<void> {
    // 更新状态为处理中
    await query(
      "UPDATE withdrawals SET status = 'processing', updated_at = NOW() WHERE id = ?",
      [withdrawal.id]
    );

    // 获取派生路径
    const derivationPath = await walletService.getDerivationPath(withdrawal.from_address);
    if (!derivationPath) {
      throw new Error('Derivation path not found');
    }

    // 执行转账
    const chain = getCoinChain(withdrawal.coin as CoinType);
    const chainService = getChainService(chain);
    const contract = getTokenContract(withdrawal.coin as CoinType);

    let txHash: string;

    if (contract && chainService.sendTokenTransaction) {
      txHash = await chainService.sendTokenTransaction(
        derivationPath,
        withdrawal.to_address,
        withdrawal.amount,
        contract
      );
    } else {
      txHash = await chainService.sendTransaction(
        derivationPath,
        withdrawal.to_address,
        withdrawal.amount
      );
    }

    // 更新交易哈希
    await query(
      'UPDATE withdrawals SET tx_hash = ?, updated_at = NOW() WHERE id = ?',
      [txHash, withdrawal.id]
    );

    logger.info(`Withdrawal ${withdrawal.id} sent: ${txHash}`);
  }

  // 更新处理中的提现状态
  private async updateProcessingWithdrawals(): Promise<void> {
    const processingWithdrawals = await query<Withdrawal[]>(
      "SELECT * FROM withdrawals WHERE status = 'processing' AND tx_hash IS NOT NULL"
    );

    for (const withdrawal of processingWithdrawals) {
      try {
        const chain = getCoinChain(withdrawal.coin as CoinType);
        const chainService = getChainService(chain);
        const txInfo = await chainService.getTransaction(withdrawal.tx_hash!);

        if (txInfo) {
          const requiredConfirmations = config.confirmations[chain];

          if (txInfo.confirmations >= requiredConfirmations) {
            await this.confirmWithdrawal(withdrawal);
          }
        }
      } catch (error) {
        logger.error(`Error updating withdrawal ${withdrawal.id}:`, error);
      }
    }
  }

  // 确认提现
  private async confirmWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await query(
      "UPDATE withdrawals SET status = 'confirmed', updated_at = NOW() WHERE id = ?",
      [withdrawal.id]
    );

    logger.info(`Withdrawal ${withdrawal.id} confirmed: ${withdrawal.tx_hash}`);

    // 发送回调通知
    await this.sendCallback(withdrawal, 'withdrawal_confirmed');
  }

  // 标记提现失败
  private async failWithdrawal(withdrawalId: number, errorMessage: string): Promise<void> {
    await query(
      "UPDATE withdrawals SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?",
      [errorMessage, withdrawalId]
    );

    const withdrawals = await query<Withdrawal[]>(
      'SELECT * FROM withdrawals WHERE id = ?',
      [withdrawalId]
    );

    if (withdrawals.length > 0) {
      await this.sendCallback(withdrawals[0], 'withdrawal_failed');
    }
  }

  // 发送回调通知
  private async sendCallback(
    withdrawal: Withdrawal,
    event: 'withdrawal_confirmed' | 'withdrawal_failed'
  ): Promise<void> {
    if (!config.callbackUrl) {
      logger.warn('No callback URL configured');
      return;
    }

    try {
      const timestamp = Date.now();
      const data = {
        event,
        data: {
          user_id: withdrawal.user_id,
          chain: withdrawal.chain,
          coin: withdrawal.coin as CoinType,
          to_address: withdrawal.to_address,
          amount: withdrawal.amount,
          tx_hash: withdrawal.tx_hash || '',
          error_message: withdrawal.error_message,
        },
        timestamp,
        signature: '',
      };

      // 生成签名
      const signaturePayload = JSON.stringify(data.data) + timestamp;
      data.signature = crypto
        .createHmac('sha256', config.hmacSecret)
        .update(signaturePayload)
        .digest('hex');

      await axios.post(config.callbackUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      logger.info(`Callback sent for withdrawal ${withdrawal.id}`);
    } catch (error) {
      logger.error(`Failed to send callback for withdrawal ${withdrawal.id}:`, error);
    }
  }

  // 获取提现记录
  async getWithdrawal(withdrawalId: number): Promise<Withdrawal | null> {
    const results = await query<Withdrawal[]>(
      'SELECT * FROM withdrawals WHERE id = ?',
      [withdrawalId]
    );
    return results[0] || null;
  }

  // 获取用户提现记录
  async getUserWithdrawals(userId: string, limit = 50): Promise<Withdrawal[]> {
    return query<Withdrawal[]>(
      'SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  }

  // 资金归集 - 将用户地址的资金转移到热钱包
  async consolidateFunds(
    userId: string,
    chain: ChainType,
    coin: CoinType
  ): Promise<string | null> {
    const userAddress = await walletService.getUserAddress(userId, chain);
    if (!userAddress) {
      throw new Error(`User ${userId} has no address on ${chain}`);
    }

    const hotWallet = config.hotWallets[chain];
    if (!hotWallet) {
      throw new Error(`No hot wallet configured for ${chain}`);
    }

    // 获取余额
    const balance = await walletService.getBalance(userAddress.address, coin);
    const balanceAmount = parseFloat(balance.balance);

    if (balanceAmount <= 0) {
      logger.info(`No funds to consolidate for user ${userId} on ${chain}`);
      return null;
    }

    // 获取派生路径
    const derivationPath = await walletService.getDerivationPath(userAddress.address);
    if (!derivationPath) {
      throw new Error('Derivation path not found');
    }

    // 执行转账
    const chainService = getChainService(chain);
    const contract = getTokenContract(coin);

    // 预留手续费
    let transferAmount = balanceAmount;
    if (!contract) {
      // 原生币需要预留手续费
      const feeReserve = chain === 'BTC' ? 0.0001 : chain === 'TRX' ? 1 : 0.001;
      transferAmount = Math.max(0, balanceAmount - feeReserve);
    }

    if (transferAmount <= 0) {
      logger.info(`Insufficient funds for consolidation after fees`);
      return null;
    }

    let txHash: string;

    if (contract && chainService.sendTokenTransaction) {
      txHash = await chainService.sendTokenTransaction(
        derivationPath,
        hotWallet,
        transferAmount.toString(),
        contract
      );
    } else {
      txHash = await chainService.sendTransaction(
        derivationPath,
        hotWallet,
        transferAmount.toString()
      );
    }

    logger.info(`Funds consolidated: ${txHash} (${transferAmount} ${coin} to ${hotWallet})`);

    return txHash;
  }
}

export const withdrawalService = new WithdrawalService();
export default withdrawalService;
