import express from 'express';
import request from 'supertest';

// Mock logger first
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { apiKeyAuth } from '../../src/middleware/auth';
import walletRoutes from '../../src/routes/wallet';

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    apiKey: 'test-api-key',
    hmacSecret: 'test-hmac-secret',
    usdtContracts: {
      ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      BSC: '0x55d398326f99059fF775485246999027B3197955',
      TRX: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    },
    hotWallets: {
      BTC: '',
      ETH: '',
      BSC: '',
      TRX: '',
    },
    confirmations: {
      BTC: 3,
      ETH: 12,
      BSC: 15,
      TRX: 20,
    },
  },
}));

// Mock wallet service
jest.mock('../../src/services/wallet', () => ({
  walletService: {
    generateAddress: jest.fn().mockResolvedValue({
      user_id: 'user123',
      chain: 'ETH',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    }),
    getBalance: jest.fn().mockResolvedValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chain: 'ETH',
      coin: 'ETH',
      balance: '1.5',
    }),
    getUserAddresses: jest.fn().mockResolvedValue([
      {
        id: 1,
        user_id: 'user123',
        chain: 'ETH',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        derivation_path: "m/44'/60'/0'/0/0",
      },
    ]),
    getUserAddress: jest.fn().mockResolvedValue({
      id: 1,
      user_id: 'user123',
      chain: 'ETH',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    }),
  },
}));

// Mock withdrawal service
jest.mock('../../src/services/withdrawal', () => ({
  withdrawalService: {
    createWithdrawal: jest.fn().mockResolvedValue({
      withdrawal_id: 1,
      status: 'pending',
    }),
    getUserWithdrawals: jest.fn().mockResolvedValue([]),
    getWithdrawal: jest.fn().mockResolvedValue(null),
    consolidateFunds: jest.fn().mockResolvedValue(null),
  },
}));

// Mock deposit service
jest.mock('../../src/services/deposit', () => ({
  depositService: {
    getUserDeposits: jest.fn().mockResolvedValue([]),
    getDeposit: jest.fn().mockResolvedValue(null),
  },
}));

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', apiKeyAuth, walletRoutes);
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await request(app)
        .post('/api/address')
        .send({ user_id: 'user123', chain: 'ETH' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key is required');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'wrong-api-key')
        .send({ user_id: 'user123', chain: 'ETH' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    it('should accept requests with valid API key', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'test-api-key')
        .send({ user_id: 'user123', chain: 'ETH' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/address', () => {
    it('should generate address successfully', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'test-api-key')
        .send({ user_id: 'user123', chain: 'ETH' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe('user123');
      expect(response.body.data.chain).toBe('ETH');
      expect(response.body.data.address).toBeDefined();
    });

    it('should require user_id', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'test-api-key')
        .send({ chain: 'ETH' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('user_id');
    });

    it('should require chain', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'test-api-key')
        .send({ user_id: 'user123' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('chain');
    });

    it('should validate chain type', async () => {
      const response = await request(app)
        .post('/api/address')
        .set('X-API-Key', 'test-api-key')
        .send({ user_id: 'user123', chain: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid chain');
    });
  });

  describe('GET /api/balance', () => {
    it('should get balance successfully', async () => {
      const response = await request(app)
        .get('/api/balance')
        .set('X-API-Key', 'test-api-key')
        .query({ address: '0x1234567890abcdef1234567890abcdef12345678', coin: 'ETH' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBeDefined();
    });

    it('should require address', async () => {
      const response = await request(app)
        .get('/api/balance')
        .set('X-API-Key', 'test-api-key')
        .query({ coin: 'ETH' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require coin', async () => {
      const response = await request(app)
        .get('/api/balance')
        .set('X-API-Key', 'test-api-key')
        .query({ address: '0x123...' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate coin type', async () => {
      const response = await request(app)
        .get('/api/balance')
        .set('X-API-Key', 'test-api-key')
        .query({ address: '0x123...', coin: 'INVALID' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid coin');
    });
  });

  describe('GET /api/addresses/:user_id', () => {
    it('should get user addresses successfully', async () => {
      const response = await request(app)
        .get('/api/addresses/user123')
        .set('X-API-Key', 'test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/withdraw', () => {
    it('should create withdrawal successfully', async () => {
      const response = await request(app)
        .post('/api/withdraw')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: 'user123',
          chain: 'ETH',
          coin: 'ETH',
          to_address: '0xRecipient...',
          amount: '0.1',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.withdrawal_id).toBeDefined();
      expect(response.body.data.status).toBe('pending');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/withdraw')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: 'user123',
          chain: 'ETH',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate amount', async () => {
      const response = await request(app)
        .post('/api/withdraw')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: 'user123',
          chain: 'ETH',
          coin: 'ETH',
          to_address: '0xRecipient...',
          amount: '-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid amount');
    });
  });

  describe('GET /api/withdrawals/:user_id', () => {
    it('should get user withdrawals successfully', async () => {
      const response = await request(app)
        .get('/api/withdrawals/user123')
        .set('X-API-Key', 'test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/deposits/:user_id', () => {
    it('should get user deposits successfully', async () => {
      const response = await request(app)
        .get('/api/deposits/user123')
        .set('X-API-Key', 'test-api-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/withdrawal/:id', () => {
    it('should return 404 for non-existent withdrawal', async () => {
      const response = await request(app)
        .get('/api/withdrawal/99999')
        .set('X-API-Key', 'test-api-key');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Withdrawal not found');
    });
  });

  describe('GET /api/deposit/:id', () => {
    it('should return 404 for non-existent deposit', async () => {
      const response = await request(app)
        .get('/api/deposit/99999')
        .set('X-API-Key', 'test-api-key');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Deposit not found');
    });
  });

  describe('POST /api/consolidate', () => {
    it('should handle consolidation request', async () => {
      const response = await request(app)
        .post('/api/consolidate')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: 'user123',
          chain: 'ETH',
          coin: 'ETH',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('No funds to consolidate');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/consolidate')
        .set('X-API-Key', 'test-api-key')
        .send({
          user_id: 'user123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
