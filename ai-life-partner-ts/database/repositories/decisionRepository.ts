/**
 * 决策记录数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface Decision {
  id: string;
  user_id: string;
  topic: string;
  essence: string | null;
  options: string | null;
  chosen: string;
  reason: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  deviation: string | null;
  lesson_learned: string | null;
  status: 'pending' | 'completed' | 'reviewed';
  verify_date: string | null;
  reminded: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDecisionInput {
  user_id: string;
  topic: string;
  essence?: string;
  options?: Array<{ name: string; cost: string; benefit: string; reversible: boolean }>;
  chosen: string;
  reason?: string;
  expected_outcome?: string;
  verify_date?: string;
}

export class DecisionRepository extends BaseRepository {
  /**
   * 创建决策记录
   */
  async create(input: CreateDecisionInput): Promise<Decision> {
    const id = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.execute(`
      INSERT INTO decisions (id, user_id, topic, essence, options, chosen, reason, expected_outcome, status, verify_date, reminded, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
    `, [
      id,
      input.user_id,
      input.topic,
      input.essence || null,
      input.options ? JSON.stringify(input.options) : null,
      input.chosen,
      input.reason || null,
      input.expected_outcome || null,
      input.verify_date || null,
      now,
      now
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找决策
   */
  async findById(id: string): Promise<Decision | null> {
    return await this.queryOne<Decision>('SELECT * FROM decisions WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有决策
   */
  async findByUser(userId: string): Promise<Decision[]> {
    return await this.queryMany<Decision>('SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  /**
   * 按状态获取决策
   */
  async findByStatus(userId: string, status: Decision['status']): Promise<Decision[]> {
    return await this.queryMany<Decision>('SELECT * FROM decisions WHERE user_id = ? AND status = ? ORDER BY created_at DESC', [userId, status]);
  }

  /**
   * 获取待复盘的决策
   */
  async findPendingDecisions(userId: string): Promise<Decision[]> {
    const now = new Date().toISOString().split('T')[0];
    return await this.queryMany<Decision>(`
      SELECT * FROM decisions
      WHERE user_id = ? AND status = 'pending' AND verify_date <= ?
      ORDER BY verify_date ASC
    `, [userId, now]);
  }

  /**
   * 更新决策状态
   */
  async updateStatus(id: string, status: Decision['status']): Promise<void> {
    await this.runUpdate(`UPDATE decisions SET status = ?, updated_at = ${getNowSql()} WHERE id = ?`, [status, id]);
  }

  /**
   * 完成决策闭环
   */
  async closeDecisionLoop(
    id: string,
    actual_outcome: string,
    deviation: string,
    lesson_learned: string
  ): Promise<void> {
    await this.runUpdate(`UPDATE decisions SET actual_outcome = ?, deviation = ?, lesson_learned = ?, status = 'reviewed', reminded = 1, updated_at = ${getNowSql()} WHERE id = ?`, [actual_outcome, deviation, lesson_learned, id]);
  }

  /**
   * 标记为已提醒
   */
  async markAsReminded(id: string): Promise<void> {
    await this.runUpdate(`UPDATE decisions SET reminded = 1, updated_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 删除决策
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM decisions WHERE id = ?', [id]);
    return result > 0;
  }
}
