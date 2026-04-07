/**
 * 复盘记录数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

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

export class ReviewRepository extends BaseRepository {
  /**
   * 创建复盘记录
   */
  async create(input: CreateReviewInput): Promise<Review> {
    const id = `review_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.execute(`
      INSERT INTO reviews (id, user_id, type, period_start, period_end, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ${getNowSql()})
    `, [
      id,
      input.user_id,
      input.type,
      input.period_start || null,
      input.period_end || null,
      input.content
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找复盘记录
   */
  async findById(id: string): Promise<Review | null> {
    return await this.queryOne<Review>('SELECT * FROM reviews WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有复盘记录
   */
  async findByUser(userId: string): Promise<Review[]> {
    return await this.queryMany<Review>('SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  /**
   * 按类型获取复盘记录
   */
  async findByType(userId: string, type: Review['type']): Promise<Review[]> {
    return await this.queryMany<Review>('SELECT * FROM reviews WHERE user_id = ? AND type = ? ORDER BY created_at DESC', [userId, type]);
  }

  /**
   * 获取指定日期范围内的复盘
   */
  async findByPeriod(userId: string, startDate: string, endDate: string): Promise<Review[]> {
    return await this.queryMany<Review>(`
      SELECT * FROM reviews
      WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `, [userId, startDate, endDate]);
  }

  /**
   * 获取最近的复盘
   */
  async findRecent(userId: string, type: Review['type'], limit: number = 5): Promise<Review[]> {
    return await this.queryMany<Review>(`
      SELECT * FROM reviews
      WHERE user_id = ? AND type = ?
      ORDER BY created_at DESC
      LIMIT ?
    `, [userId, type, limit]);
  }

  /**
   * 删除复盘记录
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM reviews WHERE id = ?', [id]);
    return result > 0;
  }

  /**
   * 更新复盘记录
   */
  async update(id: string, content: string): Promise<Review | null> {
    await this.runUpdate(
      `UPDATE reviews SET content = ? WHERE id = ?`,
      [content, id]
    );
    return await this.findById(id);
  }
}
