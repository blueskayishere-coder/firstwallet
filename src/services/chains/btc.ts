import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from 'bip39';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import axios from 'axios';
import { config } from '../../config';
import { getMnemonicManager } from '../crypto/encryption';
import { ChainService, TransactionInfo } from '../../types';
import logger from '../../utils/logger';

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// BIP44路径: m/44'/0'/0'/0/index (BTC)
const BTC_PATH_PREFIX = "m/44'/0'/0'/0";

export class BTCService implements ChainService {
  chain: 'BTC' = 'BTC';
  private network = bitcoin.networks.bitcoin;
  private apiUrl: string;

  constructor() {
    this.apiUrl = config.rpcEndpoints.BLOCKCYPHER;
  }

  async generateAddress(userId: string, index: number): Promise<{ address: string; path: string }> {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed, this.network);

    const path = `${BTC_PATH_PREFIX}/${index}`;
    const child = root.derivePath(path);

    // 生成 Native SegWit 地址 (bech32)
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(child.publicKey),
      network: this.network,
    });

    if (!address) {
      throw new Error('Failed to generate BTC address');
    }

    logger.info(`Generated BTC address for user ${userId}: ${address}`);

    return { address, path };
  }

  private async getPrivateKeyFromPath(derivationPath: string): Promise<Buffer> {
    const manager = getMnemonicManager();
    const mnemonic = manager.getMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed, this.network);
    const child = root.derivePath(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    return Buffer.from(child.privateKey);
  }

  async getBalance(address: string): Promise<string> {
    try {
      const url = `${this.apiUrl}/addrs/${address}/balance`;
      const params = config.blockcypherToken ? { token: config.blockcypherToken } : {};
      const response = await axios.get(url, { params });

      // 返回以BTC为单位的余额
      const balanceSatoshi = response.data.balance || 0;
      const balanceBTC = (balanceSatoshi / 1e8).toFixed(8);

      return balanceBTC;
    } catch (error) {
      logger.error(`Failed to get BTC balance for ${address}:`, error);
      throw error;
    }
  }

  async sendTransaction(fromPath: string, toAddress: string, amount: string): Promise<string> {
    try {
      const privateKey = await this.getPrivateKeyFromPath(fromPath);
      const keyPair = ECPair.fromPrivateKey(privateKey, { network: this.network });

      // 从derivation path获取地址
      const { address: fromAddress } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(keyPair.publicKey),
        network: this.network,
      });

      if (!fromAddress) {
        throw new Error('Failed to derive from address');
      }

      // 获取UTXO
      const utxoUrl = `${this.apiUrl}/addrs/${fromAddress}?unspentOnly=true`;
      const params = config.blockcypherToken ? { token: config.blockcypherToken } : {};
      const utxoResponse = await axios.get(utxoUrl, { params });

      const utxos = utxoResponse.data.txrefs || [];
      if (utxos.length === 0) {
        throw new Error('No UTXOs available');
      }

      const amountSatoshi = Math.floor(parseFloat(amount) * 1e8);

      // 构建交易
      const psbt = new bitcoin.Psbt({ network: this.network });

      let totalInput = 0;
      for (const utxo of utxos) {
        // 获取完整交易以获取witnessUtxo
        const txUrl = `${this.apiUrl}/txs/${utxo.tx_hash}?includeHex=true`;
        const txResponse = await axios.get(txUrl, { params });
        const txHex = txResponse.data.hex;

        const tx = bitcoin.Transaction.fromHex(txHex);
        const output = tx.outs[utxo.tx_output_n];

        psbt.addInput({
          hash: utxo.tx_hash,
          index: utxo.tx_output_n,
          witnessUtxo: {
            script: output.script,
            value: utxo.value,
          },
        });

        totalInput += utxo.value;
        if (totalInput >= amountSatoshi + 10000) break; // 留手续费
      }

      // 估算手续费 (简化处理)
      const estimatedFee = 5000; // 约 0.00005 BTC

      if (totalInput < amountSatoshi + estimatedFee) {
        throw new Error('Insufficient funds');
      }

      // 添加输出
      psbt.addOutput({
        address: toAddress,
        value: amountSatoshi,
      });

      // 找零
      const change = totalInput - amountSatoshi - estimatedFee;
      if (change > 546) { // 粉尘限制
        psbt.addOutput({
          address: fromAddress,
          value: change,
        });
      }

      // 签名所有输入
      for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();
      const rawTx = psbt.extractTransaction().toHex();

      // 广播交易
      const broadcastUrl = `${this.apiUrl}/txs/push`;
      const broadcastResponse = await axios.post(broadcastUrl, { tx: rawTx }, { params });

      const txHash = broadcastResponse.data.tx.hash;
      logger.info(`BTC transaction sent: ${txHash}`);

      return txHash;
    } catch (error) {
      logger.error('Failed to send BTC transaction:', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<TransactionInfo | null> {
    try {
      const url = `${this.apiUrl}/txs/${txHash}`;
      const params = config.blockcypherToken ? { token: config.blockcypherToken } : {};
      const response = await axios.get(url, { params });

      const tx = response.data;

      return {
        tx_hash: tx.hash,
        from: tx.inputs[0]?.addresses?.[0] || '',
        to: tx.outputs[0]?.addresses?.[0] || '',
        amount: (tx.outputs[0]?.value / 1e8).toString(),
        confirmations: tx.confirmations || 0,
        block_number: tx.block_height,
        timestamp: new Date(tx.received).getTime(),
      };
    } catch (error) {
      logger.error(`Failed to get BTC transaction ${txHash}:`, error);
      return null;
    }
  }

  async getTransactionsByAddress(address: string, startBlock?: number): Promise<TransactionInfo[]> {
    try {
      let url = `${this.apiUrl}/addrs/${address}/full`;
      const params: Record<string, unknown> = {};

      if (config.blockcypherToken) {
        params.token = config.blockcypherToken;
      }
      if (startBlock) {
        params.after = startBlock;
      }

      const response = await axios.get(url, { params });
      const txs = response.data.txs || [];

      return txs.map((tx: { hash: string; inputs: Array<{ addresses?: string[] }>; outputs: Array<{ addresses?: string[]; value: number }>; confirmations: number; block_height: number; received: string }) => ({
        tx_hash: tx.hash,
        from: tx.inputs[0]?.addresses?.[0] || '',
        to: tx.outputs[0]?.addresses?.[0] || '',
        amount: (tx.outputs[0]?.value / 1e8).toString(),
        confirmations: tx.confirmations || 0,
        block_number: tx.block_height,
        timestamp: new Date(tx.received).getTime(),
      }));
    } catch (error) {
      logger.error(`Failed to get BTC transactions for ${address}:`, error);
      return [];
    }
  }
}

export default BTCService;
