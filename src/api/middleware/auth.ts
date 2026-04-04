/**
 * 认证中间件
 * 处理 API 认证和授权
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * 认证令牌接口
 */
export interface AuthToken {
  userId: string;
  type: 'api_key' | 'session' | 'jwt';
  issuedAt: number;
  expiresAt?: number;
}

/**
 * 扩展 Express Request 类型
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthToken;
      userId?: string;
    }
  }
}

/**
 * API Key 认证中间件
 * 验证 X-API-Key 请求头
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  // 如果没有配置 API 密钥，跳过认证（开发模式）
  const expectedApiKey = process.env.API_KEY;
  if (!expectedApiKey) {
    logger.debug('[Auth] API 密钥未配置，跳过认证');
    next();
    return;
  }

  // 验证 API 密钥
  if (!apiKey || apiKey !== expectedApiKey) {
    logger.warn('[Auth] API 密钥验证失败', {
      provided: !!apiKey,
      ip: req.ip,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效的 API 密钥',
      },
    });
    return;
  }

  // 认证成功
  req.auth = {
    userId: 'api_user',
    type: 'api_key',
    issuedAt: Date.now(),
  };

  next();
}

/**
 * 可选认证中间件
 * 如果有 API 密钥则验证，没有则跳过
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  if (expectedApiKey && apiKey === expectedApiKey) {
    req.auth = {
      userId: 'api_user',
      type: 'api_key',
      issuedAt: Date.now(),
    };
  }

  next();
}

/**
 * 会话认证中间件
 * 验证会话令牌
 */
export function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const sessionToken = req.headers['authorization']?.replace('Bearer ', '');

  if (!sessionToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '缺少认证令牌',
      },
    });
    return;
  }

  try {
    // 此处可以添加 JWT 验证逻辑
    // 目前简化处理：任何非空令牌都视为有效
    req.auth = {
      userId: sessionToken,
      type: 'session',
      issuedAt: Date.now(),
    };

    req.userId = sessionToken;
    next();
  } catch (error) {
    logger.error('[Auth] 会话验证失败', error as Error);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效的会话令牌',
      },
    });
  }
}

/**
 * 速率限制器（简化版）
 * 基于 IP 的简单速率限制
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
}) {
  const windowMs = options?.windowMs || 60 * 1000; // 默认 1 分钟
  const maxRequests = options?.maxRequests || 100; // 默认 100 次/分钟

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(ip);

    // 如果没有记录或窗口已过期，创建新记录
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(ip, record);
    }

    record.count++;

    // 检查是否超出限制
    if (record.count > maxRequests) {
      logger.warn('[Auth] 速率限制触发', {
        ip,
        count: record.count,
        limit: maxRequests,
      });

      res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁，请稍后再试（限制：${maxRequests} 次/分钟）`,
        },
      });
      return;
    }

    next();
  };
}
