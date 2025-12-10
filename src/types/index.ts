// 支持的链类型
export type ChainType = 'BTC' | 'ETH' | 'BSC' | 'TRX';

// 支持的币种类型
export type CoinType = 'BTC' | 'ETH' | 'BSC' | 'TRX' | 'USDT_ERC20' | 'USDT_BEP20' | 'USDT_TRC20';

// 钱包地址
export interface WalletAddress {
  id: number;
  user_id: string;
  chain: ChainType;
  address: string;
  derivation_path: string;
  created_at: Date;
  updated_at: Date;
}

// 充值记录
export interface Deposit {
  id: number;
  user_id: string;
  chain: ChainType;
  coin: CoinType;
  address: string;
  tx_hash: string;
  amount: string;
  confirmations: number;
  status: 'pending' | 'confirmed' | 'failed';
  callback_status: 'pending' | 'success' | 'failed';
  created_at: Date;
  updated_at: Date;
}

// 提现记录
export interface Withdrawal {
  id: number;
  user_id: string;
  chain: ChainType;
  coin: CoinType;
  from_address: string;
  to_address: string;
  amount: string;
  fee: string;
  tx_hash: string | null;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

// 地址生成请求
export interface GenerateAddressRequest {
  user_id: string;
  chain: ChainType;
}

// 地址生成响应
export interface GenerateAddressResponse {
  user_id: string;
  chain: ChainType;
  address: string;
}

// 提现请求
export interface WithdrawRequest {
  user_id: string;
  chain: ChainType;
  coin: CoinType;
  to_address: string;
  amount: string;
}

// 提现响应
export interface WithdrawResponse {
  withdrawal_id: number;
  status: string;
  tx_hash?: string;
}

// 余额查询请求
export interface BalanceRequest {
  address: string;
  chain: ChainType;
  coin?: CoinType;
}

// 余额响应
export interface BalanceResponse {
  address: string;
  chain: ChainType;
  coin: CoinType;
  balance: string;
}

// 交易信息
export interface TransactionInfo {
  tx_hash: string;
  from: string;
  to: string;
  amount: string;
  confirmations: number;
  block_number?: number;
  timestamp?: number;
}

// 回调数据
export interface CallbackData {
  event: 'deposit_confirmed' | 'withdrawal_confirmed' | 'withdrawal_failed';
  data: {
    user_id: string;
    chain: ChainType;
    coin: CoinType;
    address?: string;
    to_address?: string;
    amount: string;
    tx_hash: string;
    confirmations?: number;
    error_message?: string;
  };
  timestamp: number;
  signature: string;
}

// API响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 链服务接口
export interface ChainService {
  chain: ChainType;
  generateAddress(userId: string, index: number): Promise<{ address: string; path: string }>;
  getBalance(address: string): Promise<string>;
  getTokenBalance?(address: string, contractAddress: string): Promise<string>;
  sendTransaction(fromPath: string, toAddress: string, amount: string): Promise<string>;
  sendTokenTransaction?(fromPath: string, toAddress: string, amount: string, contractAddress: string): Promise<string>;
  getTransaction(txHash: string): Promise<TransactionInfo | null>;
  getTransactionsByAddress(address: string, startBlock?: number): Promise<TransactionInfo[]>;
}
