/**
 * 日志中间件
 * 记录请求信息和性能指标
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, path, headers } = req;

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    const logContext = {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      userAgent: headers['user-agent'],
      ip: req.ip,
    };

    // 根据状态码选择日志级别
    if (statusCode >= 500) {
      logger.error('[HTTP] 服务器错误', logContext);
    } else if (statusCode >= 400) {
      logger.warn('[HTTP] 客户端错误', logContext);
    } else {
      logger.info('[HTTP] 请求完成', logContext);
    }
  });

  next();
}

/**
 * 请求 ID 中间件
 * 为每个请求生成唯一 ID，便于追踪
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // 添加到请求对象
  (req as any).requestId = requestId;

  // 添加到响应头
  res.setHeader('X-Request-Id', requestId);

  next();
}

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * 慢请求检测中间件
 * 检测并记录超过阈值的请求
 */
export function slowRequestDetector(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();
  const SLOW_THRESHOLD = 1000; // 1 秒

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > SLOW_THRESHOLD) {
      logger.warn('[HTTP] 慢请求 detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        threshold: `${SLOW_THRESHOLD}ms`,
      });
    }
  });

  next();
}
