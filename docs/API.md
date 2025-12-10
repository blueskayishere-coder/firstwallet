# Multi-Chain Wallet Service API 文档

## 概述

多链钱包微服务 REST API，支持 BTC、ETH、BSC、TRX 及其 USDT 代币。

**Base URL**: `http://localhost:3000`

## 认证

所有 API 请求（除健康检查外）需要在 Header 中携带认证信息。

### API Key 认证

```http
X-API-Key: your-api-key
```

### HMAC 签名认证（可选，用于敏感操作）

```http
X-API-Key: your-api-key
X-Timestamp: 1702200000000
X-Signature: hmac_sha256_signature
```

**签名计算方式**:
```javascript
const payload = JSON.stringify(requestBody) + timestamp;
const signature = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
```

---

## 接口列表

### 1. 健康检查

检查服务运行状态。

**请求**
```http
GET /health
```

**响应**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-12-10T08:00:00.000Z"
  }
}
```

---

### 2. 生成地址

为用户生成指定链的钱包地址。每个用户每条链只会生成一个地址。

**请求**
```http
POST /api/address
Content-Type: application/json
X-API-Key: your-api-key
```

**请求体**
```json
{
  "user_id": "user123",
  "chain": "ETH"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户唯一标识 |
| chain | string | 是 | 链类型: BTC, ETH, BSC, TRX |

**成功响应** (200)
```json
{
  "success": true,
  "data": {
    "user_id": "user123",
    "chain": "ETH",
    "address": "0x1234567890abcdef1234567890abcdef12345678"
  }
}
```

**错误响应** (400)
```json
{
  "success": false,
  "error": "user_id and chain are required"
}
```

---

### 3. 查询余额

查询指定地址的余额。

**请求**
```http
GET /api/balance?address={address}&coin={coin}
X-API-Key: your-api-key
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |
| coin | string | 是 | 币种: BTC, ETH, BSC, TRX, USDT_ERC20, USDT_BEP20, USDT_TRC20 |

**成功响应** (200)
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "chain": "ETH",
    "coin": "ETH",
    "balance": "1.500000000000000000"
  }
}
```

**USDT 余额查询示例**
```http
GET /api/balance?address=0x...&coin=USDT_ERC20
```

---

### 4. 获取用户所有地址

获取用户在所有链上的地址。

**请求**
```http
GET /api/addresses/{user_id}
X-API-Key: your-api-key
```

**成功响应** (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "chain": "ETH",
      "address": "0x...",
      "derivation_path": "m/44'/60'/0'/0/0",
      "created_at": "2024-12-10T08:00:00.000Z",
      "updated_at": "2024-12-10T08:00:00.000Z"
    },
    {
      "id": 2,
      "user_id": "user123",
      "chain": "BTC",
      "address": "bc1q...",
      "derivation_path": "m/44'/0'/0'/0/0",
      "created_at": "2024-12-10T08:00:00.000Z",
      "updated_at": "2024-12-10T08:00:00.000Z"
    }
  ]
}
```

---

### 5. 创建提现

从用户地址提现到外部地址。

**请求**
```http
POST /api/withdraw
Content-Type: application/json
X-API-Key: your-api-key
```

**请求体**
```json
{
  "user_id": "user123",
  "chain": "ETH",
  "coin": "ETH",
  "to_address": "0xRecipientAddress...",
  "amount": "0.1"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户唯一标识 |
| chain | string | 是 | 链类型 |
| coin | string | 是 | 币种 |
| to_address | string | 是 | 目标地址 |
| amount | string | 是 | 提现金额 |

**成功响应** (200)
```json
{
  "success": true,
  "data": {
    "withdrawal_id": 1,
    "status": "pending"
  }
}
```

**提现状态**:
- `pending`: 等待处理
- `processing`: 处理中（已广播）
- `confirmed`: 已确认
- `failed`: 失败

---

### 6. 获取提现记录

获取用户的提现历史记录。

**请求**
```http
GET /api/withdrawals/{user_id}?limit=50
X-API-Key: your-api-key
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | path | 是 | 用户ID |
| limit | query | 否 | 返回记录数，默认50 |

**成功响应** (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "chain": "ETH",
      "coin": "ETH",
      "from_address": "0x...",
      "to_address": "0x...",
      "amount": "0.100000000000000000",
      "fee": "0.001000000000000000",
      "tx_hash": "0x...",
      "status": "confirmed",
      "error_message": null,
      "created_at": "2024-12-10T08:00:00.000Z",
      "updated_at": "2024-12-10T08:05:00.000Z"
    }
  ]
}
```

---

### 7. 获取提现详情

获取单笔提现的详细信息。

**请求**
```http
GET /api/withdrawal/{id}
X-API-Key: your-api-key
```

**成功响应** (200)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user123",
    "chain": "ETH",
    "coin": "ETH",
    "from_address": "0x...",
    "to_address": "0x...",
    "amount": "0.100000000000000000",
    "fee": "0.001000000000000000",
    "tx_hash": "0x...",
    "status": "confirmed",
    "error_message": null,
    "created_at": "2024-12-10T08:00:00.000Z",
    "updated_at": "2024-12-10T08:05:00.000Z"
  }
}
```

**错误响应** (404)
```json
{
  "success": false,
  "error": "Withdrawal not found"
}
```

---

### 8. 获取充值记录

获取用户的充值历史记录。

**请求**
```http
GET /api/deposits/{user_id}?limit=50
X-API-Key: your-api-key
```

**成功响应** (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "chain": "ETH",
      "coin": "ETH",
      "address": "0x...",
      "tx_hash": "0x...",
      "amount": "1.000000000000000000",
      "confirmations": 12,
      "status": "confirmed",
      "callback_status": "success",
      "created_at": "2024-12-10T08:00:00.000Z",
      "updated_at": "2024-12-10T08:10:00.000Z"
    }
  ]
}
```

