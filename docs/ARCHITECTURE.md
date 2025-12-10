# 系统架构文档

## 概述

多链钱包微服务采用分层架构设计，支持 BTC、ETH、BSC、TRX 四条主流公链及其 USDT 代币。

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Systems                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ BlockCypher│  │  Ankr    │  │ TronGrid │  │ Callback Server │ │
│  │   (BTC)   │  │(ETH/BSC) │  │  (TRX)   │  │                  │ │
│  └─────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└────────┼─────────────┼─────────────┼─────────────────┼───────────┘
         │             │             │                 │
┌────────┼─────────────┼─────────────┼─────────────────┼───────────┐
│        ▼             ▼             ▼                 ▼           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Chain Services Layer                  │   │
│   │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│   │  │   BTC   │ │   ETH   │ │   BSC   │ │   TRX   │       │   │
│   │  │ Service │ │ Service │ │ Service │ │ Service │       │   │
│   │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │   │
│   └───────┼───────────┼───────────┼───────────┼─────────────┘   │
│           │           │           │           │                  │
│           ▼           ▼           ▼           ▼                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   Business Services Layer                │   │
│   │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │   │
│   │  │ WalletService │ │DepositService │ │WithdrawalSvc  │ │   │
│   │  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘ │   │
│   └──────────┼─────────────────┼─────────────────┼───────────┘   │
│              │                 │                 │                │
│              ▼                 ▼                 ▼                │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                      API Layer (Express)                 │   │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │   │
│   │  │  Auth MW    │ │   Routes    │ │  Error Handler  │   │   │
│   │  └─────────────┘ └─────────────┘ └─────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Data Layer (MySQL)                    │   │
│   │  ┌──────────────┐ ┌──────────┐ ┌────────────────────┐  │   │
│   │  │wallet_addresses│ │ deposits │ │    withdrawals    │  │   │
│   │  └──────────────┘ └──────────┘ └────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 Security Layer                           │   │
│   │  ┌─────────────────────┐ ┌─────────────────────────┐   │   │
│   │  │ Encryption Service  │ │   Mnemonic Manager      │   │   │
│   │  │   (AES-256-GCM)     │ │  (In-Memory Storage)    │   │   │
│   │  └─────────────────────┘ └─────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                         Wallet Service                           │
└──────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/
├── config/             # 配置管理
│   └── index.ts        # 环境变量和配置项
├── database/           # 数据库层
│   ├── connection.ts   # MySQL连接池
│   └── migrate.ts      # 数据库迁移
├── middleware/         # Express中间件
│   └── auth.ts         # API认证
├── routes/             # API路由
│   └── wallet.ts       # 钱包相关API
├── services/           # 业务服务层
│   ├── chains/         # 链服务
│   │   ├── index.ts    # 链服务工厂
│   │   ├── btc.ts      # BTC链服务
│   │   ├── eth.ts      # ETH链服务
│   │   ├── bsc.ts      # BSC链服务
│   │   └── trx.ts      # TRX链服务
│   ├── crypto/         # 加密服务
│   │   └── encryption.ts
│   ├── wallet.ts       # 钱包管理服务
│   ├── deposit.ts      # 充值监听服务
│   └── withdrawal.ts   # 提现处理服务
├── types/              # TypeScript类型定义
│   └── index.ts
├── utils/              # 工具类
│   └── logger.ts       # 日志工具
├── scripts/            # 脚本
│   └── generate-mnemonic.ts
└── index.ts            # 应用入口
```

## 核心组件

### 1. 链服务 (Chain Services)

每条链实现统一的 `ChainService` 接口：

```typescript
interface ChainService {
  chain: ChainType;
  generateAddress(userId: string, index: number): Promise<{ address: string; path: string }>;
  getBalance(address: string): Promise<string>;
  getTokenBalance?(address: string, contractAddress: string): Promise<string>;
  sendTransaction(fromPath: string, toAddress: string, amount: string): Promise<string>;
  sendTokenTransaction?(fromPath: string, toAddress: string, amount: string, contractAddress: string): Promise<string>;
  getTransaction(txHash: string): Promise<TransactionInfo | null>;
  getTransactionsByAddress(address: string, startBlock?: number): Promise<TransactionInfo[]>;
}
```

### 2. 地址派生

使用 BIP44 标准派生路径：

| 链 | 路径 | Coin Type |
|----|------|-----------|
| BTC | m/44'/0'/0'/0/{index} | 0 |
| ETH | m/44'/60'/0'/0/{index} | 60 |
| BSC | m/44'/60'/0'/0/{index} | 60 (与ETH相同) |
| TRX | m/44'/195'/0'/0/{index} | 195 |

### 3. 助记词管理

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Mnemonic File  │────▶│ Decryption       │────▶│   Memory    │
│ (AES-256-GCM)   │     │ (on startup)     │     │  (runtime)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

- 助记词以 AES-256-GCM 加密存储在文件系统
- 启动时解密并加载到内存
- 运行时直接从内存读取，提高性能

### 4. 充值监听流程

```
┌─────────┐     ┌───────────────┐     ┌─────────────┐     ┌──────────┐
│  Timer  │────▶│ Check Balance │────▶│ New Deposit │────▶│ Record   │
│ (30s)   │     │ (All Chains)  │     │  Detected?  │     │ to DB    │
└─────────┘     └───────────────┘     └──────┬──────┘     └────┬─────┘
                                              │                 │
                                              ▼                 ▼
                                       ┌─────────────┐   ┌──────────┐
                                       │ Update      │   │ Wait for │
                                       │Confirmations│◀──│ Confirms │
                                       └──────┬──────┘   └──────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   Send      │
                                       │  Callback   │
                                       └─────────────┘
