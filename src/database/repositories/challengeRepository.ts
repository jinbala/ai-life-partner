/**
 * 认知挑战数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

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

export class ChallengeRepository extends BaseRepository {
  /**
   * 创建认知挑战
   */
  async create(input: CreateChallengeInput): Promise<Challenge> {
    const id = `challenge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.execute(`
      INSERT INTO challenges (id, user_id, question, option_a, option_b, related_ability, difficulty, status, ability_adjustment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ${getNowSql()})
    `, [
      id,
      input.user_id,
      input.question,
      input.option_a || null,
      input.option_b || null,
      input.related_ability || null,
      input.difficulty || 'medium'
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找挑战
   */
  async findById(id: string): Promise<Challenge | null> {
    return await this.queryOne<Challenge>('SELECT * FROM challenges WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有挑战
   */
  async findByUser(userId: string): Promise<Challenge[]> {
    return await this.queryMany<Challenge>('SELECT * FROM challenges WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  /**
   * 获取待回答的挑战
   */
  async findPending(userId: string): Promise<Challenge | null> {
    return await this.queryOne<Challenge>(`
      SELECT * FROM challenges
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `, [userId]);
  }

  /**
   * 提交答案
   */
  async submitAnswer(id: string, user_answer: string): Promise<void> {
    await this.runUpdate(`UPDATE challenges SET user_answer = ?, status = 'answered', answered_at = ${getNowSql()} WHERE id = ?`, [user_answer, id]);
  }

  /**
   * 保存评估结果
   */
  async saveEvaluation(
    id: string,
    score: number,
    evaluation: string,
    ability_adjustment: number
  ): Promise<void> {
    await this.runUpdate(`UPDATE challenges SET score = ?, evaluation = ?, ability_adjustment = ?, status = 'evaluated' WHERE id = ?`, [score, evaluation, ability_adjustment, id]);
  }

  /**
   * 获取挑战统计
   */
  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    answered: number;
    evaluated: number;
    avg_score: number;
  }> {
    const stats = await this.queryOne<{
      total: number;
      pending: number;
      answered: number;
      evaluated: number;
      avg_score: number;
    }>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN status = 'evaluated' THEN 1 ELSE 0 END) as evaluated,
        AVG(CASE WHEN score IS NOT NULL THEN score ELSE NULL END) as avg_score
      FROM challenges
      WHERE user_id = ?
    `, [userId]);

    return {
      total: stats?.total || 0,
      pending: stats?.pending || 0,
      answered: stats?.answered || 0,
      evaluated: stats?.evaluated || 0,
      avg_score: stats?.avg_score || 0,
    };
  }

  /**
   * 删除挑战
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM challenges WHERE id = ?', [id]);
    return result > 0;
  }
}
