/**
 * 决策反馈服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { DecisionRepository, CreateDecisionInput } from '../../database/repositories';
import type { MemoryService } from '../memory/memoryService';
import type { AbilityAssetService } from '../assets/abilityAssetService';
import type { PortraitService } from '../user/portraitService';
import { logger } from '../../utils/logger';

export interface DecisionRecord {
  id: string;
  topic: string;
  essence: string | null;
  options: any[] | null;
  chosen: string;
  reason: string | null;
  expectedOutcome: string | null;
  actualOutcome: string | null;
  deviation: string | null;
  lessonLearned: string | null;
  status: 'pending' | 'completed' | 'reviewed';
  verifyDate: string | null;
  reminded: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 决策反馈服务
 */
export class DecisionFeedbackService {
  private repository: DecisionRepository;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new DecisionRepository();
  }

  /**
   * 创建决策记录
   */
  async create(input: Omit<CreateDecisionInput, 'user_id'>): Promise<string> {
    const decision = await this.repository.create({ ...input, user_id: this.userId });
    return decision.id;
  }

  /**
   * 获取决策摘要
   */
  async getSummary(): Promise<string> {
    const decisions = await this.repository.findByUser(this.userId);
    const pending = decisions.filter(d => d.status === 'pending').length;
    const completed = decisions.filter(d => d.status === 'completed').length;
    const reviewed = decisions.filter(d => d.status === 'reviewed').length;

    if (decisions.length === 0) return '暂无决策记录';

    return `决策历史：${decisions.length}条 | ` +
      `待复盘：${pending} | ` +
      `已完成：${completed} | ` +
      `已复盘：${reviewed}`;
  }

  /**
   * 获取所有决策
   */
  async getAll(): Promise<DecisionRecord[]> {
    const decisions = await this.repository.findByUser(this.userId);
    return decisions.map(d => this.mapToDecisionRecord(d));
  }

  /**
   * 获取待复盘的决策
   */
  async getPendingDecisions(): Promise<DecisionRecord[]> {
    const decisions = await this.repository.findPendingDecisions(this.userId);
    return decisions.map(d => this.mapToDecisionRecord(d));
  }

  /**
   * 获取指定决策
   */
  async getDecision(decisionId: string): Promise<DecisionRecord | null> {
    const decision = await this.repository.findById(decisionId);
    if (!decision) return null;
    return this.mapToDecisionRecord(decision);
  }

  /**
   * 检查待复盘的决策
   */
  async checkPendingDecisions(): Promise<DecisionRecord[]> {
    return await this.getPendingDecisions();
  }

  /**
   * 完成决策闭环
   */
  async closeDecisionLoop(
    decisionId: string,
    actualOutcome: string,
    portrait: Awaited<ReturnType<PortraitService['load']>>,
    assets: AbilityAssetService,
    memories: MemoryService
  ): Promise<string> {
    const decision = await this.repository.findById(decisionId);
    if (!decision) {
      throw new Error('决策不存在');
    }

    // 分析偏差
    const deviationAnalysis = this.analyzeDeviation(actualOutcome, decision.expected_outcome);

    // 提取教训
    const lessonLearned = this.extractLesson(decision.topic, actualOutcome, portrait);

    // 更新决策状态
    await this.repository.closeDecisionLoop(decisionId, actualOutcome, deviationAnalysis, lessonLearned);

    // 记录到能力资产
    if (lessonLearned) {
      await assets.manualSave('lesson', lessonLearned);
    }

    // 记录到记忆
    await memories.addMemory('decision', `决策复盘：${decision.topic} - ${lessonLearned}`);

    return this.generateFeedback(decision, actualOutcome, deviationAnalysis, lessonLearned);
  }

  private analyzeDeviation(actualOutcome: string, expectedOutcome: string | null): string {
    // 简单分析预期与实际的差异
    if (!expectedOutcome) return '无预期结果';

    const expected = expectedOutcome.toLowerCase();
    const actual = actualOutcome.toLowerCase();

    if (expected.includes('成功') && !actual.includes('成功')) {
      return '结果未达预期';
    } else if (expected.includes('增长') && !actual.includes('增长')) {
      return '增长未实现';
    }

    return '结果与预期基本一致';
  }

  private extractLesson(topic: string, actualOutcome: string, portrait: any): string {
    // 从决策结果中提取教训
    if (actualOutcome.includes('失败') || actualOutcome.includes('错误')) {
      return `在${topic}上的教训：${actualOutcome}`;
    }
    return `在${topic}上的经验：${actualOutcome}`;
  }

  private generateFeedback(
    decision: any,
    actualOutcome: string,
    deviation: string,
    lessonLearned: string
  ): string {
    return `决策复盘完成\n\n主题：${decision.topic}\n你的选择：${decision.chosen}\n预期结果：${decision.expected_outcome}\n实际结果：${actualOutcome}\n偏差分析：${deviation}\n\n经验教训：${lessonLearned}`;
  }

  private mapToDecisionRecord(d: any): DecisionRecord {
    return {
      id: d.id,
      topic: d.topic,
      essence: d.essence,
      options: d.options ? JSON.parse(d.options) : null,
      chosen: d.chosen,
      reason: d.reason,
      expectedOutcome: d.expected_outcome,
      actualOutcome: d.actual_outcome,
      deviation: d.deviation,
      lessonLearned: d.lesson_learned,
      status: d.status as DecisionRecord['status'],
      verifyDate: d.verify_date,
      reminded: d.reminded === 1,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }

  /**
   * 标记决策为已复盘
   */
  async markAsReviewed(decisionId: string): Promise<void> {
    await this.repository.updateStatus(decisionId, 'reviewed');
  }

  /**
   * 删除决策
   */
  async delete(decisionId: string): Promise<boolean> {
    return await this.repository.delete(decisionId);
  }
}
