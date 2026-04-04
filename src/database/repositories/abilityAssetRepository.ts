/**
 * 能力资产数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface AbilityAsset {
  id: string;
  user_id: string;
  type: 'framework' | 'lesson' | 'sop' | 'insight' | 'resource';
  title: string;
  content: string;
  tags: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateAssetInput {
  user_id: string;
  type: AbilityAsset['type'];
  title: string;
  content: string;
  tags?: string[];
}

export class AbilityAssetRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建能力资产
   */
  create(input: CreateAssetInput): AbilityAsset {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.db.prepare(`
      INSERT INTO ability_assets (id, user_id, type, title, content, tags, usage_count, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL, datetime('now'))
    `).run(
      id,
      input.user_id,
      input.type,
      input.title,
      input.content,
      input.tags ? JSON.stringify(input.tags) : null
    );

    return this.findById(id)!;
  }

  /**
   * 查找资产
   */
  findById(id: string): AbilityAsset | null {
    return this.db.prepare('SELECT * FROM ability_assets WHERE id = ?').get(id) as AbilityAsset | null;
  }

  /**
   * 获取用户的所有资产
   */
  findByUser(userId: string): AbilityAsset[] {
    return this.db.prepare(
      'SELECT * FROM ability_assets WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as AbilityAsset[];
  }

  /**
   * 按类型获取资产
   */
  findByType(userId: string, type: AbilityAsset['type']): AbilityAsset[] {
    return this.db.prepare(
      'SELECT * FROM ability_assets WHERE user_id = ? AND type = ? ORDER BY created_at DESC'
    ).all(userId, type) as AbilityAsset[];
  }

  /**
   * 搜索资产（按标题或内容）
   */
  search(userId: string, keywords: string[]): AbilityAsset[] {
    if (keywords.length === 0) return [];

    const conditions = keywords.map(k => '(title LIKE ? OR content LIKE ?)').join(' OR ');
    const params = [userId, ...keywords.flatMap(k => [`%${k}%`, `%${k}%`])];

    return this.db.prepare(`
      SELECT * FROM ability_assets
      WHERE user_id = ? AND (${conditions})
      ORDER BY usage_count DESC, created_at DESC
    `).all(...params) as AbilityAsset[];
  }

  /**
   * 增加使用次数
   */
  incrementUsage(id: string): void {
    this.db.prepare(`
      UPDATE ability_assets
      SET usage_count = usage_count + 1, last_used_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 更新资产
   */
  update(id: string, fields: Partial<CreateAssetInput>): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.title !== undefined) {
      setClauses.push('title = ?');
      values.push(fields.title);
    }
    if (fields.content !== undefined) {
      setClauses.push('content = ?');
      values.push(fields.content);
    }
    if (fields.tags !== undefined) {
      setClauses.push('tags = ?');
      values.push(JSON.stringify(fields.tags));
    }

    if (setClauses.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE ability_assets SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  /**
   * 删除资产
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM ability_assets WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
