/**
 * 画像进化服务
 * 自动分析对话和决策结果，动态更新用户画像
 */

import { PortraitRepository } from '../../database/repositories/portraitRepository';
import { MemoryRepository } from '../../database/repositories/memoryRepository';
import { AIService, ChatMessage } from '../ai/aiService';
import { logger } from '../../utils/logger';

export interface PortraitUpdate {
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
  timestamp: string;
}

export interface AbilityAdjustment {
  ability: string;
  oldScore: number;
  newScore: number;
  delta: number;
  reason: string;
}

export interface EvolutionResult {
  portraitUpdates: PortraitUpdate[];
  abilityAdjustments: AbilityAdjustment[];
  newMemories: string[];
}

/**
 * 画像进化服务
 *
 * 功能：
 * 1. 分析对话内容，提取用户信息更新画像
 * 2. 根据决策结果调整能力分数
 * 3. 记录成长轨迹
 */
export class PortraitEvolutionService {
  private portraitRepo: PortraitRepository;
  private memoryRepo: MemoryRepository;
  private aiService: AIService;
  private analysisPrompt: string;

  constructor() {
    this.portraitRepo = new PortraitRepository();
    this.memoryRepo = new MemoryRepository();
    this.aiService = new AIService();

    this.analysisPrompt = `你是一个用户画像分析专家。分析以下对话，提取需要更新到用户画像的信息。

请返回 JSON 格式：
{
  "industry": "如有新的行业信息则填写，否则 null",
  "income_structure": "如有新的收入变化则填写，否则 null",
  "resources": "如有新资源则填写，否则 null",
  "decision_style": "如有新的决策风格证据则填写 rational/intuitive，否则 null",
  "stuck_points": "如有新的卡点则填写，否则 null",
  "procrastination_triggers": "如有新的拖延触发因素则填写，否则 null",
  "memories_to_create": ["需要创建的记忆条目，每个都是简短的事实描述"],
  "analysis": "简要分析说明"
}

只返回 JSON，不要其他内容。`;
  }

