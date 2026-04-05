/**
 * 数据库并发控制工具
 * 提供事务包装器和乐观锁机制
 */

import Database from 'better-sqlite3';
import { getDatabase } from '../database';
import { logger } from '../utils/logger';

/**
 * 事务选项接口
 */
export interface TransactionOptions {
  timeout?: number; // 超时时间（毫秒）
  retries?: number; // 重试次数
  onRetry?: (attempt: number, error: Error) => void; // 重试回调
}

/**
 * 并发写入锁（基于内存）
 * 用于控制同一资源的并发写入
 */
class ConcurrencyLock {
  private locks = new Map<string, { acquired: boolean; queue: Array<() => void> }>();

  /**
   * 获取锁
   */
  async acquire(resourceId: string, timeoutMs: number = 5000): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const lock = this.locks.get(resourceId) || { acquired: false, queue: [] };
      this.locks.set(resourceId, lock);

      if (!lock.acquired) {
        lock.acquired = true;
        resolve(true);
        return;
      }

      // 超时处理
      const timeoutId = setTimeout(() => {
        const idx = lock.queue.indexOf(onAcquire);
        if (idx !== -1) {
          lock.queue.splice(idx, 1);
        }
        reject(new Error(`获取锁超时：${resourceId}`));
      }, timeoutMs);

      const onAcquire = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      lock.queue.push(onAcquire);
    });
  }

  /**
   * 释放锁
   */
  release(resourceId: string): void {
    const lock = this.locks.get(resourceId);
    if (!lock) return;

    lock.acquired = false;

    // 唤醒队列中的下一个请求
    const next = lock.queue.shift();
    if (next) {
      lock.acquired = true;
      next();
    } else {
      this.locks.delete(resourceId);
    }
  }
}

// 全局锁实例
const globalLock = new ConcurrencyLock();

/**
 * 执行事务（带重试机制）
 * better-sqlite3 是同步操作，但可以通过重试处理 BUSY 错误
 */
export function executeTransaction<T>(
  operation: (db: Database.Database) => T,
  options: TransactionOptions = {}
): T {
  const { timeout = 5000, retries = 3, onRetry } = options;

  const db = getDatabase();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // 开始事务
      const transaction = db.transaction(operation);
      return transaction(db);
    } catch (error: any) {
      lastError = error;

      // 如果是数据库繁忙错误，尝试重试
      if (error.message?.includes('SQLITE_BUSY') || error.code === 'SQLITE_BUSY') {
        logger.warn('[Database] 数据库繁忙，准备重试', {
          attempt,
          maxRetries: retries,
          error: error.message,
        });

        onRetry?.(attempt, error);

        // 等待一段时间后重试（指数退避）
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        Atomics.wait(new Int32Array(new ArrayBuffer(4)), 0, 0, delay);
        continue;
      }

      // 其他错误直接抛出
      throw error;
    }
  }

  throw lastError;
}

/**
 * 乐观锁：基于版本号的并发控制
 * 适用于有高并发写入场景的表
 */
export class OptimisticLock {
  /**
   * 检查并更新（带版本号比较）
   * @param tableName 表名
   * @param id 记录 ID
   * @param updateFn 更新函数，接收当前记录，返回要更新的字段
   * @param versionField 版本字段名，默认 'version'
   */
  static updateWithCheck<T extends { version?: number }>(
    tableName: string,
    id: string,
    updateFn: (record: T | null) => Partial<T>,
    versionField: string = 'version'
  ): boolean {
    const db = getDatabase();

    return executeTransaction(() => {
      // 获取当前记录
      const current = db
        .prepare(`SELECT * FROM ${tableName} WHERE id = ?`)
        .get(id) as T | undefined;

      if (!current) {
        logger.warn('[OptimisticLock] 记录不存在', { tableName, id });
        return false;
      }

      const currentVersion = (current as any)[versionField];
      const updates = updateFn(current as T);

      // 构建更新语句
      const setClause = Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(', ');

      // 如果有版本字段，递增版本号
      if (versionField && (current as any)[versionField] !== undefined) {
        updates[versionField] = currentVersion + 1;
      }

      const values = Object.values(updates);
      values.push(id);
      if (versionField) {
        values.push(currentVersion);
      }

      const result = db
        .prepare(
          `UPDATE ${tableName} SET ${setClause}${versionField ? `, updated_at = datetime('now')` : ''} WHERE id = ?${versionField ? ` AND ${versionField} = ?` : ''}`
        )
        .run(...values);

      if (result.changes === 0) {
        logger.warn('[OptimisticLock] 并发冲突，更新失败', {
          tableName,
          id,
          expectedVersion: currentVersion,
        });
        return false;
      }

      return true;
    });
  }

  /**
   * 带重试的乐观锁更新
   */
  static updateWithRetry<T extends { version?: number }>(
    tableName: string,
    id: string,
    updateFn: (record: T | null) => Partial<T>,
    maxRetries: number = 3,
    versionField: string = 'version'
  ): boolean {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.updateWithCheck(tableName, id, updateFn, versionField)) {
        return true;
      }

      if (attempt < maxRetries) {
        // 等待随机时间后重试（减少冲突概率）
        const delay = Math.floor(Math.random() * 100) + 50 * (attempt - 1);
        Atomics.wait(new Int32Array(new ArrayBuffer(4)), 0, 0, delay);
      }
    }

    logger.error('[OptimisticLock] 重试后仍失败', { tableName, id, maxRetries });
    return false;
  }
}

/**
 * 资源级锁：对特定资源加锁
 * 适用于需要串行化操作的场景
 */
export class ResourceLock {
  private resourceId: string;

  constructor(resourceId: string) {
    this.resourceId = resourceId;
  }

  /**
   * 获取锁
   */
  async acquire(timeoutMs?: number): Promise<void> {
    await globalLock.acquire(this.resourceId, timeoutMs);
    logger.debug('[ResourceLock] 锁已获取', { resourceId: this.resourceId });
  }

  /**
   * 释放锁
   */
  release(): void {
    globalLock.release(this.resourceId);
    logger.debug('[ResourceLock] 锁已释放', { resourceId: this.resourceId });
  }

  /**
   * 在锁保护下执行操作
   */
  async execute<T>(operation: () => T, timeoutMs?: number): Promise<T> {
    await this.acquire(timeoutMs);
    try {
      return operation();
    } finally {
      this.release();
    }
  }
}

/**
 * 创建资源锁
 */
export function createResourceLock(resourceId: string): ResourceLock {
  return new ResourceLock(resourceId);
}

/**
 * 数据库写操作包装器
 * 自动处理锁和重试
 */
export class DatabaseWriter {
  private resourceId: string;

  constructor(resourceId: string) {
    this.resourceId = resourceId;
  }

  /**
   * 执行写操作（带锁保护）
   */
  async write<T>(operation: () => T, timeoutMs: number = 5000): Promise<T> {
    const lock = createResourceLock(this.resourceId);
    return lock.execute(operation, timeoutMs);
  }

  /**
   * 执行事务性写操作
   */
  async transaction<T>(operation: (db: Database.Database) => T): Promise<T> {
    return this.write(() => executeTransaction(operation));
  }
}
