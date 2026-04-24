/**
 * 认证路由
 * 处理 JWT 令牌生成和刷新
 */

import { Router, Request, Response } from 'express';
import { jwtService } from '../../services/jwt';
import { validate, CreateTokenSchema } from '../../utils/validators';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /auth/login
 * 生成 JWT 令牌对
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const validation = validate(CreateTokenSchema, req.body);
    if (validation.error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
        },
      });
      return;
    }

    const { userId, type } = validation.data!;

    // 生成令牌对
    const tokens = jwtService.generateTokenPair({
      userId,
      type: type || 'api_key',
      issuedAt: Date.now(),
    });

    logger.info('[Auth] 令牌生成成功', {
      userId,
      type: type || 'api_key',
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
      },
    });
  } catch (error) {
    logger.error('[Auth] 令牌生成失败', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

/**
 * POST /auth/refresh
 * 刷新访问令牌
 */
router.post('/refresh', (req: Request, res: Response) => {
  try {
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
          message: '无效或已过期的刷新令牌',
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
  } catch (error) {
    logger.error('[Auth] 令牌刷新失败', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

/**
 * GET /auth/verify
 * 验证令牌有效性
 */
router.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: '缺少令牌',
      },
    });
    return;
  }

  const payload = jwtService.verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '无效或已过期的令牌',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      valid: true,
      userId: payload.userId,
      expiresAt: payload.expiresAt,
    },
  });
});

export { router as authRoutes };
