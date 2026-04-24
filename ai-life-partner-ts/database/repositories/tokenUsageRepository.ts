/**
 * Token 使用记录仓库
 */

import { BaseRepository } from '../BaseRepository';

export interface TokenUsageRecord {
  id?: number;
  user_id?: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  endpoint?: string;
  cost?: number;
  created_at: string;
}

export interface TokenUsageSummary {
  date: string;
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
}

/**
 * Token 使用记录仓库
 */
export class TokenUsageRepository extends BaseRepository {
  /**
   * 记录 Token 使用
   */
  async record(usage: Omit<TokenUsageRecord, 'id' | 'created_at'>): Promise<void> {
    await this.execute(`
      INSERT INTO token_usage (user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, endpoint, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      usage.user_id || null,
      usage.provider,
      usage.model,
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.total_tokens,
      usage.endpoint || null,
      usage.cost || 0
    ]);
  }

  /**
   * 获取用户的 Token 使用汇总（按日期）
   */
  async getSummaryByDate(userId: string, days: number = 7): Promise<TokenUsageSummary[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.queryMany<TokenUsageSummary>(`
      SELECT
        date(created_at) as date,
        COUNT(*) as total_requests,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as estimated_cost
      FROM token_usage
      WHERE user_id = ? AND created_at >= ?
      GROUP BY date(created_at)
      ORDER BY date DESC
    `, [userId, startDate.toISOString()]);

    return results;
  }

  /**
   * 获取用户的 Token 使用汇总（总计）
   */
  async getTotalSummary(userId?: string, days?: number): Promise<TokenUsageSummary> {
    let query = `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
        COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cost), 0) as estimated_cost
      FROM token_usage
      WHERE 1=1
    `;

    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    const result = await this.queryOne<TokenUsageSummary>(query, params);
    return result || {
      date: '',
      total_requests: 0,
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
      estimated_cost: 0,
    };
  }

  /**
   * 获取按提供商的 Token 使用汇总
   */
  async getSummaryByProvider(userId?: string, days?: number): Promise<Array<{
    provider: string;
    total_requests: number;
    total_tokens: number;
    estimated_cost: number;
  }>> {
    let query = `
      SELECT
        provider,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost) as estimated_cost
      FROM token_usage
      WHERE 1=1
    `;

    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    query += ' GROUP BY provider ORDER BY total_tokens DESC';

    return await this.queryMany(query, params);
  }

  /**
   * 获取最近的 Token 使用记录
   */
  async getRecentRecords(limit: number = 10, userId?: string): Promise<TokenUsageRecord[]> {
    let query = `
      SELECT * FROM token_usage
      WHERE 1=1
    `;

    const params: any[] = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await this.queryMany(query, params);
  }

  /**
   * 清理旧的 Token 使用记录
   */
  async cleanup(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.runDelete(`
      DELETE FROM token_usage
      WHERE created_at < ?
    `, [cutoffDate.toISOString()]);

    return result;
  }
}
