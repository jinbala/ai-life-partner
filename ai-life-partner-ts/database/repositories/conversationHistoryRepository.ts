/**
 * 对话历史数据仓库
 */

import { BaseRepository } from '../BaseRepository';

export interface ConversationHistory {
  id: number;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export class ConversationHistoryRepository extends BaseRepository {
  /**
   * 获取用户指定日期的对话历史
   */
  async findByDate(userId: string, date: string): Promise<ConversationHistory[]> {
    return await this.queryMany<ConversationHistory>(
      `SELECT * FROM conversation_history
       WHERE user_id = ? AND DATE(created_at) = ?
       ORDER BY created_at ASC`,
      [userId, date]
    );
  }

  /**
   * 获取用户最近的对话历史
   */
  async findRecent(userId: string, limit: number = 50): Promise<ConversationHistory[]> {
    return await this.queryMany<ConversationHistory>(
      `SELECT * FROM conversation_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  }

  /**
   * 添加对话记录
   */
  async add(userId: string, role: string, content: string): Promise<void> {
    await this.execute(
      `INSERT INTO conversation_history (user_id, role, content) VALUES (?, ?, ?)`,
      [userId, role, content]
    );
  }

  /**
   * 删除用户指定日期之前的对话
   */
  async deleteBefore(userId: string, date: string): Promise<number> {
    const result = await this.runDelete(
      `DELETE FROM conversation_history WHERE user_id = ? AND DATE(created_at) < ?`,
      [userId, date]
    );
    return result;
  }
}
