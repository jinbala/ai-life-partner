/**
 * 用户数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface User {
  id: string;
  open_id: string;
  created_at: string;
  updated_at: string;
  morning_push_enabled: number;
  review_reminder_enabled: number;
}

export interface CreateUserInput {
  open_id: string;
}

export class UserRepository extends BaseRepository {
  /**
   * 创建或获取用户
   */
  async findOrCreate(openId: string): Promise<User> {
    const existing = await this.queryOne<User>(
      'SELECT * FROM users WHERE open_id = ?',
      [openId]
    );

    if (existing) {
      return existing;
    }

    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.execute(
      `INSERT INTO users (id, open_id, morning_push_enabled, review_reminder_enabled, created_at, updated_at)
       VALUES (?, ?, 1, 1, ?, ?)`,
      [id, openId, now, now]
    );

    return await this.findById(id) as User;
  }

  /**
   * 根据 ID 查找用户
   */
  async findById(id: string): Promise<User | null> {
    return await this.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
  }

  /**
   * 根据 open_id 查找用户
   */
  async findByOpenId(openId: string): Promise<User | null> {
    return await this.queryOne<User>('SELECT * FROM users WHERE open_id = ?', [openId]);
  }

  /**
   * 更新用户设置
   */
  async updateSettings(
    id: string,
    settings: Partial<Pick<User, 'morning_push_enabled' | 'review_reminder_enabled'>>
  ): Promise<void> {
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
      fields.push(`updated_at = ${getNowSql()}`);
      values.push(id);

      await this.runUpdate(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
  }

  /**
   * 获取所有用户
   */
  async findAll(): Promise<User[]> {
    return await this.queryMany<User>('SELECT * FROM users ORDER BY created_at DESC');
  }

  /**
   * 获取启用早上推送的用户
   */
  async findWithMorningPushEnabled(): Promise<User[]> {
    return await this.queryMany<User>('SELECT * FROM users WHERE morning_push_enabled = 1');
  }

  /**
   * 获取启用复盘提醒的用户
   */
  async findWithReviewReminderEnabled(): Promise<User[]> {
    return await this.queryMany<User>('SELECT * FROM users WHERE review_reminder_enabled = 1');
  }

  /**
   * 删除用户
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM users WHERE id = ?', [id]);
    return result > 0;
  }
}
