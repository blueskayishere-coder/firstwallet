import * as bip39 from 'bip39';
import { getMnemonicManager } from '../services/crypto/encryption';
import logger from '../utils/logger';

async function generateMnemonic() {
  console.log('Generating new mnemonic phrase...\n');

  // 生成24词助记词（256位熵）
  const mnemonic = bip39.generateMnemonic(256);

  console.log('========================================');
  console.log('IMPORTANT: Save this mnemonic securely!');
  console.log('========================================\n');
  console.log('Mnemonic phrase:');
  console.log(mnemonic);
  console.log('\n========================================');
  console.log('This is the ONLY time you will see this!');
  console.log('========================================\n');

  // 验证助记词
  if (!bip39.validateMnemonic(mnemonic)) {
    console.error('Error: Generated mnemonic is invalid');
    process.exit(1);
  }

  // 加密保存
  try {
    const manager = getMnemonicManager();
    await manager.saveMnemonic(mnemonic);
    console.log('Mnemonic has been encrypted and saved successfully.');
    console.log('Location: data/mnemonic.enc');
  } catch (error) {
    console.error('Failed to save mnemonic:', error);
    process.exit(1);
  }
}

// 如果是从现有助记词导入
async function importMnemonic(mnemonic: string) {
  if (!bip39.validateMnemonic(mnemonic)) {
    console.error('Error: Invalid mnemonic phrase');
    process.exit(1);
  }

  try {
    const manager = getMnemonicManager();
    await manager.saveMnemonic(mnemonic);
    console.log('Mnemonic has been imported and encrypted successfully.');
  } catch (error) {
    console.error('Failed to import mnemonic:', error);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);

  if (args[0] === 'import' && args[1]) {
    // 导入现有助记词
    await importMnemonic(args.slice(1).join(' '));
  } else if (args[0] === 'import') {
    console.log('Usage: npm run generate-mnemonic import "word1 word2 ... word24"');
    process.exit(1);
  } else {
    // 生成新助记词
    await generateMnemonic();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
