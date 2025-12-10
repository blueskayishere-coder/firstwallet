import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  // 服务配置
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'wallet_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wallet_db',
  },

  // API密钥
  ankrApiKey: process.env.ANKR_API_KEY || '',
  blockcypherToken: process.env.BLOCKCYPHER_TOKEN || '',
  trongridApiKey: process.env.TRONGRID_API_KEY || '',

  // 加密配置
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  mnemonicPath: path.join(process.cwd(), 'data', 'mnemonic.enc'),

  // API认证
  apiKey: process.env.API_KEY || '',
  hmacSecret: process.env.HMAC_SECRET || '',

  // 热钱包地址
  hotWallets: {
    BTC: process.env.HOT_WALLET_BTC || '',
    ETH: process.env.HOT_WALLET_ETH || '',
    BSC: process.env.HOT_WALLET_BSC || '',
    TRX: process.env.HOT_WALLET_TRX || '',
  },

  // 回调URL
  callbackUrl: process.env.CALLBACK_URL || '',

  // 区块确认数
  confirmations: {
    BTC: parseInt(process.env.BTC_CONFIRMATIONS || '3', 10),
    ETH: parseInt(process.env.ETH_CONFIRMATIONS || '12', 10),
    BSC: parseInt(process.env.BSC_CONFIRMATIONS || '15', 10),
    TRX: parseInt(process.env.TRX_CONFIRMATIONS || '20', 10),
  },

  // 轮询间隔
  pollInterval: parseInt(process.env.POLL_INTERVAL || '30000', 10),

  // RPC端点
  rpcEndpoints: {
    ETH: process.env.ANKR_API_KEY
      ? `https://rpc.ankr.com/eth/${process.env.ANKR_API_KEY.split('/').pop()}`
      : 'https://rpc.ankr.com/eth',
    BSC: process.env.ANKR_API_KEY
      ? `https://rpc.ankr.com/bsc/${process.env.ANKR_API_KEY.split('/').pop()}`
      : 'https://rpc.ankr.com/bsc',
    BLOCKCYPHER: 'https://api.blockcypher.com/v1/btc/main',
    TRONGRID: 'https://api.trongrid.io',
  },

  // USDT合约地址
  usdtContracts: {
    ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',  // USDT ERC20
    BSC: '0x55d398326f99059fF775485246999027B3197955',  // USDT BEP20
    TRX: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',         // USDT TRC20
  },
};

export default config;