  /**
   * 分析对话并更新画像
   */
  async analyzeAndUpdatePortrait(
    userId: string,
    conversation: Array<{ role: string; content: string }>,
    forceUpdate: boolean = false
  ): Promise<EvolutionResult> {
    const result: EvolutionResult = {
      portraitUpdates: [],
      abilityAdjustments: [],
      newMemories: [],
    };

    try {
      // 获取当前画像
      const portrait = await this.portraitRepo.findByUserId(userId);
      if (!portrait) {
        logger.warn('[PortraitEvolution] 画像不存在，跳过分析', { userId });
        return result;
      }

      // 调用 AI 分析对话
      const analysisResponse = await this.aiService.chat([
        { role: 'system', content: this.analysisPrompt },
        ...conversation.slice(-20).map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ], { maxTokens: 500 });

      const analysis = JSON.parse(analysisResponse.content);

      // 提取画像字段更新
      const updatableFields = ['industry', 'income_structure', 'resources', 'decision_style', 'stuck_points', 'procrastination_triggers'];

      for (const field of updatableFields) {
        const newValue = analysis[field];
        if (newValue && newValue !== portrait[field as keyof typeof portrait]) {
          result.portraitUpdates.push({
            field,
            oldValue: portrait[field as keyof typeof portrait],
            newValue,
            reason: analysis.analysis || '对话分析提取',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // 执行画像更新
      if (result.portraitUpdates.length > 0 || forceUpdate) {
        const updateData: any = {
          industry: analysis.industry || undefined,
          income_structure: analysis.income_structure || undefined,
          resources: analysis.resources || undefined,
          decision_style: analysis.decision_style || undefined,
          stuck_points: analysis.stuck_points || undefined,
          procrastination_triggers: analysis.procrastination_triggers || undefined,
        };

        // update 方法会自动递增版本号
        await this.portraitRepo.update(userId, updateData);

        logger.info('[PortraitEvolution] 画像已更新', {
          userId,
          updates: result.portraitUpdates.length,
        });
      }

      // 创建新记忆
      if (analysis.memories_to_create && Array.isArray(analysis.memories_to_create)) {
        for (const content of analysis.memories_to_create) {
          try {
            await this.memoryRepo.create({
              user_id: userId,
              type: 'fact',
              content,
              importance: 5,
            });
            result.newMemories.push(content);
          } catch (error) {
            logger.warn('[PortraitEvolution] 创建记忆失败', { content, error });
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('[PortraitEvolution] 分析失败', { userId, error });
      return result;
    }
  }

  /**
   * 根据决策结果调整能力分数
   */
  async adjustAbilitiesFromDecision(
    userId: string,
    decisionOutcome: 'success' | 'failure' | 'partial',
    decisionComplexity: number = 5, // 1-10 复杂度
    relatedAbility?: string
  ): Promise<AbilityAdjustment[]> {
    const adjustments: AbilityAdjustment[] = [];

    try {
      const portrait = await this.portraitRepo.findByUserId(userId);
      if (!portrait || !portrait.abilities) {
        return adjustments;
      }

      const abilities = JSON.parse(portrait.abilities);
      const delta = this.calculateAbilityDelta(decisionOutcome, decisionComplexity);

      // 调整相关能力
      if (relatedAbility && abilities[relatedAbility] !== undefined) {
        const oldScore = abilities[relatedAbility];
        const newScore = Math.max(1, Math.min(10, oldScore + delta));

        if (newScore !== oldScore) {
          abilities[relatedAbility] = newScore;
          adjustments.push({
            ability: relatedAbility,
            oldScore,
            newScore,
            delta: newScore - oldScore,
            reason: decisionOutcome === 'success' ? '决策成功' : decisionOutcome === 'failure' ? '决策失败' : '部分达成',
          });
        }
      } else {
        // 调整所有能力
        const abilityKeys = Object.keys(abilities);
        const sharedDelta = delta / abilityKeys.length;

        for (const key of abilityKeys) {
          const oldScore = abilities[key];
          const newScore = Math.max(1, Math.min(10, oldScore + sharedDelta));

          if (newScore !== oldScore) {
            abilities[key] = newScore;
            adjustments.push({
              ability: key,
              oldScore,
              newScore,
              delta: newScore - oldScore,
              reason: `决策${decisionOutcome === 'success' ? '成功' : decisionOutcome === 'failure' ? '失败' : '部分达成'}`,
            });
          }
        }
      }

      // 保存更新
      if (adjustments.length > 0) {
        await this.portraitRepo.update(userId, {
          abilities: JSON.stringify(abilities),
        });

        logger.info('[PortraitEvolution] 能力分数已调整', {
          userId,
          adjustments: adjustments.length,
        });
      }

      return adjustments;
    } catch (error) {
      logger.error('[PortraitEvolution] 能力调整失败', { userId, error });
      return adjustments;
    }
  }

  /**
   * 计算能力分数变化
   */
  private calculateAbilityDelta(
    outcome: 'success' | 'failure' | 'partial',
    complexity: number
  ): number {
    // 复杂度越高，调整幅度越大
    const baseDelta = complexity / 10;

    switch (outcome) {
      case 'success':
        return Math.min(2, baseDelta); // 最多 +2
      case 'failure':
        return Math.max(-1.5, -baseDelta); // 最多 -1.5
      case 'partial':
        return baseDelta * 0.3; // 小幅度调整
      default:
        return 0;
    }
  }

  /**
   * 获取成长轨迹摘要
   */
  async getGrowthSummary(userId: string, days: number = 30): Promise<string> {
    try {
      const portrait = await this.portraitRepo.findByUserId(userId);
      if (!portrait) {
        return '暂无成长数据';
      }

      const abilities = JSON.parse(portrait.abilities || '{}');
      const abilityList = Object.entries(abilities)
        .map(([key, value]: [string, any]) => `- ${this.translateAbility(key)}: ${value}/10`)
        .join('\n');

      return `能力雷达
${abilityList}

画像版本：v${portrait.version || 1}
行业：${portrait.industry || '未设置'}
决策风格：${portrait.decision_style === 'rational' ? '理性分析' : portrait.decision_style === 'intuitive' ? '直觉驱动' : '未设置'}
卡点：${portrait.stuck_points || '无'}
`;
    } catch (error) {
      logger.error('[PortraitEvolution] 获取成长摘要失败', { userId, error });
      return '获取成长数据失败';
    }
  }

  /**
   * 翻译能力名称
   */
  private translateAbility(key: string): string {
    const map: Record<string, string> = {
      businessJudgment: '商业判断',
      execution: '执行力',
      cognition: '认知力',
      riskControl: '风控能力',
      learningAbility: '学习力',
    };
    return map[key] || key;
  }
}
