/**
 * 复盘记录数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface Review {
  id: string;
  user_id: string;
  type: 'daily' | 'weekly' | 'monthly';
  period_start: string | null;
  period_end: string | null;
  content: string;
  created_at: string;
}

export interface CreateReviewInput {
  user_id: string;
  type: Review['type'];
  period_start?: string;
  period_end?: string;
  content: string;
}

export class ReviewRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建复盘记录
   */
  create(input: CreateReviewInput): Review {
    const id = `review_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.db.prepare(`
      INSERT INTO reviews (id, user_id, type, period_start, period_end, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      input.user_id,
      input.type,
      input.period_start || null,
      input.period_end || null,
      input.content
    );

    return this.findById(id)!;
  }

  /**
   * 查找复盘记录
   */
  findById(id: string): Review | null {
    return this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as Review | null;
  }

  /**
   * 获取用户的所有复盘记录
   */
  findByUser(userId: string): Review[] {
    return this.db.prepare(
      'SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Review[];
  }

  /**
   * 按类型获取复盘记录
   */
  findByType(userId: string, type: Review['type']): Review[] {
    return this.db.prepare(
      'SELECT * FROM reviews WHERE user_id = ? AND type = ? ORDER BY created_at DESC'
    ).all(userId, type) as Review[];
  }

  /**
   * 获取指定日期范围内的复盘
   */
  findByPeriod(userId: string, startDate: string, endDate: string): Review[] {
    return this.db.prepare(`
      SELECT * FROM reviews
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(userId, startDate, endDate) as Review[];
  }

  /**
   * 获取最近的复盘
   */
  findRecent(userId: string, type: Review['type'], limit: number = 5): Review[] {
    return this.db.prepare(`
      SELECT * FROM reviews
      WHERE user_id = ? AND type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, type, limit) as Review[];
  }

  /**
   * 删除复盘记录
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
