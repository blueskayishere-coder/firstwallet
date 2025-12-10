import { EncryptionService } from '../../src/services/crypto/encryption';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testKey = 'test-encryption-key-32-bytes-ok';

  beforeEach(() => {
    encryptionService = new EncryptionService(testKey);
  });

  describe('encrypt', () => {
    it('should encrypt a plain text string', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'Hello, World!';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2); // Due to random IV
    });

    it('should encrypt mnemonic phrase', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const encrypted = encryptionService.encrypt(mnemonic);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain('abandon');
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted text back to original', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should correctly decrypt mnemonic phrase', () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const encrypted = encryptionService.encrypt(mnemonic);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(mnemonic);
    });

    it('should throw error for invalid ciphertext format', () => {
      expect(() => {
        encryptionService.decrypt('invalid-ciphertext');
      }).toThrow('Invalid ciphertext format');
    });

    it('should throw error for tampered ciphertext', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);
      const parts = encrypted.split(':');
      parts[2] = 'tampered' + parts[2].slice(8); // Tamper with encrypted data

      expect(() => {
        encryptionService.decrypt(parts.join(':'));
      }).toThrow();
    });
  });

  describe('with different keys', () => {
    it('should not decrypt with wrong key', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);

      const wrongKeyService = new EncryptionService('wrong-key-32-bytes-is-required!');

      expect(() => {
        wrongKeyService.decrypt(encrypted);
      }).toThrow();
    });
  });
});
