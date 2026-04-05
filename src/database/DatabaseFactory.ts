/**
 * 数据库工厂
 * 根据配置创建相应的数据库适配器
 */

import { IDatabase, DatabaseConfig } from './IDatabase';
import { SQLiteAdapter } from './adapters/SQLiteAdapter';
import { MySQLAdapter } from './adapters/MySQLAdapter';
import { logger } from '../utils/logger';

/**
 * 从环境变量创建数据库配置
 */
export function createDatabaseConfigFromEnv(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();

  if (dbType === 'mysql') {
    return {
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      name: process.env.DB_NAME || 'ai_life_partner',
    };
  }

  // 默认 SQLite
  const path = require('path');
  return {
    type: 'sqlite',
    database: path.join(__dirname, '../../data/app.db'),
  };
}

/**
 * 数据库工厂类
 */
export class DatabaseFactory {
  /**
   * 根据配置创建数据库适配器
   */
  static create(config?: DatabaseConfig): IDatabase {
    const dbConfig = config || createDatabaseConfigFromEnv();

    logger.info('[DatabaseFactory] 创建数据库适配器', { type: dbConfig.type });

    switch (dbConfig.type) {
      case 'mysql':
        return new MySQLAdapter(dbConfig);
      case 'sqlite':
        if (!dbConfig.database) {
          throw new Error('SQLite database path is required');
        }
        return new SQLiteAdapter(dbConfig.database);
      default:
        throw new Error(`Unsupported database type: ${dbConfig.type}`);
    }
  }
}
