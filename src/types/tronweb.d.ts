declare module 'tronweb' {
  interface TronWebConfig {
    fullHost?: string;
    fullNode?: string;
    solidityNode?: string;
    eventServer?: string;
    headers?: Record<string, string>;
    privateKey?: string;
  }

  interface TransactionResult {
    result: boolean;
    txid: string;
  }

  interface Transaction {
    raw_data?: {
      contract?: Array<{
        type: string;
        parameter?: {
          value: {
            owner_address: string;
            to_address: string;
            amount: number;
          };
        };
      }>;
    };
  }

  interface TransactionInfo {
    blockNumber?: number;
    blockTimeStamp?: number;
  }

  interface Block {
    block_header?: {
      raw_data?: {
        number?: number;
      };
    };
  }

  interface Contract {
    balanceOf(address: string): { call(): Promise<number> };
    decimals(): { call(): Promise<number> };
    transfer(to: string, amount: number): { send(options: Record<string, unknown>): Promise<string> };
  }

  interface AccountResources {
    freeNetLimit?: number;
    EnergyLimit?: number;
    freeNetUsed?: number;
    EnergyUsed?: number;
  }

  class TronWeb {
    constructor(config: TronWebConfig);

    address: {
      fromPrivateKey(privateKey: string): string;
      fromHex(hexAddress: string): string;
    };

    trx: {
      getBalance(address: string): Promise<number>;
      getTransaction(txHash: string): Promise<Transaction>;
      getTransactionInfo(txHash: string): Promise<TransactionInfo>;
      getCurrentBlock(): Promise<Block>;
      getAccount(address: string): Promise<unknown>;
      getAccountResources(address: string): Promise<AccountResources>;
      sign(transaction: unknown, privateKey: string): Promise<unknown>;
      sendRawTransaction(signedTransaction: unknown): Promise<TransactionResult>;
    };

    transactionBuilder: {
      sendTrx(to: string, amount: number, from: string): Promise<unknown>;
    };

    contract(): {
      at(address: string): Promise<Contract>;
    };

    setPrivateKey(privateKey: string): void;
  }

  export default TronWeb;
}
