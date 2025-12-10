import { Router, Request, Response } from 'express';
import { walletService } from '../services/wallet';
import { withdrawalService } from '../services/withdrawal';
import { depositService } from '../services/deposit';
import { ChainType, CoinType, ApiResponse } from '../types';
import logger from '../utils/logger';

const router = Router();

// 生成地址
router.post('/address', async (req: Request, res: Response) => {
  try {
    const { user_id, chain } = req.body;

    if (!user_id || !chain) {
      res.status(400).json({
        success: false,
        error: 'user_id and chain are required',
      } as ApiResponse);
      return;
    }

    // 验证链类型
    const validChains: ChainType[] = ['BTC', 'ETH', 'BSC', 'TRX'];
    if (!validChains.includes(chain)) {
      res.status(400).json({
        success: false,
        error: `Invalid chain. Must be one of: ${validChains.join(', ')}`,
      } as ApiResponse);
      return;
    }

    const result = await walletService.generateAddress(user_id, chain);

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error generating address:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取余额
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const { address, coin } = req.query;

    if (!address || !coin) {
      res.status(400).json({
        success: false,
        error: 'address and coin are required',
      } as ApiResponse);
      return;
    }

    // 验证币种
    const validCoins: CoinType[] = ['BTC', 'ETH', 'BSC', 'TRX', 'USDT_ERC20', 'USDT_BEP20', 'USDT_TRC20'];
    if (!validCoins.includes(coin as CoinType)) {
      res.status(400).json({
        success: false,
        error: `Invalid coin. Must be one of: ${validCoins.join(', ')}`,
      } as ApiResponse);
      return;
    }

    const result = await walletService.getBalance(address as string, coin as CoinType);

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取用户地址
router.get('/addresses/:user_id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;

    const addresses = await walletService.getUserAddresses(user_id);

    res.json({
      success: true,
      data: addresses,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting user addresses:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 提现
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { user_id, chain, coin, to_address, amount } = req.body;

    if (!user_id || !chain || !coin || !to_address || !amount) {
      res.status(400).json({
        success: false,
        error: 'user_id, chain, coin, to_address, and amount are required',
      } as ApiResponse);
      return;
    }

    // 验证金额
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid amount',
      } as ApiResponse);
      return;
    }

    const result = await withdrawalService.createWithdrawal({
      user_id,
      chain,
      coin,
      to_address,
      amount,
    });

    res.json({
      success: true,
      data: result,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error creating withdrawal:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取提现记录
router.get('/withdrawals/:user_id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const withdrawals = await withdrawalService.getUserWithdrawals(user_id, limit);

    res.json({
      success: true,
      data: withdrawals,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting withdrawals:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取提现详情
router.get('/withdrawal/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const withdrawal = await withdrawalService.getWithdrawal(parseInt(id, 10));

    if (!withdrawal) {
      res.status(404).json({
        success: false,
        error: 'Withdrawal not found',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: withdrawal,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting withdrawal:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取充值记录
router.get('/deposits/:user_id', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.params;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const deposits = await depositService.getUserDeposits(user_id, limit);

    res.json({
      success: true,
      data: deposits,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting deposits:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 获取充值详情
router.get('/deposit/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deposit = await depositService.getDeposit(parseInt(id, 10));

    if (!deposit) {
      res.status(404).json({
        success: false,
        error: 'Deposit not found',
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: deposit,
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting deposit:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

// 资金归集
router.post('/consolidate', async (req: Request, res: Response) => {
  try {
    const { user_id, chain, coin } = req.body;

    if (!user_id || !chain || !coin) {
      res.status(400).json({
        success: false,
        error: 'user_id, chain, and coin are required',
      } as ApiResponse);
      return;
    }

    const txHash = await withdrawalService.consolidateFunds(user_id, chain, coin);

    res.json({
      success: true,
      data: { tx_hash: txHash },
      message: txHash ? 'Consolidation initiated' : 'No funds to consolidate',
    } as ApiResponse);
  } catch (error) {
    logger.error('Error consolidating funds:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    } as ApiResponse);
  }
});

export default router;
