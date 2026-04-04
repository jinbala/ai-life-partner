/**
 * 认知挑战服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { ChallengeRepository, CreateChallengeInput } from '../../database/repositories';
import type { PortraitService } from '../user/portraitService';

export interface Challenge {
  id: string;
  question: string;
  optionA: string | null;
  optionB: string | null;
  relatedAbility: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  userAnswer: string | null;
  score: number | null;
  evaluation: string | null;
  abilityAdjustment: number;
  status: 'pending' | 'answered' | 'evaluated';
  createdAt: string;
  answeredAt: string | null;
}

export interface ChallengeSummary {
  total: number;
  pending: number;
  answered: number;
  evaluated: number;
  avgScore: number;
}

/**
 * 认知挑战服务
 */
export class CognitionChallengeService {
  private repository: ChallengeRepository;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new ChallengeRepository();
  }

  /**
   * 创建挑战
   */
  create(input: Omit<CreateChallengeInput, 'user_id'>): string {
    const challenge = this.repository.create({ ...input, user_id: this.userId });
    return challenge.id;
  }

  /**
   * 获取待回答的挑战
   */
  getPendingChallenge(): Challenge | null {
    const challenge = this.repository.findPending(this.userId);
    if (!challenge) return null;

    return this.mapToChallenge(challenge);
  }

  /**
   * 提交答案
   */
  submitAnswer(challengeId: string, answer: string): void {
    this.repository.submitAnswer(challengeId, answer);
  }

  /**
   * 评估答案
   */
  async evaluateAnswer(
    challengeId: string,
    answer: string,
    portrait: any
  ): Promise<{
    score: number;
    evaluation: string;
    insight: string;
    ability_adjustment: number;
  }> {
    const challenge = this.repository.findById(challengeId);
    if (!challenge) {
      throw new Error('挑战不存在');
    }

    // 简化评估逻辑（实际应由 AI 评估）
    const score = Math.floor(Math.random() * 4) + 7; // 7-10 分
    const evaluation = `回答质量：${score}/10`;
    const insight = '继续深入思考...';
    const ability_adjustment = score >= 8 ? 1 : 0;

    // 保存评估结果
    this.repository.saveEvaluation(challengeId, score, evaluation, ability_adjustment);

    // 更新能力分数
    if (ability_adjustment !== 0 && challenge.related_ability) {
      // 通过 portraitManager 更新
    }

    return { score, evaluation, insight, ability_adjustment };
  }

  /**
   * 获取挑战摘要
   */
  getSummary(): string {
    const stats = this.repository.getStats(this.userId);
    return `总挑战：${stats.total} | ` +
      `待回答：${stats.pending} | ` +
      `已回答：${stats.answered} | ` +
      `已评估：${stats.evaluated} | ` +
      `平均分：${stats.avg_score.toFixed(1)}`;
  }

  /**
   * 获取所有挑战
   */
  getAll(): Challenge[] {
    const challenges = this.repository.findByUser(this.userId);
    return challenges.map(c => this.mapToChallenge(c));
  }

  /**
   * 删除挑战
   */
  delete(id: string): boolean {
    return this.repository.delete(id);
  }

  private mapToChallenge(c: any): Challenge {
    return {
      id: c.id,
      question: c.question,
      optionA: c.option_a,
      optionB: c.option_b,
      relatedAbility: c.related_ability,
      difficulty: c.difficulty,
      userAnswer: c.user_answer,
      score: c.score,
      evaluation: c.evaluation,
      abilityAdjustment: c.ability_adjustment,
      status: c.status,
      createdAt: c.created_at,
      answeredAt: c.answered_at,
    };
  }
}
