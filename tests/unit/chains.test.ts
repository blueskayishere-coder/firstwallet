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

// Mock tronweb
jest.mock('tronweb', () => {
  return jest.fn().mockImplementation(() => ({
    address: {
      fromPrivateKey: (key: string) => 'T' + key.substring(0, 33),
    },
    trx: {
      getBalance: jest.fn().mockResolvedValue(1000000),
    },
  }));
});

// Mock the mnemonic manager
jest.mock('../../src/services/crypto/encryption', () => ({
  getMnemonicManager: () => ({
    getMnemonic: () => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    isInitialized: () => true,
  }),
}));

// Mock axios for API calls
jest.mock('axios');

import { getChainService, getAllChainServices } from '../../src/services/chains';

describe('Chain Services', () => {
  describe('getChainService', () => {
    it('should return BTC service for BTC chain', () => {
      const service = getChainService('BTC');
      expect(service.chain).toBe('BTC');
    });

    it('should return ETH service for ETH chain', () => {
      const service = getChainService('ETH');
      expect(service.chain).toBe('ETH');
    });

    it('should return BSC service for BSC chain', () => {
      const service = getChainService('BSC');
      expect(service.chain).toBe('BSC');
    });

    it('should return TRX service for TRX chain', () => {
      const service = getChainService('TRX');
      expect(service.chain).toBe('TRX');
    });

    it('should throw error for unsupported chain', () => {
      expect(() => {
        getChainService('UNSUPPORTED' as any);
      }).toThrow('Unsupported chain: UNSUPPORTED');
    });
  });

  describe('getAllChainServices', () => {
    it('should return all 4 chain services', () => {
      const services = getAllChainServices();
      expect(services.length).toBe(4);

      const chains = services.map(s => s.chain);
      expect(chains).toContain('BTC');
      expect(chains).toContain('ETH');
      expect(chains).toContain('BSC');
      expect(chains).toContain('TRX');
    });
  });

  describe('BTCService', () => {
    it('should generate valid BTC address', async () => {
      const service = getChainService('BTC');
      const result = await service.generateAddress('user1', 0);

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('bc1')).toBe(true); // Native SegWit
      expect(result.path).toBe("m/44'/0'/0'/0/0");
    });

    it('should generate different addresses for different indexes', async () => {
      const service = getChainService('BTC');
      const result1 = await service.generateAddress('user1', 0);
      const result2 = await service.generateAddress('user1', 1);

      expect(result1.address).not.toBe(result2.address);
    });
  });

  describe('ETHService', () => {
    it('should generate valid ETH address', async () => {
      const service = getChainService('ETH');
      const result = await service.generateAddress('user1', 0);

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('0x')).toBe(true);
      expect(result.address.length).toBe(42);
      expect(result.path).toBe("m/44'/60'/0'/0/0");
    });

    it('should generate different addresses for different indexes', async () => {
      const service = getChainService('ETH');
      const result1 = await service.generateAddress('user1', 0);
      const result2 = await service.generateAddress('user1', 1);

      expect(result1.address).not.toBe(result2.address);
    });
  });

  describe('BSCService', () => {
    it('should generate valid BSC address', async () => {
      const service = getChainService('BSC');
      const result = await service.generateAddress('user1', 0);

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('0x')).toBe(true);
      expect(result.address.length).toBe(42);
      expect(result.path).toBe("m/44'/60'/0'/0/0");
    });

    it('should generate same address as ETH for same index (EVM compatible)', async () => {
      const ethService = getChainService('ETH');
      const bscService = getChainService('BSC');

      const ethResult = await ethService.generateAddress('user1', 0);
      const bscResult = await bscService.generateAddress('user1', 0);

      // BSC and ETH use the same derivation path
      expect(ethResult.address).toBe(bscResult.address);
    });
  });

  describe('TRXService', () => {
    it('should generate valid TRX address', async () => {
      const service = getChainService('TRX');
      const result = await service.generateAddress('user1', 0);

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('T')).toBe(true);
      expect(result.path).toBe("m/44'/195'/0'/0/0");
    });

    it('should generate different addresses for different indexes', async () => {
      const service = getChainService('TRX');
      const result1 = await service.generateAddress('user1', 0);
      const result2 = await service.generateAddress('user1', 1);

      expect(result1.address).not.toBe(result2.address);
    });
  });

  describe('Address derivation paths', () => {
    it('should use correct BIP44 paths for each chain', async () => {
      const btcService = getChainService('BTC');
      const ethService = getChainService('ETH');
      const bscService = getChainService('BSC');
      const trxService = getChainService('TRX');

      const btcResult = await btcService.generateAddress('user1', 5);
      const ethResult = await ethService.generateAddress('user1', 5);
      const bscResult = await bscService.generateAddress('user1', 5);
      const trxResult = await trxService.generateAddress('user1', 5);

      expect(btcResult.path).toBe("m/44'/0'/0'/0/5");
      expect(ethResult.path).toBe("m/44'/60'/0'/0/5");
      expect(bscResult.path).toBe("m/44'/60'/0'/0/5");
      expect(trxResult.path).toBe("m/44'/195'/0'/0/5");
    });
  });
});
