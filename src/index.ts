import express from 'express';
import { config } from './config';
import { getMnemonicManager } from './services/crypto/encryption';
import { depositService } from './services/deposit';
import { withdrawalService } from './services/withdrawal';
import { apiKeyAuth, combinedAuth } from './middleware/auth';
import walletRoutes from './routes/wallet';
import logger from './utils/logger';

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// 健康检查 (无需认证)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// API路由 (需要认证)
// 使用API Key认证，对于敏感操作可以使用combinedAuth
app.use('/api', apiKeyAuth, walletRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 启动服务
async function start() {
  try {
    // 初始化助记词管理器
    const mnemonicManager = getMnemonicManager();
    await mnemonicManager.initialize();

    if (!mnemonicManager.isInitialized()) {
      logger.error('Mnemonic not initialized. Please run: npm run generate-mnemonic');
      console.log('\n========================================');
      console.log('IMPORTANT: No mnemonic found!');
      console.log('Please run: npm run generate-mnemonic');
      console.log('========================================\n');
      // 在开发环境允许启动，但功能受限
      if (config.nodeEnv === 'production') {
        process.exit(1);
      }
    }

    // 启动充值监听服务
    depositService.start();

    // 启动提现处理服务
    withdrawalService.start();

    // 启动HTTP服务器
    app.listen(config.port, () => {
      logger.info(`Wallet service started on port ${config.port}`);
      console.log(`\n🚀 Multi-chain Wallet Service is running`);
      console.log(`   Port: ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   Supported chains: BTC, ETH, BSC, TRX`);
      console.log(`\n   API Endpoints:`);
      console.log(`   - POST /api/address      - Generate address`);
      console.log(`   - GET  /api/balance      - Get balance`);
      console.log(`   - POST /api/withdraw     - Create withdrawal`);
      console.log(`   - POST /api/consolidate  - Consolidate funds`);
      console.log(`   - GET  /api/deposits/:id - Get deposits`);
      console.log(`   - GET  /api/withdrawals/:id - Get withdrawals`);
      console.log(`\n   Health check: GET /health`);
    });
  } catch (error) {
    logger.error('Failed to start service:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down...');
  depositService.stop();
  withdrawalService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down...');
  depositService.stop();
  withdrawalService.stop();
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection:', reason);
});

// 启动
start();
