import axios from 'axios';
import crypto from 'crypto';
import { query } from '../database/connection';
import { getChainService } from './chains';
import { walletService } from './wallet';
import { config } from '../config';
import { ChainType, CoinType, Deposit, TransactionInfo, CallbackData } from '../types';
import logger from '../utils/logger';

export class DepositService {
  private isRunning = false;
  private pollIntervalId: NodeJS.Timeout | null = null;

  // 启动充值监听
  start(): void {
    if (this.isRunning) {
      logger.warn('Deposit service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting deposit monitoring service');

    // 立即执行一次
    this.checkDeposits();

    // 定时执行
    this.pollIntervalId = setInterval(() => {
      this.checkDeposits();
    }, config.pollInterval);
  }

  // 停止充值监听
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    logger.info('Deposit monitoring service stopped');
  }

  // 检查所有链的充值
  private async checkDeposits(): Promise<void> {
    const chains: ChainType[] = ['BTC', 'ETH', 'BSC', 'TRX'];

    for (const chain of chains) {
      try {
        await this.checkChainDeposits(chain);
      } catch (error) {
        logger.error(`Error checking deposits for ${chain}:`, error);
      }
    }

    // 更新待确认交易的确认数
    await this.updatePendingConfirmations();
  }

  // 检查特定链的充值
  private async checkChainDeposits(chain: ChainType): Promise<void> {
    const addresses = await walletService.getAllAddresses(chain);

    for (const addr of addresses) {
      try {
        const chainService = getChainService(chain);

        // 检查原生币余额变化
        const balance = await chainService.getBalance(addr.address);
        await this.processBalanceChange(addr.user_id, chain, chain as CoinType, addr.address, balance);

        // 检查USDT余额变化
        if (chain === 'ETH' && chainService.getTokenBalance) {
          const usdtBalance = await chainService.getTokenBalance(addr.address, config.usdtContracts.ETH);
          await this.processBalanceChange(addr.user_id, chain, 'USDT_ERC20', addr.address, usdtBalance);
        } else if (chain === 'BSC' && chainService.getTokenBalance) {
          const usdtBalance = await chainService.getTokenBalance(addr.address, config.usdtContracts.BSC);
          await this.processBalanceChange(addr.user_id, chain, 'USDT_BEP20', addr.address, usdtBalance);
        } else if (chain === 'TRX' && chainService.getTokenBalance) {
          const usdtBalance = await chainService.getTokenBalance(addr.address, config.usdtContracts.TRX);
          await this.processBalanceChange(addr.user_id, chain, 'USDT_TRC20', addr.address, usdtBalance);
        }
      } catch (error) {
        logger.error(`Error checking deposits for address ${addr.address}:`, error);
      }
    }
  }

  // 处理余额变化（简化版，实际应该通过交易历史检测）
  private async processBalanceChange(
    userId: string,
    chain: ChainType,
    coin: CoinType,
    address: string,
    currentBalance: string
  ): Promise<void> {
    // 这里简化处理，实际生产环境应该：
    // 1. 通过API获取地址的交易历史
    // 2. 检测新的充值交易
    // 3. 记录并处理

    // 示例：记录余额日志
    logger.debug(`${chain}/${coin} balance for ${address}: ${currentBalance}`);
  }

