/**
 * 认知挑战数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface Challenge {
  id: string;
  user_id: string;
  question: string;
  option_a: string | null;
  option_b: string | null;
  related_ability: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  user_answer: string | null;
  score: number | null;
  evaluation: string | null;
  ability_adjustment: number;
  status: 'pending' | 'answered' | 'evaluated';
  created_at: string;
  answered_at: string | null;
}

export interface CreateChallengeInput {
  user_id: string;
  question: string;
  option_a?: string;
  option_b?: string;
  related_ability?: string;
  difficulty?: Challenge['difficulty'];
}

export class ChallengeRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建认知挑战
   */
  create(input: CreateChallengeInput): Challenge {
    const id = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.db.prepare(`
      INSERT INTO challenges (id, user_id, question, option_a, option_b, related_ability, difficulty, status, ability_adjustment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, datetime('now'))
    `).run(
      id,
      input.user_id,
      input.question,
      input.option_a || null,
      input.option_b || null,
      input.related_ability || null,
      input.difficulty || 'medium'
    );

    return this.findById(id)!;
  }

  /**
   * 查找挑战
   */
  findById(id: string): Challenge | null {
    return this.db.prepare('SELECT * FROM challenges WHERE id = ?').get(id) as Challenge | null;
  }

  /**
   * 获取用户的所有挑战
   */
  findByUser(userId: string): Challenge[] {
    return this.db.prepare(
      'SELECT * FROM challenges WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as Challenge[];
  }

  /**
   * 获取待回答的挑战
   */
  findPending(userId: string): Challenge | null {
    return this.db.prepare(`
      SELECT * FROM challenges
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `).get(userId) as Challenge | null;
  }

  /**
   * 提交答案
   */
  submitAnswer(id: string, user_answer: string): void {
    this.db.prepare(`
      UPDATE challenges
      SET user_answer = ?, status = 'answered', answered_at = datetime('now')
      WHERE id = ?
    `).run(user_answer, id);
  }

  /**
   * 保存评估结果
   */
  saveEvaluation(
    id: string,
    score: number,
    evaluation: string,
    ability_adjustment: number
  ): void {
    this.db.prepare(`
      UPDATE challenges
      SET score = ?, evaluation = ?, ability_adjustment = ?, status = 'evaluated'
      WHERE id = ?
    `).run(score, evaluation, ability_adjustment, id);
  }

  /**
   * 获取挑战统计
   */
  getStats(userId: string): {
    total: number;
    pending: number;
    answered: number;
    evaluated: number;
    avg_score: number;
  } {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN status = 'evaluated' THEN 1 ELSE 0 END) as evaluated,
        AVG(CASE WHEN score IS NOT NULL THEN score ELSE NULL END) as avg_score
      FROM challenges
      WHERE user_id = ?
    `).get(userId) as {
      total: number;
      pending: number;
      answered: number;
      evaluated: number;
      avg_score: number;
    };

    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      answered: stats.answered || 0,
      evaluated: stats.evaluated || 0,
      avg_score: stats.avg_score || 0,
    };
  }

  /**
   * 删除挑战
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM challenges WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
