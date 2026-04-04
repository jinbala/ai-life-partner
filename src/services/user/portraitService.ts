/**
 * 用户画像服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { PortraitRepository } from '../../database/repositories';
import type { AbilityChange, DecisionRecord, CognitionUpgrade } from '../../types';

export interface PortraitSummary {
  industry: string | null;
  incomeStructure: {
    sources: Array<{ name: string; amount: number; stability: string; percentage: number }>;
    largestSource: string;
  };
  resources: {
    skills: string[];
    connections: string[];
  };
  decisionStyle: string;
  stuckPoints: string[];
  procrastinationTriggers: string[];
  abilities: {
    businessJudgment: number;
    execution: number;
    cognition: number;
    riskControl: number;
    learningAbility: number;
  };
  growthTrack: {
    decisionQuality: Array<{ date: string; decision: string; quality: number; outcome?: string }>;
    cognitionUpgrades: Array<{ date: string; description: string; trigger: string }>;
    abilityTrend: AbilityChange[];
  };
}

/**
 * 创建默认画像数据
 */
function createDefaultPortraitData(): PortraitSummary {
  return {
    industry: null,
    incomeStructure: {
      sources: [],
      largestSource: '',
    },
    resources: {
      skills: [],
      connections: [],
    },
    decisionStyle: 'intuitive',
    stuckPoints: [],
    procrastinationTriggers: [],
    abilities: {
      businessJudgment: 5,
      execution: 5,
      cognition: 5,
      riskControl: 5,
      learningAbility: 5,
    },
    growthTrack: {
      decisionQuality: [],
      cognitionUpgrades: [],
      abilityTrend: [],
    },
  };
}

/**
 * 画像服务
 */
