// 测试环境设置
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-ok';
process.env.API_KEY = 'test-api-key';
process.env.HMAC_SECRET = 'test-hmac-secret';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'wallet_test';

// Mock winston to avoid log file creation during tests
jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
  };
});

// Global test timeout
jest.setTimeout(30000);
