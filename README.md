# Multi-Chain Wallet Service

多链钱包微服务 - 支持 BTC/ETH/BSC/TRX 及 USDT

## 功能特性

- **多链支持**: BTC, ETH, BSC, TRX
- **USDT支持**: ERC20, BEP20, TRC20
- **地址生成**: BIP44 HD钱包派生
- **充值监听**: 轮询检测 + 确认数验证
- **提现执行**: 签名广播 + 异步确认
- **资金归集**: 用户地址 → 热钱包
- **安全认证**: API Key + HMAC签名

## 技术栈

- Node.js 18+
- TypeScript
- Express
- MySQL
- ethers.js (ETH/BSC)
- tronweb (TRX)
- bitcoinjs-lib (BTC)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件配置必要参数
```

### 3. 初始化数据库

```bash
npm run migrate
```

### 4. 生成助记词

```bash
npm run generate-mnemonic
```

**重要**: 请安全保管生成的助记词！

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## API 文档

所有 API 请求需要在 Header 中携带 `X-API-Key`。

### 生成地址

```
POST /api/address
Content-Type: application/json
X-API-Key: your-api-key

{
  "user_id": "user123",
  "chain": "ETH"  // BTC, ETH, BSC, TRX
}

Response:
{
  "success": true,
  "data": {
    "user_id": "user123",
    "chain": "ETH",
    "address": "0x..."
  }
}
```

### 查询余额

```
GET /api/balance?address=0x...&coin=ETH
X-API-Key: your-api-key

coin: BTC, ETH, BSC, TRX, USDT_ERC20, USDT_BEP20, USDT_TRC20

Response:
{
  "success": true,
  "data": {
    "address": "0x...",
    "chain": "ETH",
    "coin": "ETH",
    "balance": "1.5"
  }
}
```

### 提现

```
POST /api/withdraw
Content-Type: application/json
X-API-Key: your-api-key

{
  "user_id": "user123",
  "chain": "ETH",
  "coin": "ETH",
  "to_address": "0x...",
  "amount": "0.1"
}

Response:
{
  "success": true,
  "data": {
    "withdrawal_id": 1,
    "status": "pending"
  }
}
```

### 资金归集

```
POST /api/consolidate
Content-Type: application/json
X-API-Key: your-api-key

{
  "user_id": "user123",
  "chain": "ETH",
  "coin": "ETH"
}

Response:
{
  "success": true,
  "data": {
    "tx_hash": "0x..."
  }
}
```

### 获取用户地址

```
GET /api/addresses/:user_id
X-API-Key: your-api-key
```

### 获取充值记录

```
GET /api/deposits/:user_id?limit=50
X-API-Key: your-api-key
```

### 获取提现记录

```
GET /api/withdrawals/:user_id?limit=50
X-API-Key: your-api-key
```

## 回调通知

充值确认或提现完成后，系统会向配置的 `CALLBACK_URL` 发送 POST 请求：

```json
{
  "event": "deposit_confirmed",
  "data": {
    "user_id": "user123",
    "chain": "ETH",
    "coin": "ETH",
    "address": "0x...",
    "amount": "1.0",
    "tx_hash": "0x...",
    "confirmations": 12
  },
  "timestamp": 1702200000000,
  "signature": "hmac_sha256_signature"
}
```

## 安全说明

1. **助记词存储**: 使用 AES-256-GCM 加密存储
2. **API认证**: 支持 API Key 和 HMAC 签名双重认证
3. **回调验证**: 使用 HMAC 签名验证回调真实性

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| PORT | 服务端口 | 否 (默认3000) |
| DB_HOST | MySQL主机 | 是 |
| DB_PORT | MySQL端口 | 否 (默认3306) |
| DB_USER | MySQL用户 | 是 |
| DB_PASSWORD | MySQL密码 | 是 |
| DB_NAME | 数据库名 | 是 |
| ENCRYPTION_KEY | 助记词加密密钥 | 是 |
| API_KEY | API认证密钥 | 是 |
| HMAC_SECRET | HMAC签名密钥 | 是 |
| ANKR_API_KEY | Ankr API密钥 | 否 |
| BLOCKCYPHER_TOKEN | BlockCypher API密钥 | 否 |
| TRONGRID_API_KEY | TronGrid API密钥 | 否 |
| CALLBACK_URL | 回调通知URL | 否 |
| HOT_WALLET_* | 各链热钱包地址 | 否 |

## 许可证

MIT