export class PortraitService {
  private repository: PortraitRepository;
  private userId: string;
  private cache: PortraitSummary | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new PortraitRepository();
  }

  /**
   * 加载画像
   */
  load(): PortraitSummary {
    if (this.cache) {
      return this.cache;
    }

    const record = this.repository.findOrCreate(this.userId);
    if (!record) {
      return createDefaultPortraitData();
    }

    try {
      this.cache = {
        industry: record.industry,
        incomeStructure: record.income_structure ? JSON.parse(record.income_structure) : { sources: [], largestSource: '' },
        resources: record.resources ? JSON.parse(record.resources) : { skills: [], connections: [] },
        decisionStyle: record.decision_style,
        stuckPoints: record.stuck_points ? JSON.parse(record.stuck_points) : [],
        procrastinationTriggers: record.procrastination_triggers ? JSON.parse(record.procrastination_triggers) : [],
        abilities: record.abilities ? JSON.parse(record.abilities) : {
          businessJudgment: 5,
          execution: 5,
          cognition: 5,
          riskControl: 5,
          learningAbility: 5,
        },
        growthTrack: record.growth_track ? JSON.parse(record.growth_track) : {
          decisionQuality: [],
          cognitionUpgrades: [],
          abilityTrend: [],
        },
      };
      return this.cache;
    } catch (error) {
      console.error('[PortraitService] 解析画像数据失败:', error);
      return createDefaultPortraitData();
    }
  }

  /**
   * 保存画像
   */
  save(portrait: PortraitSummary): void {
    this.repository.update(this.userId, {
      industry: portrait.industry,
      income_structure: JSON.stringify(portrait.incomeStructure),
      resources: JSON.stringify(portrait.resources),
      decision_style: portrait.decisionStyle,
      stuck_points: JSON.stringify(portrait.stuckPoints),
      procrastination_triggers: JSON.stringify(portrait.procrastinationTriggers),
      abilities: JSON.stringify(portrait.abilities),
      growth_track: JSON.stringify(portrait.growthTrack),
    });
    this.cache = portrait;
  }

  /**
   * 初始化画像（首次使用时引导用户填写）
   */
  async initializeWithQuestions(): Promise<{
    questions: string[];
    portrait: PortraitSummary;
  }> {
    const portrait = this.load();
    const questions: string[] = [];

    if (!portrait.industry) {
      questions.push('你现在的行业/职业是什么？');
    }

    if (portrait.incomeStructure.sources.length === 0) {
      questions.push('你目前的收入来源有几个？分别是什么？（按重要性排序）');
    }

    if (portrait.resources.skills.length === 0) {
      questions.push('你核心掌握的技能有哪些？');
    }

    if (portrait.stuckPoints.length === 0) {
      questions.push('你做事时容易卡住的环节是什么？');
    }

    if (portrait.procrastinationTriggers.length === 0) {
      questions.push('什么情况最容易让你拖延？');
    }

    return {
      questions: questions.slice(0, 3),
      portrait,
    };
  }

  /**
   * 根据用户回答更新画像
   */
  updateFromAnswer(question: string, answer: string): PortraitSummary {
    const portrait = this.load();

    if (question.includes('行业') || question.includes('职业')) {
      portrait.industry = answer;
    }

    if (question.includes('收入来源')) {
      const sources = answer.split(/[,,]/).map((s) => s.trim()).filter(Boolean);
      portrait.incomeStructure.sources = sources.map((name, idx) => ({
        name,
        amount: 0,
        stability: 'unstable',
        percentage: Math.round(100 / sources.length),
      }));
      if (sources.length > 0) {
        portrait.incomeStructure.largestSource = sources[0];
      }
    }

    if (question.includes('技能')) {
      portrait.resources.skills = answer.split(/[,,]/).map((s) => s.trim()).filter(Boolean);
    }

    if (question.includes('卡住')) {
      portrait.stuckPoints = answer.split(/[,,]/).map((s) => s.trim()).filter(Boolean);
    }

    if (question.includes('拖延')) {
      portrait.procrastinationTriggers = answer.split(/[,,]/).map((s) => s.trim()).filter(Boolean);
    }

    // 数值型问题（打分）
    const scoreMatch = answer.match(/^(\d+)$/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 1 && score <= 10) {
        if (question.includes('判断力') || question.includes('商业')) {
          this.recordAbilityChange(portrait, 'businessJudgment', score, '用户自评');
        } else if (question.includes('执行力')) {
          this.recordAbilityChange(portrait, 'execution', score, '用户自评');
        } else if (question.includes('认知')) {
          this.recordAbilityChange(portrait, 'cognition', score, '用户自评');
        }
      }
    }

    this.save(portrait);
    return portrait;
  }

  /**
   * 记录能力变化
   */
  private recordAbilityChange(
    portrait: PortraitSummary,
    ability: keyof typeof portrait.abilities,
    newValue: number,
    reason: string
  ) {
    const oldValue = portrait.abilities[ability];
    if (oldValue !== newValue) {
      portrait.abilities[ability] = newValue;
      portrait.growthTrack.abilityTrend.push({
        date: new Date().toISOString(),
        ability,
        oldValue,
        newValue,
        reason,
      });
      this.repository.recordAbilityChange(this.userId, ability, oldValue, newValue, reason);
    }
  }

  /**
   * 记录决策质量
   */
  recordDecision(decision: string, quality: number, outcome?: string) {
    const portrait = this.load();
    portrait.growthTrack.decisionQuality.push({
      date: new Date().toISOString(),
      decision,
      quality,
      outcome,
    });
    this.repository.recordDecisionQuality(this.userId, decision, quality, outcome);
    this.save(portrait);
  }

  /**
   * 记录认知升级
   */
  recordCognitionUpgrade(description: string, trigger: string) {
    const portrait = this.load();
    portrait.growthTrack.cognitionUpgrades.push({
      date: new Date().toISOString(),
      description,
      trigger,
    });
    this.repository.recordCognitionUpgrade(this.userId, description, trigger);
    this.save(portrait);
  }

  /**
   * 获取能力雷达图数据
   */
  getAbilityRadar(): Record<string, number> {
    const portrait = this.load();
    return {
      '商业判断力': portrait.abilities.businessJudgment,
      '执行力': portrait.abilities.execution,
      '认知水平': portrait.abilities.cognition,
      '风险控制': portrait.abilities.riskControl,
      '学习能力': portrait.abilities.learningAbility,
    };
  }

  /**
   * 获取画像摘要（用于 AI 上下文）
   */
  getSummary(): string {
    const portrait = this.load();
    const parts: string[] = [];

    if (portrait.industry) {
      parts.push(`行业：${portrait.industry}`);
    }

    if (portrait.incomeStructure.largestSource) {
      parts.push(`最大收入来源：${portrait.incomeStructure.largestSource}`);
    }

    parts.push(`决策风格：${this.translateDecisionStyle(portrait.decisionStyle)}`);

    if (portrait.growthTrack.cognitionUpgrades.length > 0) {
      const latest = portrait.growthTrack.cognitionUpgrades[portrait.growthTrack.cognitionUpgrades.length - 1];
      parts.push(`最近认知升级：${latest.description}`);
    }

    return parts.join(' | ');
  }

  private translateDecisionStyle(style: string): string {
    const map: Record<string, string> = {
      impulsive: '冲动型',
      hesitant: '犹豫型',
      rational: '理性型',
      intuitive: '直觉型',
    };
    return map[style] || style;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }
}
