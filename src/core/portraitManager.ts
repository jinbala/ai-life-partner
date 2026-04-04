import * as fs from 'fs';
import * as path from 'path';
import { UserPortrait, createDefaultPortrait, AbilityChange, DecisionRecord, CognitionUpgrade } from '../types/portrait';

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * 用户画像管理器
 */
export class PortraitManager {
  private portraitPath: string;

  constructor(userId: string = 'default') {
    this.portraitPath = path.join(DATA_DIR, `portrait_${userId}.json`);
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 加载用户画像
   */
  load(): UserPortrait {
    if (fs.existsSync(this.portraitPath)) {
      const data = fs.readFileSync(this.portraitPath, 'utf-8');
      return JSON.parse(data) as UserPortrait;
    }

    // 返回默认画像
    return createDefaultPortrait();
  }

  /**
   * 保存用户画像
   */
  save(portrait: UserPortrait): void {
    this.ensureDataDir();
    portrait.updatedAt = new Date().toISOString();
    portrait.version += 1;
    fs.writeFileSync(this.portraitPath, JSON.stringify(portrait, null, 2));
  }

  /**
   * 初始化画像（首次使用时引导用户填写）
   */
  async initializeWithQuestions(): Promise<{
    questions: string[];
    portrait: UserPortrait;
  }> {
    const portrait = this.load();

    // 如果已经有数据，只返回需要补充的问题
    const questions: string[] = [];

    if (!portrait.basics.industry) {
      questions.push('你现在的行业/职业是什么？');
    }

    if (portrait.basics.incomeStructure.sources.length === 0) {
      questions.push('你目前的收入来源有几个？分别是什么？（按重要性排序）');
    }

    if (!portrait.basics.resources.skills.length) {
      questions.push('你核心掌握的技能有哪些？');
    }

    if (portrait.behaviorPatterns.stuckPoints.length === 0) {
      questions.push('你做事时容易卡住的环节是什么？');
    }

    if (portrait.behaviorPatterns.procrastinationTriggers.length === 0) {
      questions.push('什么情况最容易让你拖延？');
    }

    // 如果问题太多，分批问
    return {
      questions: questions.slice(0, 3),  // 每次最多问 3 个
      portrait
    };
  }

  /**
   * 根据用户回答更新画像
   */
  updateFromAnswer(question: string, answer: string): UserPortrait {
    const portrait = this.load();

    // 解析答案并更新对应字段
    if (question.includes('行业') || question.includes('职业')) {
      portrait.basics.industry = answer;
    }

    if (question.includes('收入来源')) {
      const sources = answer.split(/[,,]/).map(s => s.trim()).filter(Boolean);
      portrait.basics.incomeStructure.sources = sources.map((name, idx) => ({
        name,
        amount: 0,  // 需要后续追问具体数字
        stability: 'unstable',
        percentage: Math.round(100 / sources.length)
      }));
      if (sources.length > 0) {
        portrait.basics.incomeStructure.largestSource = sources[0];
      }
    }

    if (question.includes('技能')) {
      portrait.basics.resources.skills = answer.split(/[,,]/).map(s => s.trim()).filter(Boolean);
    }

    if (question.includes('卡住')) {
      portrait.behaviorPatterns.stuckPoints = answer.split(/[,,]/).map(s => s.trim()).filter(Boolean);
    }

    if (question.includes('拖延')) {
      portrait.behaviorPatterns.procrastinationTriggers = answer.split(/[,,]/).map(s => s.trim()).filter(Boolean);
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
    portrait: UserPortrait,
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
        reason
      });
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
      outcome
    });
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
      trigger
    });
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
      '学习能力': portrait.abilities.learningAbility
    };
  }

  /**
   * 获取最新画像摘要（用于 AI 上下文）
   */
  getSummary(): string {
    const portrait = this.load();
    const parts: string[] = [];

    if (portrait.basics.industry) {
      parts.push(`行业：${portrait.basics.industry}`);
    }

    if (portrait.basics.incomeStructure.largestSource) {
      parts.push(`最大收入来源：${portrait.basics.incomeStructure.largestSource}`);
    }

    parts.push(`决策风格：${this.translateDecisionStyle(portrait.behaviorPatterns.decisionStyle)}`);

    if (portrait.growthTrack.cognitionUpgrades.length > 0) {
      const latest = portrait.growthTrack.cognitionUpgrades[portrait.growthTrack.cognitionUpgrades.length - 1];
      parts.push(`最近认知升级：${latest.description}`);
    }

    return parts.join(' | ');
  }

  private translateDecisionStyle(style: string): string {
    const map: Record<string, string> = {
      'impulsive': '冲动型',
      'hesitant': '犹豫型',
      'rational': '理性型',
      'intuitive': '直觉型'
    };
    return map[style] || style;
  }
}
