/**
 * 错误处理系统
 * 定义统一的错误类型和错误处理函数
 */

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN = 'UNKNOWN',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // AI 服务错误
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE',

  // 用户相关
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_INVALID_INPUT = 'USER_INVALID_INPUT',

  // 目标相关
  GOAL_NOT_FOUND = 'GOAL_NOT_FOUND',
  GOAL_INVALID = 'GOAL_INVALID',

  // 记忆相关
  MEMORY_NOT_FOUND = 'MEMORY_NOT_FOUND',
  MEMORY_INVALID = 'MEMORY_INVALID',

  // 资产相关
  ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
  ASSET_INVALID = 'ASSET_INVALID',

  // 决策相关
  DECISION_NOT_FOUND = 'DECISION_NOT_FOUND',
  DECISION_INVALID = 'DECISION_INVALID',

  // 飞书相关
  FEISHU_ERROR = 'FEISHU_ERROR',
  FEISHU_SIGNATURE_INVALID = 'FEISHU_SIGNATURE_INVALID',

  // 验证相关
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // 资源未找到（通用）
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly meta?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    statusCode: number = 500,
    isOperational: boolean = true,
    meta?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.meta = meta;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessError extends AppError {
  constructor(message: string, code?: ErrorCode, meta?: Record<string, any>) {
    super(message, code, 400, true, meta);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, meta);
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} not found: ${id}`
      : `${resource} not found`;
    super(message, ErrorCode.RESOURCE_NOT_FOUND, 404, true);
  }
}

/**
 * AI 服务错误
 */
export class AIServiceError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, ErrorCode.AI_SERVICE_ERROR, 503, false, meta);
  }
}

/**
 * 速率限制错误
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      'Rate limit exceeded',
      ErrorCode.AI_RATE_LIMIT,
      429,
      true,
      { retryAfter }
    );
  }
}

/**
 * 飞书相关错误
 */
export class FeishuError extends AppError {
  constructor(message: string, meta?: Record<string, any>) {
    super(message, ErrorCode.FEISHU_ERROR, 500, false, meta);
  }
}

/**
 * 内部服务器错误
 */
export class InternalError extends AppError {
  constructor(message?: string) {
    super(
      message || 'Internal server error',
      ErrorCode.INTERNAL_ERROR,
      500,
      false
    );
  }
}

/**
 * 错误处理中间件
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Express 错误处理中间件
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // 记录错误
  if (err instanceof AppError) {
    logger.warn(`[${err.code}] ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      meta: err.meta,
    });

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.meta && { meta: err.meta }),
      },
    });
  } else {
    // 未知错误
    logger.error('Unhandled error:', err);

    res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
      },
    });
  }
}

/**
 * 异步处理器包装器
 * 避免 try-catch 嵌套
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 安全执行函数
 * 返回 [error, result] 元组
 */
export async function safeExecute<T>(
  fn: () => Promise<T>
): Promise<[Error | null, T | null]> {
  try {
    const result = await fn();
    return [null, result];
  } catch (error) {
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}
