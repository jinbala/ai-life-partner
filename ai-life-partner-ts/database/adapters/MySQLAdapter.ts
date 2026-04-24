/**
 * MySQL 数据库实现
 */

import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { IDatabase, DatabaseResult, Statement, DatabaseConfig } from '../IDatabase';
import { logger } from '../../utils/logger';

/**
 * MySQL 准备语句包装器
 */
class MySQLStatement implements Statement {
  private connection: PoolConnection;
  private sql: string;

  constructor(connection: PoolConnection, sql: string) {
    this.connection = connection;
    this.sql = sql;
  }

  async run(...params: any[]): Promise<DatabaseResult> {
    const [result] = await this.connection.execute(this.sql, params);
    const rs = result as ResultSetHeader;
    return {
      affectedRows: rs.affectedRows,
      insertedId: rs.insertId,
      changes: rs.affectedRows,
    };
  }

  async get(...params: any[]): Promise<any> {
    const [rows] = await this.connection.execute(this.sql, params);
    const results = rows as RowDataPacket[];
    return results[0] || null;
  }

  async all(...params: any[]): Promise<any[]> {
    const [rows] = await this.connection.execute(this.sql, params);
    return rows as RowDataPacket[];
  }
}

/**
 * MySQL 数据库实现
 */
export class MySQLAdapter implements IDatabase {
  private pool: Pool | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      user: this.config.user || 'root',
      password: this.config.password || '',
      database: this.config.name || 'ai_life_partner',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      charset: 'utf8mb4',
    });

    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      logger.info('[Database] MySQL 数据库已连接', this.config);
    } catch (error) {
      logger.error('[Database] MySQL 连接失败', error);
      throw error;
    }
  }

  async execute(sql: string, params?: any[]): Promise<DatabaseResult> {
    if (!this.pool) throw new Error('Database not initialized');
    const [result] = await this.pool.execute(sql, params);
    const rs = result as ResultSetHeader;
    return {
      affectedRows: rs.affectedRows,
      changes: rs.affectedRows,
      insertedId: rs.insertId,
    };
  }

  prepare(sql: string): Statement {
    if (!this.pool) throw new Error('Database not initialized');
    // MySQL 需要获取连接来创建 statement
    const connection = this.pool.getConnection();
    return new MySQLStatement(connection as any, sql);
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    if (!this.pool) throw new Error('Database not initialized');
    const [rows] = await this.pool.execute(sql, params);
    const results = rows as any[];
    return results[0] as T | null;
  }

  async queryMany<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) throw new Error('Database not initialized');
    const [rows] = await this.pool.execute(sql, params);
    return rows as any[] as T[];
  }

  async insert(sql: string, params?: any[]): Promise<string | number> {
    if (!this.pool) throw new Error('Database not initialized');
    const [result] = await this.pool.execute(sql, params);
    const rs = result as ResultSetHeader;
    return rs.insertId || 0;
  }

  async update(sql: string, params?: any[]): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');
    const [result] = await this.pool.execute(sql, params);
    const rs = result as ResultSetHeader;
    return rs.affectedRows || 0;
  }

  async delete(sql: string, params?: any[]): Promise<number> {
    if (!this.pool) throw new Error('Database not initialized');
    const [result] = await this.pool.execute(sql, params);
    const rs = result as ResultSetHeader;
    return rs.affectedRows || 0;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error('Database not initialized');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await fn();
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('[Database] MySQL 数据库连接已关闭');
    }
  }
}
