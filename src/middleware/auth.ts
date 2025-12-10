import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import logger from '../utils/logger';

// 扩展Request类型
declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
    }
  }
}

// API Key认证中间件
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key is required',
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    logger.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  req.apiKey = apiKey;
  next();
}

// HMAC签名验证中间件
export function hmacAuth(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-signature'] as string;
  const timestamp = req.headers['x-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({
      success: false,
      error: 'Signature and timestamp are required',
    });
    return;
  }

  // 检查时间戳有效性（5分钟内）
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
    res.status(401).json({
      success: false,
      error: 'Timestamp expired or invalid',
    });
    return;
  }

  // 验证签名
  const payload = JSON.stringify(req.body) + timestamp;
  const expectedSignature = crypto
    .createHmac('sha256', config.hmacSecret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn('Invalid HMAC signature');
    res.status(401).json({
      success: false,
      error: 'Invalid signature',
    });
    return;
  }

  next();
}

// 组合认证中间件
export function combinedAuth(req: Request, res: Response, next: NextFunction): void {
  apiKeyAuth(req, res, (err) => {
    if (err || res.headersSent) return;
    hmacAuth(req, res, next);
  });
}

export default { apiKeyAuth, hmacAuth, combinedAuth };
