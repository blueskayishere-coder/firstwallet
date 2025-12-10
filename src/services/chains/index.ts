import { BTCService } from './btc';
import { ETHService } from './eth';
import { BSCService } from './bsc';
import { TRXService } from './trx';
import { ChainService, ChainType } from '../../types';

export { BTCService, ETHService, BSCService, TRXService };

// 链服务工厂
const chainServices: Record<ChainType, ChainService> = {
  BTC: new BTCService(),
  ETH: new ETHService(),
  BSC: new BSCService(),
  TRX: new TRXService(),
};

export function getChainService(chain: ChainType): ChainService {
  const service = chainServices[chain];
  if (!service) {
    throw new Error(`Unsupported chain: ${chain}`);
  }
  return service;
}

export function getAllChainServices(): ChainService[] {
  return Object.values(chainServices);
}

export default { getChainService, getAllChainServices };
