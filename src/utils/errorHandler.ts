/**
 * 统一错误处理工具
 * 提供友好的用户错误消息和详细的日志记录
 */

import { logger } from './logger';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 通用错误
  UNKNOWN = 'UNKNOWN_ERROR',
  VALIDATION = 'VALIDATION_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  NETWORK = 'NETWORK_ERROR',

  // AI 相关错误
  AI_SERVICE = 'AI_SERVICE_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT_ERROR',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT_ERROR',

  // 数据库相关错误
  DATABASE = 'DATABASE_ERROR',
  DATABASE_LOCKED = 'DATABASE_LOCKED_ERROR',

  // 用户相关错误
  USER_NOT_FOUND = 'USER_NOT_FOUND_ERROR',
  USER_EXISTS = 'USER_EXISTS_ERROR',

  // 会话相关错误
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED_ERROR',

  // 权限相关错误
  UNAUTHORIZED = 'UNAUTHORIZED_ERROR',
  FORBIDDEN = 'FORBIDDEN_ERROR',
}

/**
 * 应用错误接口
 */
export interface AppError {
  type: ErrorType;
  message: string;        // 用户友好的消息
  details?: string;       // 详细错误信息（用于日志）
  statusCode?: number;    // HTTP 状态码
  recoverable?: boolean;  // 是否可恢复
}

/**
 * 创建应用错误
 */
export function createError(
  type: ErrorType,
  userMessage: string,
  details?: any,
  statusCode: number = 500,
  recoverable: boolean = false
): AppError {
  const error: AppError = {
    type,
    message: userMessage,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    statusCode,
    recoverable,
  };

  // 记录详细错误日志
  logger.error('[ErrorHandler]', {
    type: error.type,
    message: error.message,
    details: error.details,
    statusCode: error.statusCode,
  });

  return error;
}

/**
 * 将错误转换为字符串
 */
export function errorToString(error: AppError | Error | unknown): string {
  if (isAppError(error)) {
    return `${error.type}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 获取用户友好的错误消息
 */
export function getUserErrorMessage(error: AppError | Error | unknown): string {
  if (isAppError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    // 根据错误消息匹配友好提示
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return '网络连接失败，请检查网络设置后重试';
    }
    if (message.includes('timeout')) {
      return '请求超时，请稍后重试';
    }
    if (message.includes('rate limit')) {
      return '请求过于频繁，请稍后再试';
    }
    if (message.includes('unauthorized') || message.includes('auth')) {
      return '认证失败，请重新登录';
    }
    if (message.includes('not found')) {
      return '请求的资源不存在';
    }

    return '发生未知错误，请稍后重试';
  }

  return '发生错误，请稍后重试';
}

/**
 * 处理 Promise 错误
 * 用法：const [data, error] = await safe(someAsyncOperation());
 */
export async function safe<T>(
  promise: Promise<T>
): Promise<[T, null] | [null, AppError]> {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    const appError = toAppError(error);
    return [null, appError];
  }
}

/**
 * 将未知错误转换为应用错误
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // 网络错误
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return createError(
        ErrorType.NETWORK,
        '网络连接失败，请检查网络设置',
        error.message,
        503,
        true
      );
    }

    // 超时错误
    if (message.includes('timeout')) {
      return createError(
        ErrorType.TIMEOUT,
        '请求超时，请稍后重试',
        error.message,
        504,
        true
      );
    }

    // 数据库锁定
    if (message.includes('database') && message.includes('locked')) {
      return createError(
        ErrorType.DATABASE_LOCKED,
        '数据库繁忙，请稍后重试',
        error.message,
        503,
        true
      );
    }

    // 默认未知错误
    return createError(
      ErrorType.UNKNOWN,
      '发生未知错误，请稍后重试',
      error.message,
      500,
      false
    );
  }

  return createError(
    ErrorType.UNKNOWN,
    '发生未知错误，请稍后重试',
    String(error),
    500,
    false
  );
}

/**
 * 判断是否为应用错误
 */
function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error
  );
}

/**
 * 错误包装器
 * 用于包装现有函数，添加错误处理
 */
export function withErrorHandler<T extends (...args: any[]) => any>(
  fn: T,
  errorType: ErrorType,
  userMessage: string
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      throw createError(errorType, userMessage, error);
    }
  }) as T;
}

/**
 * 异步错误包装器
 */
export function withAsyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorType: ErrorType,
  userMessage: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      throw createError(errorType, userMessage, error);
    }
  }) as T;
}
