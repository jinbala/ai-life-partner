/**
 * Repository 基类
 * 提供通用的数据库操作方法
 */

import { getDatabase } from './index';
import { IDatabase } from './IDatabase';
import { createDatabaseConfigFromEnv } from './DatabaseFactory';

/**
 * 获取当前数据库类型
 */
function getDbType(): 'sqlite' | 'mysql' {
  const config = createDatabaseConfigFromEnv();
  return config.type as 'sqlite' | 'mysql';
}

/**
 * 获取当前时间 SQL（兼容 SQLite 和 MySQL）
 */
export function getNowSql(): string {
  return getDbType() === 'sqlite' ? "datetime('now')" : 'NOW()';
}

/**
 * 通用 Repository 基类
 */
export abstract class BaseRepository {
  /**
   * 获取数据库实例
   */
  protected async getDb(): Promise<IDatabase> {
    return await getDatabase();
  }

  /**
   * 查询单行
   */
  protected async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const db = await this.getDb();
    return await db.queryOne<T>(sql, params);
  }

  /**
   * 查询多行
   */
  protected async queryMany<T>(sql: string, params?: any[]): Promise<T[]> {
    const db = await this.getDb();
    return await db.queryMany<T>(sql, params);
  }

  /**
   * 执行插入并返回 ID
   */
  protected async insert(sql: string, params?: any[]): Promise<string | number> {
    const db = await this.getDb();
    return await db.insert(sql, params);
  }

  /**
   * 执行 SQL（带参数）
   */
  protected async execute(sql: string, params?: any[]): Promise<any> {
    const db = await this.getDb();
    return await db.execute(sql, params);
  }

  /**
   * 执行更新
   */
  protected async runUpdate(sql: string, params?: any[]): Promise<number> {
    const db = await this.getDb();
    return await db.update(sql, params);
  }

  /**
   * 执行删除
   */
  protected async runDelete(sql: string, params?: any[]): Promise<number> {
    const db = await this.getDb();
    return await db.delete(sql, params);
  }

  /**
   * 执行事务
   */
  protected async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = await this.getDb();
    return await db.transaction(fn);
  }
}
