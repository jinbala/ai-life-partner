/**
 * Token 使用记录仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

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
export class TokenUsageRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 记录 Token 使用
   */
  record(usage: Omit<TokenUsageRecord, 'id' | 'created_at'>): void {
    this.db.prepare(`
      INSERT INTO token_usage (user_id, provider, model, prompt_tokens, completion_tokens, total_tokens, endpoint, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      usage.user_id || null,
      usage.provider,
      usage.model,
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.total_tokens,
      usage.endpoint || null,
      usage.cost || 0
    );
  }

  /**
   * 获取用户的 Token 使用汇总（按日期）
   */
  getSummaryByDate(userId: string, days: number = 7): TokenUsageSummary[] {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = this.db.prepare(`
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
    `).all(userId, startDate.toISOString()) as TokenUsageSummary[];

    return results;
  }

  /**
   * 获取用户的 Token 使用汇总（总计）
   */
  getTotalSummary(userId?: string, days?: number): TokenUsageSummary {
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

    const result = this.db.prepare(query).get(...params) as TokenUsageSummary;
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
  getSummaryByProvider(userId?: string, days?: number): Array<{
    provider: string;
    total_requests: number;
    total_tokens: number;
    estimated_cost: number;
  }> {
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

    return this.db.prepare(query).all(...params) as Array<{
      provider: string;
      total_requests: number;
      total_tokens: number;
      estimated_cost: number;
    }>;
  }

  /**
   * 获取最近的 Token 使用记录
   */
  getRecentRecords(limit: number = 10, userId?: string): TokenUsageRecord[] {
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

    return this.db.prepare(query).all(...params) as TokenUsageRecord[];
  }

  /**
   * 清理旧的 Token 使用记录
   */
  cleanup(daysToKeep: number = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = this.db.prepare(`
      DELETE FROM token_usage
      WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
  }
}
