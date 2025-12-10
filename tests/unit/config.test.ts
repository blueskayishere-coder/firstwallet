describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default values when env vars not set', () => {
    process.env.NODE_ENV = 'test';

    const { config } = require('../../src/config');

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test');
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(3306);
  });

  it('should load values from environment variables', () => {
    process.env.PORT = '4000';
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '3307';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpass';
    process.env.DB_NAME = 'testdb';

    const { config } = require('../../src/config');

    expect(config.port).toBe(4000);
    expect(config.database.host).toBe('db.example.com');
    expect(config.database.port).toBe(3307);
    expect(config.database.user).toBe('testuser');
    expect(config.database.password).toBe('testpass');
    expect(config.database.database).toBe('testdb');
  });

  it('should parse confirmation numbers correctly', () => {
    process.env.BTC_CONFIRMATIONS = '6';
    process.env.ETH_CONFIRMATIONS = '24';
    process.env.BSC_CONFIRMATIONS = '30';
    process.env.TRX_CONFIRMATIONS = '40';

    const { config } = require('../../src/config');

    expect(config.confirmations.BTC).toBe(6);
    expect(config.confirmations.ETH).toBe(24);
    expect(config.confirmations.BSC).toBe(30);
    expect(config.confirmations.TRX).toBe(40);
  });

  it('should have correct USDT contract addresses', () => {
    const { config } = require('../../src/config');

    expect(config.usdtContracts.ETH).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    expect(config.usdtContracts.BSC).toBe('0x55d398326f99059fF775485246999027B3197955');
    expect(config.usdtContracts.TRX).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  });
});
