import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import logger from '../../utils/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export class EncryptionService {
  private key: Buffer;

  constructor(encryptionKey: string) {
    // 从密码派生密钥
    const salt = crypto.createHash('sha256').update('wallet-service-salt').digest();
    this.key = crypto.pbkdf2Sync(encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export class MnemonicManager {
  private encryptionService: EncryptionService;
  private mnemonic: string | null = null;
  private mnemonicPath: string;

  constructor() {
    if (!config.encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required');
    }
    this.encryptionService = new EncryptionService(config.encryptionKey);
    this.mnemonicPath = config.mnemonicPath;
  }

  async initialize(): Promise<void> {
    try {
      if (fs.existsSync(this.mnemonicPath)) {
        const encrypted = fs.readFileSync(this.mnemonicPath, 'utf8');
        this.mnemonic = this.encryptionService.decrypt(encrypted);
        logger.info('Mnemonic loaded from encrypted file');
      } else {
        logger.warn('No mnemonic file found. Please generate one using the generate-mnemonic script');
      }
    } catch (error) {
      logger.error('Failed to load mnemonic:', error);
      throw error;
    }
  }

  getMnemonic(): string {
    if (!this.mnemonic) {
      throw new Error('Mnemonic not initialized');
    }
    return this.mnemonic;
  }

  async saveMnemonic(mnemonic: string): Promise<void> {
    const encrypted = this.encryptionService.encrypt(mnemonic);

    // 确保目录存在
    const dir = path.dirname(this.mnemonicPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.mnemonicPath, encrypted, 'utf8');
    this.mnemonic = mnemonic;
    logger.info('Mnemonic saved to encrypted file');
  }

  isInitialized(): boolean {
    return this.mnemonic !== null;
  }
}

// 单例
let mnemonicManager: MnemonicManager | null = null;

export function getMnemonicManager(): MnemonicManager {
  if (!mnemonicManager) {
    mnemonicManager = new MnemonicManager();
  }
  return mnemonicManager;
}

export default { EncryptionService, MnemonicManager, getMnemonicManager };
