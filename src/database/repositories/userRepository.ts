/**
 * 用户数据仓库
 */

import path from 'path';
import { logger } from '../../utils/logger';
import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

const DB_PATH = path.join(__dirname, '../../data/app.db');

export interface User {
  id: string;
  open_id: string;
  created_at: string;
  updated_at: string;
  morning_push_enabled: boolean;
  review_reminder_enabled: boolean;
}

export interface CreateUserInput {
  open_id: string;
}

export class UserRepository {
  private db: DatabaseType;

  constructor() {
    // 确保 data 目录存在
    const fs = require('fs');
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 使用共享的数据库实例
    this.db = getDatabase();
  }

  /**
   * 创建或获取用户
   */
  findOrCreate(openId: string): User {
    const existing = this.db.prepare('SELECT * FROM users WHERE open_id = ?').get(openId) as User | undefined;
    if (existing) {
      return existing;
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.db.prepare(`
      INSERT INTO users (id, open_id, morning_push_enabled, review_reminder_enabled)
      VALUES (?, ?, 1, 1)
    `).run(id, openId);

    logger.info('[UserRepository] 创建新用户', { id, openId });

    return {
      id,
      open_id: openId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      morning_push_enabled: true,
      review_reminder_enabled: true,
    };
  }

  /**
   * 根据 ID 查找用户
   */
  findById(id: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
  }

  /**
   * 根据 open_id 查找用户
   */
  findByOpenId(openId: string): User | null {
    return this.db.prepare('SELECT * FROM users WHERE open_id = ?').get(openId) as User | null;
  }

  /**
   * 更新用户设置
   */
  updateSettings(id: string, settings: Partial<Pick<User, 'morning_push_enabled' | 'review_reminder_enabled'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (settings.morning_push_enabled !== undefined) {
      fields.push('morning_push_enabled = ?');
      values.push(settings.morning_push_enabled ? 1 : 0);
    }

    if (settings.review_reminder_enabled !== undefined) {
      fields.push('review_reminder_enabled = ?');
      values.push(settings.review_reminder_enabled ? 1 : 0);
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);

      this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      logger.info('[UserRepository] 更新用户设置', { id, settings });
    }
  }

  /**
   * 获取所有用户
   */
  findAll(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  }

  /**
   * 获取启用早上推送的用户
   */
  findWithMorningPushEnabled(): User[] {
    return this.db.prepare('SELECT * FROM users WHERE morning_push_enabled = 1').all() as User[];
  }

  /**
   * 获取启用复盘提醒的用户
   */
  findWithReviewReminderEnabled(): User[] {
    return this.db.prepare('SELECT * FROM users WHERE review_reminder_enabled = 1').all() as User[];
  }

  /**
   * 删除用户
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
