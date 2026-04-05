/**
 * JWT 服务
 * 处理 JSON Web Token 的生成和验证
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import { logger } from '../utils/logger';

/**
 * JWT Payload 接口
 */
export interface JwtTokenPayload {
  userId: string;
  type?: 'api_key' | 'session' | 'refresh';
  issuedAt: number;
  expiresAt?: number;
}

/**
 * JWT 配置
 */
interface JwtConfig {
  secret: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

/**
 * JWT 服务类
 */
export class JwtService {
  private config: JwtConfig;

  constructor() {
    const secret = process.env.JWT_SECRET || 'your-default-jwt-secret-change-in-production';

    if (secret === 'your-default-jwt-secret-change-in-production') {
      logger.warn('[JWT] 使用默认 JWT_SECRET，生产环境请务必修改');
    }

    this.config = {
      secret,
      accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
      refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    };
  }

  /**
   * 生成访问令牌
   */
  generateAccessToken(payload: JwtTokenPayload): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.accessTokenExpiresIn,
      issuer: 'ai-life-partner',
    } as any);
  }

  /**
   * 生成刷新令牌
   */
  generateRefreshToken(payload: JwtTokenPayload): string {
    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.refreshTokenExpiresIn,
      issuer: 'ai-life-partner',
    } as any);
  }

  /**
   * 生成令牌对（访问令牌 + 刷新令牌）
   */
  generateTokenPair(payload: JwtTokenPayload): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * 验证令牌
   */
  verifyToken(token: string): JwtTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.secret) as JwtPayload & JwtTokenPayload;
      return {
        userId: decoded.userId,
        type: decoded.type,
        issuedAt: decoded.issuedAt || Math.floor(Date.now() / 1000),
        expiresAt: decoded.exp ? decoded.exp * 1000 : undefined,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('[JWT] 令牌已过期');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('[JWT] 令牌无效');
      }
      return null;
    }
  }

  /**
   * 刷新访问令牌
   */
  refreshAccessToken(refreshToken: string): { accessToken: string } | null {
    const payload = this.verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      return null;
    }

    const newPayload: JwtTokenPayload = {
      userId: payload.userId,
      type: 'api_key',
      issuedAt: Date.now(),
    };

    return {
      accessToken: this.generateAccessToken(newPayload),
    };
  }

  /**
   * 解码令牌（不验证）
   */
  decodeToken(token: string): JwtTokenPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtTokenPayload | null;
      return decoded;
    } catch (error) {
      logger.debug('[JWT] 解码失败', error);
      return null;
    }
  }
}

// 导出单例
export const jwtService = new JwtService();
