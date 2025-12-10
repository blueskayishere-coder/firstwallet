import TronWeb from 'tronweb';
import * as bip39 from 'bip39';
import { ethers } from 'ethers';
import { config } from '../../config';
import { getMnemonicManager } from '../crypto/encryption';
import { ChainService, TransactionInfo } from '../../types';
import logger from '../../utils/logger';

// BIP44路径: m/44'/195'/0'/0/index (TRX)
const TRX_PATH_PREFIX = "m/44'/195'/0'/0";

export class TRXService implements ChainService {
  chain: 'TRX' = 'TRX';
  private tronWeb: TronWeb;

  constructor() {
    this.tronWeb = new TronWeb({
      fullHost: config.rpcEndpoints.TRONGRID,
      headers: config.trongridApiKey ? { 'TRON-PRO-API-KEY': config.trongridApiKey } : {},
    });
  }

  async generateAddress(userId: string, index: number): Promise<{ address: string; path: string }> {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();

    const path = `${TRX_PATH_PREFIX}/${index}`;
    // 使用ethers派生私钥，然后转换为TRX地址
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);
    const privateKey = hdNode.privateKey.slice(2); // 移除0x前缀

    // 使用TronWeb从私钥生成地址
    const address = this.tronWeb.address.fromPrivateKey(privateKey);

    logger.info(`Generated TRX address for user ${userId}: ${address}`);

    return { address, path };
  }

  private getPrivateKeyFromPath(derivationPath: string): string {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();

    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
    return hdNode.privateKey.slice(2); // 移除0x前缀
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      // TRX使用6位小数 (SUN)
      return (balance / 1e6).toString();
    } catch (error) {
      logger.error(`Failed to get TRX balance for ${address}:`, error);
      throw error;
    }
  }

  async getTokenBalance(address: string, contractAddress: string): Promise<string> {
    try {
      // 设置合约
      const contract = await this.tronWeb.contract().at(contractAddress);
      const balance = await contract.balanceOf(address).call();
      // USDT TRC20 使用 6 位小数
      const decimals = await contract.decimals().call();
      return (Number(balance) / Math.pow(10, Number(decimals))).toString();
    } catch (error) {
      logger.error(`Failed to get TRC20 token balance for ${address}:`, error);
      throw error;
    }
  }

  async sendTransaction(fromPath: string, toAddress: string, amount: string): Promise<string> {
    try {
      const privateKey = this.getPrivateKeyFromPath(fromPath);
      const fromAddress = this.tronWeb.address.fromPrivateKey(privateKey);

      // 转换金额为SUN
      const amountSun = Math.floor(parseFloat(amount) * 1e6);

      // 创建交易
      const tx = await this.tronWeb.transactionBuilder.sendTrx(
        toAddress,
        amountSun,
        fromAddress
      );

      // 签名
      const signedTx = await this.tronWeb.trx.sign(tx, privateKey);

      // 广播
      const result = await this.tronWeb.trx.sendRawTransaction(signedTx);

      if (!result.result) {
        throw new Error('Transaction broadcast failed');
      }

      logger.info(`TRX transaction sent: ${result.txid}`);

      return result.txid;
    } catch (error) {
      logger.error('Failed to send TRX transaction:', error);
      throw error;
    }
  }

  async sendTokenTransaction(
    fromPath: string,
    toAddress: string,
    amount: string,
    contractAddress: string
  ): Promise<string> {
    try {
      const privateKey = this.getPrivateKeyFromPath(fromPath);
      const fromAddress = this.tronWeb.address.fromPrivateKey(privateKey);

      // 获取合约
      const contract = await this.tronWeb.contract().at(contractAddress);
      const decimals = await contract.decimals().call();

      // 转换金额
      const amountWei = Math.floor(parseFloat(amount) * Math.pow(10, Number(decimals)));

      // 设置发送者
      this.tronWeb.setPrivateKey(privateKey);

      // 调用transfer方法
      const tx = await contract.transfer(toAddress, amountWei).send({
        feeLimit: 100000000, // 100 TRX
        callValue: 0,
        from: fromAddress,
      });

      logger.info(`TRC20 token transaction sent: ${tx}`);

      return tx;
    } catch (error) {
      logger.error('Failed to send TRC20 token transaction:', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<TransactionInfo | null> {
    try {
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      if (!tx) return null;

      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);

      // 获取当前区块号
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();
      const currentBlockNum = currentBlock.block_header?.raw_data?.number || 0;

      const confirmations = txInfo.blockNumber
        ? currentBlockNum - txInfo.blockNumber
        : 0;

      // 解析交易数据
      const contract = tx.raw_data?.contract?.[0];
      let from = '';
      let to = '';
      let amount = '0';

      if (contract?.type === 'TransferContract') {
        const value = contract.parameter?.value;
        from = this.tronWeb.address.fromHex(value.owner_address);
        to = this.tronWeb.address.fromHex(value.to_address);
        amount = (value.amount / 1e6).toString();
      }

      return {
        tx_hash: txHash,
        from,
        to,
        amount,
        confirmations,
        block_number: txInfo.blockNumber,
        timestamp: txInfo.blockTimeStamp,
      };
    } catch (error) {
      logger.error(`Failed to get TRX transaction ${txHash}:`, error);
      return null;
    }
  }

  async getTransactionsByAddress(address: string, startBlock?: number): Promise<TransactionInfo[]> {
    try {
      // 使用TronGrid API获取地址交易历史
      const response = await this.tronWeb.trx.getAccount(address);
      // TronGrid对交易历史有限制，需要使用专门的API
      logger.warn('TRX getTransactionsByAddress requires TronGrid API for full history');

      return [];
    } catch (error) {
      logger.error(`Failed to get TRX transactions for ${address}:`, error);
      return [];
    }
  }

  // 获取账户资源（带宽、能量）
  async getAccountResources(address: string): Promise<{
    bandwidth: number;
    energy: number;
    bandwidthUsed: number;
    energyUsed: number;
  }> {
    try {
      const resources = await this.tronWeb.trx.getAccountResources(address);
      return {
        bandwidth: resources.freeNetLimit || 0,
        energy: resources.EnergyLimit || 0,
        bandwidthUsed: resources.freeNetUsed || 0,
        energyUsed: resources.EnergyUsed || 0,
      };
    } catch (error) {
      logger.error(`Failed to get TRX account resources for ${address}:`, error);
      throw error;
    }
  }

  // 激活账户（发送少量TRX）
  async activateAccount(toAddress: string, fromPath: string): Promise<string> {
    // 发送0.1 TRX激活账户
    return this.sendTransaction(fromPath, toAddress, '0.1');
  }
}

export default TRXService;