```

### 5. 提现处理流程

```
┌──────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  Create  │────▶│   Check     │────▶│   Sign &    │────▶│  Update  │
│ Withdraw │     │   Balance   │     │  Broadcast  │     │  Status  │
└──────────┘     └─────────────┘     └─────────────┘     └────┬─────┘
                                                               │
                                                               ▼
                                                        ┌─────────────┐
                                                        │ Wait for    │
                                                        │Confirmations│
                                                        └──────┬──────┘
                                                               │
                                                               ▼
                                                        ┌─────────────┐
                                                        │   Send      │
                                                        │  Callback   │
                                                        └─────────────┘
```

## 数据库设计

### wallet_addresses 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | VARCHAR(64) | 用户ID |
| chain | ENUM | 链类型 |
| address | VARCHAR(128) | 钱包地址 |
| derivation_path | VARCHAR(64) | 派生路径 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**索引**:
- `uk_user_chain`: (user_id, chain) 唯一
- `uk_address`: (address) 唯一

### deposits 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | VARCHAR(64) | 用户ID |
| chain | ENUM | 链类型 |
| coin | VARCHAR(20) | 币种 |
| address | VARCHAR(128) | 充值地址 |
| tx_hash | VARCHAR(128) | 交易哈希 |
| amount | DECIMAL(36,18) | 金额 |
| confirmations | INT | 确认数 |
| status | ENUM | pending/confirmed/failed |
| callback_status | ENUM | pending/success/failed |

### withdrawals 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| user_id | VARCHAR(64) | 用户ID |
| chain | ENUM | 链类型 |
| coin | VARCHAR(20) | 币种 |
| from_address | VARCHAR(128) | 来源地址 |
| to_address | VARCHAR(128) | 目标地址 |
| amount | DECIMAL(36,18) | 金额 |
| fee | DECIMAL(36,18) | 手续费 |
| tx_hash | VARCHAR(128) | 交易哈希 |
| status | ENUM | pending/processing/confirmed/failed |
| error_message | TEXT | 错误信息 |

## 安全考虑

1. **私钥安全**: 私钥从不存储，仅在需要时从助记词派生
2. **助记词加密**: 使用 AES-256-GCM 对称加密
3. **API认证**: 支持 API Key + HMAC 双重认证
4. **回调验证**: HMAC 签名验证回调真实性
5. **敏感配置**: 通过环境变量注入，不硬编码

## 扩展性

### 添加新链

1. 在 `src/services/chains/` 下创建新的链服务
2. 实现 `ChainService` 接口
3. 在 `src/services/chains/index.ts` 中注册
4. 更新类型定义和配置

### 添加新代币

1. 在配置中添加代币合约地址
2. 更新币种类型定义
3. 链服务已支持 ERC20/BEP20/TRC20 标准代币

## 监控建议

- 日志: Winston 日志框架，支持文件和控制台输出
- 健康检查: `/health` 端点
- 指标: 可扩展 Prometheus 指标
- 告警: 充值/提现失败告警
