import { query } from '../database/connection';
import { getChainService } from './chains';
import { config } from '../config';
import {
  ChainType,
  CoinType,
  WalletAddress,
  BalanceResponse,
  GenerateAddressResponse,
} from '../types';
import logger from '../utils/logger';

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

// 获取币种的合约地址
function getTokenContract(coin: CoinType): string | null {
  const contracts: Record<string, string> = {
    USDT_ERC20: config.usdtContracts.ETH,
    USDT_BEP20: config.usdtContracts.BSC,
    USDT_TRC20: config.usdtContracts.TRX,
  };
  return contracts[coin] || null;
}

export class WalletService {
  // 生成地址
  async generateAddress(userId: string, chain: ChainType): Promise<GenerateAddressResponse> {
    try {
      // 检查是否已有地址
      const existing = await query<WalletAddress[]>(
        'SELECT * FROM wallet_addresses WHERE user_id = ? AND chain = ?',
        [userId, chain]
      );

      if (existing.length > 0) {
        logger.info(`Address already exists for user ${userId} on ${chain}`);
        return {
          user_id: userId,
          chain,
          address: existing[0].address,
        };
      }

      // 获取并递增索引
      const indexResult = await query<{ next_index: number }[]>(
        'SELECT next_index FROM address_indexes WHERE chain = ? FOR UPDATE',
        [chain]
      );

      const currentIndex = indexResult[0]?.next_index || 0;

      await query(
        'UPDATE address_indexes SET next_index = next_index + 1 WHERE chain = ?',
        [chain]
      );

      // 生成地址
      const chainService = getChainService(chain);
      const { address, path } = await chainService.generateAddress(userId, currentIndex);

      // 保存到数据库
      await query(
        `INSERT INTO wallet_addresses (user_id, chain, address, derivation_path)
         VALUES (?, ?, ?, ?)`,
        [userId, chain, address, path]
      );

      logger.info(`Generated new address for user ${userId} on ${chain}: ${address}`);

      return {
        user_id: userId,
        chain,
        address,
      };
    } catch (error) {
      logger.error(`Failed to generate address for user ${userId} on ${chain}:`, error);
      throw error;
    }
  }

  // 获取余额
  async getBalance(address: string, coin: CoinType): Promise<BalanceResponse> {
    try {
      const chain = getCoinChain(coin);
      const chainService = getChainService(chain);
      const contract = getTokenContract(coin);

      let balance: string;

      if (contract && chainService.getTokenBalance) {
        balance = await chainService.getTokenBalance(address, contract);
      } else {
        balance = await chainService.getBalance(address);
      }

      return {
        address,
        chain,
        coin,
        balance,
      };
    } catch (error) {
      logger.error(`Failed to get balance for ${address}:`, error);
      throw error;
    }
  }

  // 获取用户地址
  async getUserAddress(userId: string, chain: ChainType): Promise<WalletAddress | null> {
    const results = await query<WalletAddress[]>(
      'SELECT * FROM wallet_addresses WHERE user_id = ? AND chain = ?',
      [userId, chain]
    );
    return results[0] || null;
  }

  // 获取用户所有地址
  async getUserAddresses(userId: string): Promise<WalletAddress[]> {
    return query<WalletAddress[]>(
      'SELECT * FROM wallet_addresses WHERE user_id = ?',
      [userId]
    );
  }

  // 通过地址查找用户
  async getUserByAddress(address: string): Promise<WalletAddress | null> {
    const results = await query<WalletAddress[]>(
      'SELECT * FROM wallet_addresses WHERE address = ?',
      [address]
    );
    return results[0] || null;
  }

  // 获取所有监控地址
  async getAllAddresses(chain?: ChainType): Promise<WalletAddress[]> {
    if (chain) {
      return query<WalletAddress[]>(
        'SELECT * FROM wallet_addresses WHERE chain = ?',
        [chain]
      );
    }
    return query<WalletAddress[]>('SELECT * FROM wallet_addresses');
  }

  // 获取地址的派生路径
  async getDerivationPath(address: string): Promise<string | null> {
    const results = await query<{ derivation_path: string }[]>(
      'SELECT derivation_path FROM wallet_addresses WHERE address = ?',
      [address]
    );
    return results[0]?.derivation_path || null;
  }
}

export const walletService = new WalletService();
export default walletService;
