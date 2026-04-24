/**
 * 认证中间件
 * 处理 API 认证和授权
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';
import { getDatabase } from '../../database';
import { getNowSql } from '../../database/BaseRepository';
import { jwtService, JwtTokenPayload } from '../../services/jwt';

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
 * 如果有 API 密钥或 JWT 令牌则验证，没有则跳过
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // 尝试 API Key 认证
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  if (expectedApiKey && apiKey === expectedApiKey) {
    req.auth = {
      userId: 'api_user',
      type: 'api_key',
      issuedAt: Date.now(),
    };
    req.userId = 'api_user';
    next();
    return;
  }

  // 尝试 JWT 令牌认证
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const payload = jwtService.verifyToken(token);
    if (payload) {
      req.auth = {
        userId: payload.userId,
        type: 'jwt',
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
      };
      req.userId = payload.userId;
    }
  }

  next();
}

/**
 * 会话认证中间件
 * 验证 JWT 令牌
 */
export function sessionAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '缺少认证令牌',
      },
    });
    return;
  }

  const payload = jwtService.verifyToken(token);

  if (!payload) {
    logger.warn('[Auth] JWT 验证失败', {
      ip: req.ip,
      hasToken: !!token,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效或已过期的令牌',
      },
    });
    return;
  }

  // 认证成功
  req.auth = {
    userId: payload.userId,
    type: 'jwt',
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };

  req.userId = payload.userId;
  next();
}

/**
 * JWT 令牌刷新端点
 */
export function refreshToken(req: Request, res: Response) {
  const { refreshToken: refreshTok } = req.body || {};

  if (!refreshTok) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: '缺少刷新令牌',
      },
    });
    return;
  }

  const result = jwtService.refreshAccessToken(refreshTok);

  if (!result) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效的刷新令牌',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  });
}

/**
 * 速率限制器（数据库存储版本）
 * 使用数据库进行持久化存储
 */
const rateLimitOptions = {
  windowMs: 60 * 1000, // 默认 1 分钟
  maxRequests: 100, // 默认 100 次/分钟
};

// 初始化速率限制表
async function initRateLimitTable() {
  try {
    const db = await getDatabase();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        identifier TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        reset_at INTEGER NOT NULL,
        updated_at TEXT DEFAULT ${getNowSql()}
      )
    `);
  } catch (error) {
    // 如果数据库不可用，回退到内存存储
    logger.debug('[RateLimit] 数据库初始化失败，使用内存存储');
  }
}

// 内存回退存储
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const windowMs = options?.windowMs || rateLimitOptions.windowMs;
  const maxRequests = options?.maxRequests || rateLimitOptions.maxRequests;
  const keyGenerator = options?.keyGenerator || ((req) => req.ip || 'unknown');

  // 尝试初始化数据库表
  initRateLimitTable();

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator(req);
    const now = Date.now();
    const resetAt = now + windowMs;

    let useDatabase = false;
    let record: { count: number; resetAt: number } | null = null;

    // 尝试使用数据库存储
    try {
      const db = await getDatabase();
      useDatabase = true;

      // 获取或创建记录
      const row = await db.queryOne<{ count: number; reset_at: number }>(
        'SELECT count, reset_at FROM rate_limits WHERE identifier = ?',
        [identifier]
      );

      if (row) {
        record = { count: row.count, resetAt: row.reset_at };
      }

      // 如果窗口已过期，重置计数
      if (!record || now > record.resetAt) {
        record = { count: 0, resetAt };
        await db.execute(
          'INSERT OR REPLACE INTO rate_limits (identifier, count, reset_at) VALUES (?, ?, ?)',
          [identifier, 0, resetAt]
        );
      }
    } catch (error) {
      // 数据库不可用，回退到内存存储
      useDatabase = false;
      let memRecord = rateLimitStore.get(identifier);
      if (!memRecord || now > memRecord.resetAt) {
        memRecord = { count: 0, resetAt };
        rateLimitStore.set(identifier, memRecord);
      }
      record = memRecord;
    }

    // 增加计数
    record!.count++;

    // 更新存储
    try {
      if (useDatabase) {
        const db = await getDatabase();
        await db.execute('UPDATE rate_limits SET count = ? WHERE identifier = ?', [record!.count, identifier]);
      }
    } catch (error) {
      // 忽略更新失败，继续使用内存中的计数
    }

    // 检查是否超出限制
    if (record!.count > maxRequests) {
      logger.warn('[RateLimit] 速率限制触发', {
        identifier,
        count: record!.count,
        limit: maxRequests,
        storage: useDatabase ? 'database' : 'memory',
      });

      res.setHeader('Retry-After', Math.ceil((record!.resetAt - now) / 1000));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁，请稍后再试（限制：${maxRequests} 次/${Math.floor(windowMs / 1000)}秒）`,
        },
      });
      return;
    }

    // 添加响应头显示当前限制状态
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record!.count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(record!.resetAt / 1000).toString());

    next();
  };
}