**充值状态**:
- `pending`: 等待确认
- `confirmed`: 已确认
- `failed`: 失败

---

### 9. 获取充值详情

获取单笔充值的详细信息。

**请求**
```http
GET /api/deposit/{id}
X-API-Key: your-api-key
```

---

### 10. 资金归集

将用户地址的资金转移到热钱包。

**请求**
```http
POST /api/consolidate
Content-Type: application/json
X-API-Key: your-api-key
```

**请求体**
```json
{
  "user_id": "user123",
  "chain": "ETH",
  "coin": "ETH"
}
```

**成功响应** (200)
```json
{
  "success": true,
  "data": {
    "tx_hash": "0x..."
  },
  "message": "Consolidation initiated"
}
```

**无资金时响应**
```json
{
  "success": true,
  "data": {
    "tx_hash": null
  },
  "message": "No funds to consolidate"
}
```

---

## 回调通知

当充值确认或提现完成时，系统会向配置的 `CALLBACK_URL` 发送 POST 请求。

### 充值确认回调

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

### 提现确认回调

```json
{
  "event": "withdrawal_confirmed",
  "data": {
    "user_id": "user123",
    "chain": "ETH",
    "coin": "ETH",
    "to_address": "0x...",
    "amount": "0.1",
    "tx_hash": "0x..."
  },
  "timestamp": 1702200000000,
  "signature": "hmac_sha256_signature"
}
```

### 提现失败回调

```json
{
  "event": "withdrawal_failed",
  "data": {
    "user_id": "user123",
    "chain": "ETH",
    "coin": "ETH",
    "to_address": "0x...",
    "amount": "0.1",
    "tx_hash": "",
    "error_message": "Insufficient funds"
  },
  "timestamp": 1702200000000,
  "signature": "hmac_sha256_signature"
}
```

### 验证回调签名

```javascript
const payload = JSON.stringify(callback.data) + callback.timestamp;
const expectedSignature = crypto
  .createHmac('sha256', hmacSecret)
  .update(payload)
  .digest('hex');

if (callback.signature === expectedSignature) {
  // 签名有效
}
```

---

## 错误码

| HTTP状态码 | 说明 |
|-----------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 支持的链和币种

| 链 | 原生币 | USDT |
|-----|--------|------|
| BTC | BTC | - |
| ETH | ETH | USDT_ERC20 |
| BSC | BSC (BNB) | USDT_BEP20 |
| TRX | TRX | USDT_TRC20 |

## 确认数配置

| 链 | 默认确认数 |
|-----|-----------|
| BTC | 3 |
| ETH | 12 |
| BSC | 15 |
| TRX | 20 |

可通过环境变量配置：`BTC_CONFIRMATIONS`, `ETH_CONFIRMATIONS` 等。
