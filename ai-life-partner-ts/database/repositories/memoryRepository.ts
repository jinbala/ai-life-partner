/**
 * 记忆数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface Memory {
  id: string;
  user_id: string;
  type: 'fact' | 'lesson' | 'preference' | 'event' | 'decision' | 'relationship';
  content: string;
  importance: number;
  recall_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryInput {
  user_id: string;
  type: Memory['type'];
  content: string;
  importance?: number;
  expires_at?: string;
}

export class MemoryRepository extends BaseRepository {
  /**
   * 创建记忆
   */
  async create(input: CreateMemoryInput): Promise<Memory> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.execute(`
      INSERT INTO memories (id, user_id, type, content, importance, recall_count, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `, [
      id,
      input.user_id,
      input.type,
      input.content,
      input.importance || 5,
      input.expires_at || null,
      now,
      now
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找记忆
   */
  async findById(id: string): Promise<Memory | null> {
    return await this.queryOne<Memory>('SELECT * FROM memories WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有记忆
   */
  async findByUser(userId: string): Promise<Memory[]> {
    return await this.queryMany<Memory>('SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC', [userId]);
  }

  /**
   * 按类型获取记忆
   */
  async findByType(userId: string, type: Memory['type']): Promise<Memory[]> {
    return await this.queryMany<Memory>('SELECT * FROM memories WHERE user_id = ? AND type = ? ORDER BY created_at DESC', [userId, type]);
  }

  /**
   * 搜索记忆（按内容关键词）
   */
  async search(userId: string, keywords: string[]): Promise<Memory[]> {
    if (keywords.length === 0) return [];

    const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
    const params = [userId, ...keywords.map(k => `%${k}%`)];

    return await this.queryMany<Memory>(`SELECT * FROM memories WHERE user_id = ? AND (${conditions}) ORDER BY importance DESC, recall_count DESC`, params);
  }

  /**
   * 增加记忆召回次数
   */
  async incrementRecall(id: string): Promise<void> {
    await this.runUpdate(`UPDATE memories SET recall_count = recall_count + 1, updated_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 更新记忆重要性
   */
  async updateImportance(id: string, importance: number): Promise<void> {
    await this.runUpdate(`UPDATE memories SET importance = ?, updated_at = ${getNowSql()} WHERE id = ?`, [Math.min(10, Math.max(1, importance)), id]);
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM memories WHERE id = ?', [id]);
    return result > 0;
  }

  /**
   * 删除过期记忆
   */
  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.runDelete('DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?', [now]);
    return result;
  }
}
