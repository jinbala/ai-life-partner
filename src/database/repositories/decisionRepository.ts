/**
 * 决策记录数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

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
  reminded: boolean;
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

export class DecisionRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建决策记录
   */
  create(input: CreateDecisionInput): Decision {
    const id = `dec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO decisions (id, user_id, topic, essence, options, chosen, reason, expected_outcome, status, verify_date, reminded, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)
    `).run(
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
    );

    return this.findById(id)!;
  }

  /**
   * 查找决策
   */
  findById(id: string): Decision | null {
    return this.db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as Decision | null;
  }

  /**
   * 获取用户的所有决策
   */
  findByUser(userId: string): Decision[] {
    return this.db.prepare(
      'SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Decision[];
  }

  /**
   * 按状态获取决策
   */
  findByStatus(userId: string, status: Decision['status']): Decision[] {
    return this.db.prepare(
      'SELECT * FROM decisions WHERE user_id = ? AND status = ? ORDER BY created_at DESC'
    ).all(userId, status) as Decision[];
  }

  /**
   * 获取待复盘的决策
   */
  findPendingDecisions(userId: string): Decision[] {
    const now = new Date().toISOString().split('T')[0];
    return this.db.prepare(`
      SELECT * FROM decisions
      WHERE user_id = ? AND status = 'pending' AND verify_date <= ?
      ORDER BY verify_date ASC
    `).all(userId, now) as Decision[];
  }

  /**
   * 更新决策状态
   */
  updateStatus(id: string, status: Decision['status']): void {
    this.db.prepare(`
      UPDATE decisions
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);
  }

  /**
   * 完成决策闭环
   */
  closeDecisionLoop(
    id: string,
    actual_outcome: string,
    deviation: string,
    lesson_learned: string
  ): void {
    this.db.prepare(`
      UPDATE decisions
      SET actual_outcome = ?, deviation = ?, lesson_learned = ?, status = 'reviewed', reminded = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(actual_outcome, deviation, lesson_learned, id);
  }

  /**
   * 标记为已提醒
   */
  markAsReminded(id: string): void {
    this.db.prepare(`
      UPDATE decisions
      SET reminded = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 删除决策
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM decisions WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
