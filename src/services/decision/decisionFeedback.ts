import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AIService, ChatMessage } from '../ai';

const DATA_DIR = path.join(__dirname, '../../data');

export interface DecisionOption {
  name: string;
  cost: string;
  benefit: string;
  reversible: boolean;
}

export interface DecisionRecord {
  id: string;
  date: string;
  topic: string;
  essence: string;
  options: DecisionOption[];
  chosen: string;
  reason: string;
  expected_outcome: string;
  verify_date: string;
  actual_outcome: string;
  deviation: 'small' | 'medium' | 'large' | '';
  deviation_reason: string;
  lesson_extracted: string;
  lesson_asset_id: string;
  profile_impact: string;
  status: 'pending' | 'reviewed';
  reminded: boolean;
}

export interface DecisionStats {
  total: number;
  reviewed: number;
  deviation_small: number;
  deviation_medium: number;
  deviation_large: number;
  accuracy_rate: number;
  top_lessons: string[];
  trend: 'rising' | 'falling' | 'stable';
}

/**
 * 决策反馈闭环管理器
 */
export class DecisionFeedbackManager {
  private aiService: AIService;

  constructor(private userId: string = 'default') {
    this.aiService = new AIService();
  }

  private getDecisionsPath(): string {
    return path.join(DATA_DIR, `decisions_${this.userId}.json`);
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 加载所有决策
   */
  load(): DecisionRecord[] {
    const path_ = this.getDecisionsPath();
    if (fs.existsSync(path_)) {
      const data = fs.readFileSync(path_, 'utf-8');
      return JSON.parse(data) as DecisionRecord[];
    }
    return [];
  }

  /**
   * 保存决策
   */
  save(decisions: DecisionRecord[]): void {
    this.ensureDataDir();
    fs.writeFileSync(this.getDecisionsPath(), JSON.stringify(decisions, null, 2));
  }

  /**
   * 记录新决策（决策引擎完成后调用）
   */
  logDecision(
    topic: string,
    analysisResult: any,
    chosenOption: string,
    reason: string,
    expectedOutcome: string,
    verifyDays: number = 30
  ): DecisionRecord {
    const decisions = this.load();
    const verifyDate = new Date();
    verifyDate.setDate(verifyDate.getDate() + verifyDays);

    const record: DecisionRecord = {
      id: `d_${uuidv4()}`,
      date: new Date().toISOString(),
      topic,
      essence: analysisResult.essence || '',
      options: analysisResult.options || [],
      chosen: chosenOption,
      reason,
      expected_outcome: expectedOutcome,
      verify_date: verifyDate.toISOString(),
      actual_outcome: '',
      deviation: '',
      deviation_reason: '',
      lesson_extracted: '',
      lesson_asset_id: '',
      profile_impact: '',
      status: 'pending',
      reminded: false,
    };

    decisions.push(record);
    this.save(decisions);

    return record;
  }

  /**
   * 检查是否有到期需要复盘的决策
   */
  checkPendingDecisions(): DecisionRecord[] {
    const decisions = this.load();
    const now = new Date();
    const toRemind: DecisionRecord[] = [];

    decisions.forEach(d => {
      if (
        d.status === 'pending' &&
        new Date(d.verify_date) <= now &&
        !d.reminded
      ) {
        d.reminded = true;
        toRemind.push(d);
      }
    });

    if (toRemind.length > 0) {
      this.save(decisions);
    }

    return toRemind;
  }

  /**
   * 关闭决策反馈闭环（用户回报结果后调用）
   */
  async closeDecisionLoop(
    decisionId: string,
    userFeedback: string,
    profileManager: any,
    assetsManager: any,
    memoryManager: any
  ): Promise<string> {
    const decisions = this.load();
    const decision = decisions.find(d => d.id === decisionId);

    if (!decision) {
      throw new Error('Decision not found');
    }

    const prompt = `用户之前做了一个决策，现在回报结果。请分析。

决策记录：
话题：${decision.topic}
选择：${decision.chosen}
预期：${decision.expected_outcome}
用户反馈的实际结果：${userFeedback}

请输出 JSON：
{
  "actual_outcome": "实际结果总结（一句话）",
  "deviation": "small/medium/large",
  "deviation_reason": "偏差原因分析",
  "lesson": "从这次决策中提取的教训（一句话）",
  "ability_impact": {
    "dimension": "影响的能力维度",
    "adjustment": 0.0
  },
  "feedback_to_user": "给用户的反馈（不超过 150 字，包含教训和能力变化）"
}`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个决策分析专家。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 500 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr);

      // 更新决策记录
      decision.actual_outcome = result.actual_outcome;
      decision.deviation = result.deviation;
      decision.deviation_reason = result.deviation_reason;
      decision.lesson_extracted = result.lesson;
      decision.status = 'reviewed';
      decision.profile_impact = result.feedback_to_user;
      this.save(decisions);

      // 自动将 lesson 存入资产库
      const asset = assetsManager.add({
        title: result.lesson.slice(0, 15),
        content: result.lesson,
        tags: ['决策', '复盘', '教训'],
        type: 'lessons',
        source_topic: `决策复盘：${decision.topic}`,
      });
      decision.lesson_asset_id = asset.id;

      // 存入记忆
      memoryManager.add({
        date: new Date().toISOString(),
        type: 'lesson',
        content: result.lesson,
        tags: ['决策', decision.topic],
        importance: 'medium',
        source: '决策复盘',
      });

      // 更新能力分数
      if (result.ability_impact?.adjustment !== 0) {
        const portrait = profileManager.load();
        const dim = result.ability_impact.dimension as keyof typeof portrait.abilities;
        if (portrait.abilities[dim] !== undefined) {
          portrait.abilities[dim] += result.ability_impact.adjustment;
          portrait.abilities[dim] = Math.max(1, Math.min(10, portrait.abilities[dim]));
          profileManager.save(portrait);
        }
      }

      return result.feedback_to_user;
    } catch (error) {
      console.error('[DecisionFeedback] 闭环失败:', error);
      throw error;
    }
  }

  /**
   * 获取决策质量统计
   */
  getDecisionStats(): DecisionStats {
    const decisions = this.load();
    const reviewed = decisions.filter(d => d.status === 'reviewed');

    const deviation_small = reviewed.filter(d => d.deviation === 'small').length;
    const deviation_medium = reviewed.filter(d => d.deviation === 'medium').length;
    const deviation_large = reviewed.filter(d => d.deviation === 'large').length;

    const accuracy_rate = reviewed.length > 0
      ? deviation_small / reviewed.length
      : 0;

    const top_lessons = reviewed
      .filter(d => d.lesson_extracted)
      .slice(-5)
      .map(d => d.lesson_extracted);

    // 趋势：简单对比最近 5 个和前 5 个的准确率
    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    if (reviewed.length >= 10) {
      const recent5 = reviewed.slice(-5);
      const older5 = reviewed.slice(-10, -5);
      const recentAcc = recent5.filter(d => d.deviation === 'small').length / 5;
      const olderAcc = older5.filter(d => d.deviation === 'small').length / 5;
      if (recentAcc > olderAcc + 0.1) trend = 'rising';
      else if (recentAcc < olderAcc - 0.1) trend = 'falling';
    }

    return {
      total: decisions.length,
      reviewed: reviewed.length,
      deviation_small,
      deviation_medium,
      deviation_large,
      accuracy_rate,
      top_lessons,
      trend,
    };
  }

  /**
   * 获取决策摘要
   */
  getSummary(): string {
    const stats = this.getDecisionStats();
    return `决策：${stats.total}个，已复盘${stats.reviewed}个，准确率${(stats.accuracy_rate * 100).toFixed(0)}%`;
  }
}
