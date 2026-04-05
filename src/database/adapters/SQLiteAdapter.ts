/**
 * SQLite 数据库实现
 */

import Database from 'better-sqlite3';
import { IDatabase, DatabaseResult, Statement, DatabaseTransaction } from '../IDatabase';
import { logger } from '../../utils/logger';

/**
 * SQLite 准备语句包装器
 */
class SQLiteStatement implements Statement {
  private stmt: Database.Statement;

  constructor(stmt: Database.Statement) {
    this.stmt = stmt;
  }

  async run(...params: any[]): Promise<DatabaseResult> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.stmt.run(...params);
        resolve({
          affectedRows: result.changes,
          changes: result.changes,
          insertedId: result.lastInsertRowid?.toString(),
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async get(...params: any[]): Promise<any> {
    return this.stmt.get(...params) || null;
  }

  async all(...params: any[]): Promise<any[]> {
    return this.stmt.all(...params) || [];
  }
}

/**
 * SQLite 数据库实现
 */
export class SQLiteAdapter implements IDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('foreign_keys = ON');
        this.db.pragma('journal_mode = WAL');
        logger.info('[Database] SQLite 数据库已连接', { path: this.dbPath });
        resolve();
      } catch (error) {
        logger.error('[Database] SQLite 连接失败', error);
        reject(error);
      }
    });
  }

  async execute(sql: string, params?: any[]): Promise<DatabaseResult> {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db!.prepare(sql);
        const result = params ? stmt.run(...params) : stmt.run();
        resolve({
          affectedRows: result.changes,
          changes: result.changes,
          insertedId: result.lastInsertRowid?.toString(),
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  prepare(sql: string): Statement {
    return new SQLiteStatement(this.db!.prepare(sql));
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const stmt = this.prepare(sql);
    return await stmt.get(...(params || []));
  }

  async queryMany<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.prepare(sql);
    return await stmt.all(...(params || []));
  }

  async insert(sql: string, params?: any[]): Promise<string | number> {
    const result = await this.execute(sql, params);
    return result.insertedId || 0;
  }

  async update(sql: string, params?: any[]): Promise<number> {
    const result = await this.execute(sql, params);
    return result.affectedRows || result.changes || 0;
  }

  async delete(sql: string, params?: any[]): Promise<number> {
    const result = await this.execute(sql, params);
    return result.affectedRows || result.changes || 0;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db!.transaction(() => {
        fn().then(resolve).catch(reject);
      })();
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('[Database] SQLite 数据库连接已关闭');
    }
  }
}
