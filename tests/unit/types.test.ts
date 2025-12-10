import {
  ChainType,
  CoinType,
  WalletAddress,
  Deposit,
  Withdrawal,
  GenerateAddressRequest,
  GenerateAddressResponse,
  WithdrawRequest,
  WithdrawResponse,
  BalanceRequest,
  BalanceResponse,
  TransactionInfo,
  CallbackData,
  ApiResponse,
} from '../../src/types';

describe('Type Definitions', () => {
  describe('ChainType', () => {
    it('should accept valid chain types', () => {
      const validChains: ChainType[] = ['BTC', 'ETH', 'BSC', 'TRX'];
      expect(validChains.length).toBe(4);
    });
  });

  describe('CoinType', () => {
    it('should accept valid coin types', () => {
      const validCoins: CoinType[] = [
        'BTC', 'ETH', 'BSC', 'TRX',
        'USDT_ERC20', 'USDT_BEP20', 'USDT_TRC20'
      ];
      expect(validCoins.length).toBe(7);
    });
  });

  describe('WalletAddress', () => {
    it('should have correct structure', () => {
      const walletAddress: WalletAddress = {
        id: 1,
        user_id: 'user123',
        chain: 'ETH',
        address: '0x123...',
        derivation_path: "m/44'/60'/0'/0/0",
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(walletAddress.id).toBe(1);
      expect(walletAddress.user_id).toBe('user123');
      expect(walletAddress.chain).toBe('ETH');
    });
  });

  describe('Deposit', () => {
    it('should have correct structure', () => {
      const deposit: Deposit = {
        id: 1,
        user_id: 'user123',
        chain: 'ETH',
        coin: 'ETH',
        address: '0x123...',
        tx_hash: '0xabc...',
        amount: '1.5',
        confirmations: 12,
        status: 'confirmed',
        callback_status: 'success',
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(deposit.status).toBe('confirmed');
      expect(deposit.callback_status).toBe('success');
    });

    it('should accept all valid status values', () => {
      const statuses: Deposit['status'][] = ['pending', 'confirmed', 'failed'];
      expect(statuses.length).toBe(3);

      const callbackStatuses: Deposit['callback_status'][] = ['pending', 'success', 'failed'];
      expect(callbackStatuses.length).toBe(3);
    });
  });

  describe('Withdrawal', () => {
    it('should have correct structure', () => {
      const withdrawal: Withdrawal = {
        id: 1,
        user_id: 'user123',
        chain: 'ETH',
        coin: 'ETH',
        from_address: '0x123...',
        to_address: '0x456...',
        amount: '0.5',
        fee: '0.001',
        tx_hash: '0xdef...',
        status: 'confirmed',
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      expect(withdrawal.status).toBe('confirmed');
    });

    it('should accept all valid status values', () => {
      const statuses: Withdrawal['status'][] = ['pending', 'processing', 'confirmed', 'failed'];
      expect(statuses.length).toBe(4);
    });
  });

  describe('Request/Response types', () => {
    it('GenerateAddressRequest should have correct structure', () => {
      const request: GenerateAddressRequest = {
        user_id: 'user123',
        chain: 'ETH',
      };

      expect(request.user_id).toBe('user123');
      expect(request.chain).toBe('ETH');
    });

    it('GenerateAddressResponse should have correct structure', () => {
      const response: GenerateAddressResponse = {
        user_id: 'user123',
        chain: 'ETH',
        address: '0x123...',
      };

      expect(response.address).toBe('0x123...');
    });

    it('WithdrawRequest should have correct structure', () => {
      const request: WithdrawRequest = {
        user_id: 'user123',
        chain: 'ETH',
        coin: 'USDT_ERC20',
        to_address: '0x456...',
        amount: '100',
      };

      expect(request.coin).toBe('USDT_ERC20');
    });

    it('BalanceResponse should have correct structure', () => {
      const response: BalanceResponse = {
        address: '0x123...',
        chain: 'ETH',
        coin: 'USDT_ERC20',
        balance: '1000.00',
      };

      expect(response.balance).toBe('1000.00');
    });
  });

  describe('TransactionInfo', () => {
    it('should have correct structure', () => {
      const txInfo: TransactionInfo = {
        tx_hash: '0xabc...',
        from: '0x123...',
        to: '0x456...',
        amount: '1.5',
        confirmations: 12,
        block_number: 18000000,
        timestamp: Date.now(),
      };

      expect(txInfo.confirmations).toBe(12);
      expect(txInfo.block_number).toBe(18000000);
    });
  });

  describe('CallbackData', () => {
    it('should have correct structure for deposit callback', () => {
      const callback: CallbackData = {
        event: 'deposit_confirmed',
        data: {
          user_id: 'user123',
          chain: 'ETH',
          coin: 'ETH',
          address: '0x123...',
          amount: '1.5',
          tx_hash: '0xabc...',
          confirmations: 12,
        },
        timestamp: Date.now(),
        signature: 'hmac_signature',
      };

      expect(callback.event).toBe('deposit_confirmed');
    });

    it('should accept all valid event types', () => {
      const events: CallbackData['event'][] = [
        'deposit_confirmed',
        'withdrawal_confirmed',
        'withdrawal_failed',
      ];
      expect(events.length).toBe(3);
    });
  });

  describe('ApiResponse', () => {
    it('should handle success response', () => {
      const response: ApiResponse<{ address: string }> = {
        success: true,
        data: { address: '0x123...' },
      };

      expect(response.success).toBe(true);
      expect(response.data?.address).toBe('0x123...');
    });

    it('should handle error response', () => {
      const response: ApiResponse = {
        success: false,
        error: 'Something went wrong',
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe('Something went wrong');
    });
  });
});
