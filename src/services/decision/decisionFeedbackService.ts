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
  create(input: Omit<CreateDecisionInput, 'user_id'>): string {
    const decision = this.repository.create({ ...input, user_id: this.userId });
    return decision.id;
  }

  /**
   * 获取决策摘要
   */
  getSummary(): string {
    const decisions = this.repository.findByUser(this.userId);
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
  getAll(): DecisionRecord[] {
    const decisions = this.repository.findByUser(this.userId);
    return decisions.map(d => this.mapToDecisionRecord(d));
  }

  /**
   * 获取待复盘的决策
   */
  getPendingDecisions(): DecisionRecord[] {
    const decisions = this.repository.findPendingDecisions(this.userId);
    return decisions.map(d => this.mapToDecisionRecord(d));
  }

  /**
   * 检查待复盘决策
   */
  checkPendingDecisions(): DecisionRecord[] {
    return this.getPendingDecisions();
  }

  /**
   * 完成决策闭环
   */
  async closeDecisionLoop(
    decisionId: string,
    actualOutcome: string,
    portraitManager: PortraitService,
    assetsManager: AbilityAssetService,
    memoryManager: MemoryService
  ): Promise<string> {
    const decision = this.repository.findById(decisionId);
    if (!decision) {
      throw new Error('决策记录不存在');
    }

    // 计算偏差
    const expected = decision.expected_outcome || '';
    const deviation = actualOutcome !== expected ? `预期：${expected}，实际：${actualOutcome}` : '符合预期';

    // 提取经验教训
    const lessonLearned = `在${decision.topic}决策中，选择${decision.chosen}，${deviation}`;

    // 更新数据库
    this.repository.closeDecisionLoop(decisionId, actualOutcome, deviation, lessonLearned);

    // 保存为能力资产
    try {
      assetsManager.manualSave('教训', lessonLearned);
    } catch (e) {
      logger.error('[DecisionService] 保存资产失败', e);
    }

    // 更新画像
    const quality = actualOutcome === expected ? 8 : 5;
    portraitManager.recordDecision(decision.topic, quality, actualOutcome);

    return `决策复盘完成：${lessonLearned}`;
  }

  /**
   * 获取决策详情
   */
  getById(id: string): DecisionRecord | null {
    const decision = this.repository.findById(id);
    return decision ? this.mapToDecisionRecord(decision) : null;
  }

  /**
   * 删除决策
   */
  delete(id: string): boolean {
    return this.repository.delete(id);
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
      reminded: d.reminded,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }
}
