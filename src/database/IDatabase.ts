/**
 * 数据库接口定义
 * 所有数据库实现必须遵循此接口
 */

/**
 * 数据库查询结果基类
 */
export interface DatabaseResult {
  affectedRows?: number;
  insertedId?: string | number;
  changes?: number;
}

/**
 * 数据库事务接口
 */
export interface DatabaseTransaction {
  execute<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * 数据库准备语句接口
 */
export interface Statement {
  run(...params: any[]): Promise<DatabaseResult>;
  get(...params: any[]): Promise<any>;
  all(...params: any[]): Promise<any[]>;
}

/**
 * 数据库操作接口
 */
export interface IDatabase {
  /**
   * 初始化数据库
   */
  initialize(): Promise<void>;

  /**
   * 执行 SQL（带参数）
   */
  execute(sql: string, params?: any[]): Promise<DatabaseResult>;

  /**
   * 准备语句（可选，用于复杂查询）
   */
  prepare?(sql: string): Statement;

  /**
   * 查询单行
   */
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;

  /**
   * 查询多行
   */
  queryMany<T>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * 插入并返回 ID
   */
  insert(sql: string, params?: any[]): Promise<string | number>;

  /**
   * 更新
   */
  update(sql: string, params?: any[]): Promise<number>;

  /**
   * 删除
   */
  delete(sql: string, params?: any[]): Promise<number>;

  /**
   * 开启事务
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'mysql' | 'postgres';
  database?: string;        // SQLite 数据库路径
  host?: string;            // MySQL/Postgres 主机
  port?: number;            // MySQL/Postgres 端口
  user?: string;            // MySQL/Postgres 用户
  password?: string;        // MySQL/Postgres 密码
  name?: string;            // MySQL/Postgres 数据库名
}
