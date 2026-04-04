/**
 * 记忆数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

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

export class MemoryRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建记忆
   */
  create(input: CreateMemoryInput): Memory {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO memories (id, user_id, type, content, importance, recall_count, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      id,
      input.user_id,
      input.type,
      input.content,
      input.importance || 5,
      input.expires_at || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * 查找记忆
   */
  findById(id: string): Memory | null {
    return this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Memory | null;
  }

  /**
   * 获取用户的所有记忆
   */
  findByUser(userId: string): Memory[] {
    return this.db.prepare(
      'SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC'
    ).all(userId) as Memory[];
  }

  /**
   * 按类型获取记忆
   */
  findByType(userId: string, type: Memory['type']): Memory[] {
    return this.db.prepare(
      'SELECT * FROM memories WHERE user_id = ? AND type = ? ORDER BY created_at DESC'
    ).all(userId, type) as Memory[];
  }

  /**
   * 搜索记忆（按内容关键词）
   */
  search(userId: string, keywords: string[]): Memory[] {
    if (keywords.length === 0) return [];

    const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
    const params = [userId, ...keywords.map(k => `%${k}%`)];

    return this.db.prepare(`
      SELECT * FROM memories
      WHERE user_id = ? AND (${conditions})
      ORDER BY importance DESC, recall_count DESC
    `).all(...params) as Memory[];
  }

  /**
   * 增加记忆召回次数
   */
  incrementRecall(id: string): void {
    this.db.prepare(`
      UPDATE memories
      SET recall_count = recall_count + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 更新记忆重要性
   */
  updateImportance(id: string, importance: number): void {
    this.db.prepare(`
      UPDATE memories
      SET importance = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(Math.min(10, Math.max(1, importance)), id);
  }

  /**
   * 删除记忆
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * 删除过期记忆
   */
  deleteExpired(): number {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      DELETE FROM memories
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `).run(now);
    return result.changes;
  }
}
