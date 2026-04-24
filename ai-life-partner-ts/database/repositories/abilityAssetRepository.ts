/**
 * 能力资产数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

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

export class AbilityAssetRepository extends BaseRepository {
  /**
   * 创建能力资产
   */
  async create(input: CreateAssetInput): Promise<AbilityAsset> {
    const id = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.execute(`
      INSERT INTO ability_assets (id, user_id, type, title, content, tags, usage_count, last_used_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ${getNowSql()})
    `, [
      id,
      input.user_id,
      input.type,
      input.title,
      input.content,
      input.tags ? JSON.stringify(input.tags) : null
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找资产
   */
  async findById(id: string): Promise<AbilityAsset | null> {
    return await this.queryOne<AbilityAsset>('SELECT * FROM ability_assets WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有资产
   */
  async findByUser(userId: string): Promise<AbilityAsset[]> {
    return await this.queryMany<AbilityAsset>('SELECT * FROM ability_assets WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  /**
   * 按类型获取资产
   */
  async findByType(userId: string, type: AbilityAsset['type']): Promise<AbilityAsset[]> {
    return await this.queryMany<AbilityAsset>('SELECT * FROM ability_assets WHERE user_id = ? AND type = ? ORDER BY created_at DESC', [userId, type]);
  }

  /**
   * 搜索资产（按标题或内容）
   */
  async search(userId: string, keywords: string[]): Promise<AbilityAsset[]> {
    if (keywords.length === 0) return [];

    const conditions = keywords.map(k => '(title LIKE ? OR content LIKE ?)').join(' OR ');
    const params = [userId, ...keywords.flatMap(k => [`%${k}%`, `%${k}%`])];

    return await this.queryMany<AbilityAsset>(`
      SELECT * FROM ability_assets
      WHERE user_id = ? AND (${conditions})
      ORDER BY usage_count DESC, created_at DESC
    `, params);
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(id: string): Promise<void> {
    await this.runUpdate(`UPDATE ability_assets SET usage_count = usage_count + 1, last_used_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 更新资产
   */
  async update(id: string, fields: Partial<CreateAssetInput>): Promise<void> {
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
      await this.runUpdate(`UPDATE ability_assets SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }
  }

  /**
   * 删除资产
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM ability_assets WHERE id = ?', [id]);
    return result > 0;
  }
}
