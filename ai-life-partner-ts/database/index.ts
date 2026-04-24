/**
 * 数据库统一访问层
 * 使用工厂模式支持多种数据库后端
 */

import { IDatabase, Statement } from './IDatabase';
import { DatabaseFactory, createDatabaseConfigFromEnv } from './DatabaseFactory';
import { logger } from '../utils/logger';

let db: IDatabase | null = null;

/**
 * 获取数据库实例（单例）
 */
export async function getDatabase(): Promise<IDatabase> {
  if (!db) {
    const config = createDatabaseConfigFromEnv();
    db = DatabaseFactory.create(config);
    await db.initialize();
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  // 用户表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      morning_push_enabled INTEGER DEFAULT 1,
      review_reminder_enabled INTEGER DEFAULT 1
    )
  `);

  // 用户画像表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS user_portraits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      industry TEXT,
      income_structure TEXT,
      resources TEXT,
      decision_style TEXT DEFAULT 'intuitive',
      stuck_points TEXT,
      procrastination_triggers TEXT,
      abilities TEXT,
      growth_track TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 目标表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      level TEXT NOT NULL,
      parent_id TEXT,
      description TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      success_signals TEXT,
      danger_signals TEXT,
      stop_loss_line TEXT,
      start_date TEXT,
      end_date TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE SET NULL
    )
  `);

  // 日常任务表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      weekly_goal_id TEXT,
      description TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (weekly_goal_id) REFERENCES goals(id) ON DELETE SET NULL
    )
  `);

  // 记忆表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5,
      recall_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 能力资产表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS ability_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 决策记录表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      essence TEXT,
      options TEXT,
      chosen TEXT NOT NULL,
      reason TEXT,
      expected_outcome TEXT,
      actual_outcome TEXT,
      deviation TEXT,
      lesson_learned TEXT,
      status TEXT DEFAULT 'pending',
      verify_date TEXT,
      reminded INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 认知挑战表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      related_ability TEXT,
      difficulty TEXT DEFAULT 'medium',
      user_answer TEXT,
      score INTEGER,
      evaluation TEXT,
      ability_adjustment INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      answered_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 复盘记录表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 对话历史表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 会话表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_history TEXT,
      current_focus TEXT,
      has_pending_challenge INTEGER DEFAULT 0,
      has_pending_decision_review INTEGER DEFAULT 0,
      pending_decision_id TEXT,
      summary TEXT,
      summary_updated_at TEXT,
      last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Token 使用记录表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      endpoint TEXT,
      cost REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 速率限制表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      identifier TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0,
      reset_at INTEGER NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.info('[Database] 数据库表结构已初始化');
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// 导出工厂和配置
export { DatabaseFactory, createDatabaseConfigFromEnv } from './DatabaseFactory';
export { IDatabase, Statement, DatabaseConfig } from './IDatabase';

// 导出迁移函数
export { runMigrations } from './migrations';
