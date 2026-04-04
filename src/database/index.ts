/**
 * 数据库连接管理
 * 使用 better-sqlite3 提供同步 SQLite 操作
 */

import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

const DB_PATH = path.join(__dirname, '../../data/app.db');

let db: Database.Database | null = null;

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // 启用外键约束
    db.pragma('foreign_keys = ON');
    // 启用 WAL 模式（更好的并发性能）
    db.pragma('journal_mode = WAL');
    logger.info('[Database] 数据库已连接', { path: DB_PATH });
  }
  return db;
}

/**
 * 初始化数据库表结构
 */
export function initializeDatabase(): void {
  const database = getDatabase();

  // 用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      open_id TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      morning_push_enabled INTEGER DEFAULT 1,
      review_reminder_enabled INTEGER DEFAULT 1
    )
  `);

  // 用户画像表
  database.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 目标表
  database.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `);

  // 日常任务表
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      weekly_goal_id TEXT,
      description TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (weekly_goal_id) REFERENCES goals(id) ON DELETE SET NULL
    )
  `);

  // 记忆表
  database.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance INTEGER DEFAULT 5,
      recall_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 能力资产表
  database.exec(`
    CREATE TABLE IF NOT EXISTS ability_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 决策记录表
  database.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 认知挑战表
  database.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      answered_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 复盘记录表
  database.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 对话历史表（可选，用于分析）
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 会话表
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      conversation_history TEXT,
      current_focus TEXT,
      has_pending_challenge INTEGER DEFAULT 0,
      has_pending_decision_review INTEGER DEFAULT 0,
      pending_decision_id TEXT,
      last_active_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, level);
    CREATE INDEX IF NOT EXISTS idx_tasks_user ON daily_tasks(user_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_assets_user ON ability_assets(user_id, type);
    CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_challenges_user ON challenges(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  `);

  logger.info('[Database] 数据库表结构已初始化');
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('[Database] 数据库连接已关闭');
  }
}

// 导出辅助函数
export { runMigrations } from './migrations';
