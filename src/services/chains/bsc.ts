import { ethers } from 'ethers';
import { config } from '../../config';
import { getMnemonicManager } from '../crypto/encryption';
import { ChainService, TransactionInfo } from '../../types';
import logger from '../../utils/logger';

// BEP20 ABI (与ERC20兼容)
const BEP20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// BIP44路径: m/44'/60'/0'/0/index (BSC使用与ETH相同的路径)
const BSC_PATH_PREFIX = "m/44'/60'/0'/0";

export class BSCService implements ChainService {
  chain: 'BSC' = 'BSC';
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcEndpoints.BSC);
  }

  async generateAddress(userId: string, index: number): Promise<{ address: string; path: string }> {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();

    const path = `${BSC_PATH_PREFIX}/${index}`;
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path);

    logger.info(`Generated BSC address for user ${userId}: ${hdNode.address}`);

    return { address: hdNode.address, path };
  }

  private getWalletFromPath(derivationPath: string): ethers.HDNodeWallet {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();

    return ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Failed to get BNB balance for ${address}:`, error);
      throw error;
    }
  }

  async getTokenBalance(address: string, contractAddress: string): Promise<string> {
    try {
      const contract = new ethers.Contract(contractAddress, BEP20_ABI, this.provider);
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      logger.error(`Failed to get BEP20 token balance for ${address}:`, error);
      throw error;
    }
  }

  async sendTransaction(fromPath: string, toAddress: string, amount: string): Promise<string> {
    try {
      const wallet = this.getWalletFromPath(fromPath).connect(this.provider);

      const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      logger.info(`BSC transaction sent: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      logger.error('Failed to send BSC transaction:', error);
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
      const wallet = this.getWalletFromPath(fromPath).connect(this.provider);
      const contract = new ethers.Contract(contractAddress, BEP20_ABI, wallet);

      const decimals = await contract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      const tx = await contract.transfer(toAddress, amountWei);

      logger.info(`BEP20 token transaction sent: ${tx.hash}`);

      return tx.hash;
    } catch (error) {
      logger.error('Failed to send BEP20 token transaction:', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<TransactionInfo | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) return null;

      const block = tx.blockNumber ? await this.provider.getBlock(tx.blockNumber) : null;
      const currentBlock = await this.provider.getBlockNumber();

      const confirmations = tx.blockNumber ? currentBlock - tx.blockNumber + 1 : 0;

      return {
        tx_hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        amount: ethers.formatEther(tx.value),
        confirmations,
        block_number: tx.blockNumber || undefined,
        timestamp: block?.timestamp ? Number(block.timestamp) * 1000 : undefined,
      };
    } catch (error) {
      logger.error(`Failed to get BSC transaction ${txHash}:`, error);
      return null;
    }
  }

  async getTransactionsByAddress(address: string, startBlock?: number): Promise<TransactionInfo[]> {
    try {
      logger.warn('BSC getTransactionsByAddress requires external API for efficiency');
      return [];
    } catch (error) {
      logger.error(`Failed to get BSC transactions for ${address}:`, error);
      return [];
    }
  }

  // 监听地址的Transfer事件 (用于BEP20代币)
  async watchTokenTransfers(
    address: string,
    contractAddress: string,
    callback: (tx: TransactionInfo) => void
  ): Promise<ethers.Contract> {
    const contract = new ethers.Contract(contractAddress, BEP20_ABI, this.provider);

    const filterTo = contract.filters.Transfer(null, address);
    contract.on(filterTo, async (from, to, value, event) => {
      const decimals = await contract.decimals();
      const txInfo: TransactionInfo = {
        tx_hash: event.log.transactionHash,
        from,
        to,
        amount: ethers.formatUnits(value, decimals),
        confirmations: 0,
        block_number: event.log.blockNumber,
      };
      callback(txInfo);
    });

    return contract;
  }

  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
  }

  async estimateGas(to: string, value: string, data?: string): Promise<string> {
    const estimate = await this.provider.estimateGas({
      to,
      value: ethers.parseEther(value),
      data,
    });
    return estimate.toString();
  }
}

export default BSCService;