  // 记录新充值
  async recordDeposit(
    userId: string,
    chain: ChainType,
    coin: CoinType,
    address: string,
    txHash: string,
    amount: string,
    confirmations: number
  ): Promise<number> {
    // 检查是否已存在
    const existing = await query<Deposit[]>(
      'SELECT * FROM deposits WHERE tx_hash = ?',
      [txHash]
    );

    if (existing.length > 0) {
      // 更新确认数
      await query(
        'UPDATE deposits SET confirmations = ?, updated_at = NOW() WHERE tx_hash = ?',
        [confirmations, txHash]
      );
      return existing[0].id;
    }

    // 插入新记录
    const result = await query<{ insertId: number }>(
      `INSERT INTO deposits (user_id, chain, coin, address, tx_hash, amount, confirmations, status, callback_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [userId, chain, coin, address, txHash, amount, confirmations]
    );

    logger.info(`New deposit recorded: ${txHash} (${amount} ${coin})`);

    return (result as unknown as { insertId: number }).insertId;
  }

  // 更新待确认交易的确认数
  private async updatePendingConfirmations(): Promise<void> {
    const pendingDeposits = await query<Deposit[]>(
      "SELECT * FROM deposits WHERE status = 'pending'"
    );

    for (const deposit of pendingDeposits) {
      try {
        const chainService = getChainService(deposit.chain);
        const txInfo = await chainService.getTransaction(deposit.tx_hash);

        if (txInfo) {
          await query(
            'UPDATE deposits SET confirmations = ?, updated_at = NOW() WHERE id = ?',
            [txInfo.confirmations, deposit.id]
          );

          // 检查是否达到确认数
          const requiredConfirmations = config.confirmations[deposit.chain];
          if (txInfo.confirmations >= requiredConfirmations) {
            await this.confirmDeposit(deposit.id);
          }
        }
      } catch (error) {
        logger.error(`Error updating confirmation for deposit ${deposit.id}:`, error);
      }
    }
  }

  // 确认充值
  async confirmDeposit(depositId: number): Promise<void> {
    await query(
      "UPDATE deposits SET status = 'confirmed', updated_at = NOW() WHERE id = ?",
      [depositId]
    );

    // 获取充值详情
    const deposits = await query<Deposit[]>(
      'SELECT * FROM deposits WHERE id = ?',
      [depositId]
    );

    if (deposits.length > 0) {
      const deposit = deposits[0];
      logger.info(`Deposit confirmed: ${deposit.tx_hash}`);

      // 发送回调通知
      await this.sendCallback(deposit);
    }
  }

  // 发送回调通知
  private async sendCallback(deposit: Deposit): Promise<void> {
    if (!config.callbackUrl) {
      logger.warn('No callback URL configured');
      return;
    }

    try {
      const timestamp = Date.now();
      const data = {
        event: 'deposit_confirmed' as const,
        data: {
          user_id: deposit.user_id,
          chain: deposit.chain,
          coin: deposit.coin as CoinType,
          address: deposit.address,
          amount: deposit.amount,
          tx_hash: deposit.tx_hash,
          confirmations: deposit.confirmations,
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

      // 发送回调
      await axios.post(config.callbackUrl, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      await query(
        "UPDATE deposits SET callback_status = 'success', updated_at = NOW() WHERE id = ?",
        [deposit.id]
      );

      logger.info(`Callback sent for deposit ${deposit.tx_hash}`);
    } catch (error) {
      logger.error(`Failed to send callback for deposit ${deposit.id}:`, error);

      await query(
        "UPDATE deposits SET callback_status = 'failed', updated_at = NOW() WHERE id = ?",
        [deposit.id]
      );
    }
  }

  // 重试失败的回调
  async retryFailedCallbacks(): Promise<void> {
    const failedDeposits = await query<Deposit[]>(
      "SELECT * FROM deposits WHERE status = 'confirmed' AND callback_status = 'failed'"
    );

    for (const deposit of failedDeposits) {
      await this.sendCallback(deposit);
    }
  }

  // 获取充值记录
  async getDeposit(depositId: number): Promise<Deposit | null> {
    const results = await query<Deposit[]>(
      'SELECT * FROM deposits WHERE id = ?',
      [depositId]
    );
    return results[0] || null;
  }

  // 获取用户充值记录
  async getUserDeposits(userId: string, limit = 50): Promise<Deposit[]> {
    return query<Deposit[]>(
      'SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  }

  // 获取地址充值记录
  async getAddressDeposits(address: string, limit = 50): Promise<Deposit[]> {
    return query<Deposit[]>(
      'SELECT * FROM deposits WHERE address = ? ORDER BY created_at DESC LIMIT ?',
      [address, limit]
    );
  }
}

export const depositService = new DepositService();
export default depositService;
