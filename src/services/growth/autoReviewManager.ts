import * as fs from 'fs';
import * as path from 'path';
import { AIService, ChatMessage } from '../ai';

const DATA_DIR = path.join(__dirname, '../../data');

export interface ProfileUpdateResult {
  profile_updates: Record<string, any>;
  new_pattern: string | null;
  growth_signal: string | null;
  risk_signal: string | null;
  goal_deviation: string | null;
  emotion_state: 'normal' | 'low' | 'anxious' | 'excited';
}

export interface WeeklyReviewResult {
  report: string;
  ability_adjustments: Record<string, number>;
}

/**
 * 自动复盘与画像更新系统
 */
export class AutoReviewManager {
  private aiService: AIService;

  constructor(private userId: string = 'default') {
    this.aiService = new AIService();
  }

  private getDataPath(name: string): string {
    return path.join(DATA_DIR, `${name}_${this.userId}.json`);
  }

  /**
   * 每次对话后的轻量分析
   */
  async analyzeConversation(
    conversation: string,
    currentProfile: any
  ): Promise<ProfileUpdateResult> {
    const prompt = `你是一个用户分析系统。分析以下对话，判断用户画像是否需要更新。

当前画像摘要：
${JSON.stringify(currentProfile, null, 2)}

本次对话：
${conversation}

请分析并输出 JSON：
{
  "profile_updates": {},
  "new_pattern": null,
  "growth_signal": null,
  "risk_signal": null,
  "goal_deviation": null,
  "emotion_state": "normal"
}

要求：
- profile_updates: 只包含需要更新的字段，没变化的不要包含
- 不要为了输出而编造变化
- 能力雷达分数变化要有明确依据
- 单次对话最多调整 1 个维度，且变化不超过 0.5 分
- 没有变化的字段输出 null 或空对象`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个专业的用户行为分析师。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 500 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr) as ProfileUpdateResult;

      return result;
    } catch (error) {
      console.error('[AutoReview] 分析对话失败:', error);
      return {
        profile_updates: {},
        new_pattern: null,
        growth_signal: null,
        risk_signal: null,
        goal_deviation: null,
        emotion_state: 'normal',
      };
    }
  }

  /**
   * 周度深度分析（每周日 20:00 调用）
   */
  async weeklyReview(
    profile: any,
    weeklyGoals: any[],
    dailyLogsSummary: string,
    decisions: any[],
    newMemories: any[]
  ): Promise<string> {
    const prompt = `你是用户的 AI 合伙人。根据以下数据生成周度复盘报告。

用户画像：${JSON.stringify(profile)}
本周目标：${JSON.stringify(weeklyGoals)}
本周对话摘要：${dailyLogsSummary}
本周决策：${JSON.stringify(decisions)}
本周新增记忆：${JSON.stringify(newMemories)}

生成报告，格式：
📊 本周复盘（MM.DD - MM.DD）

**执行情况**
- 任务完成：X/Y
- 完成的：xxx
- 未完成的：xxx（原因）

**能力变化**
- 本周观察到：xxx
- 能力雷达建议调整：xxx 维度 从 X 到 Y，因为 xxx

**关键发现**
- xxx

**下周建议**
最重要的 1 件事：xxx

报告不超过 300 字。`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个专业的成长教练，擅长复盘和反馈。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 500 });
      return response.content;
    } catch (error) {
      console.error('[AutoReview] 周度复盘失败:', error);
      return '本周复盘生成失败，请稍后再试。';
    }
  }

  /**
   * 月度分析（每月 1 号调用）
   */
  async monthlyReview(
    monthlyData: any,
    lastMonthRadar: Record<string, number>,
    currentRadar: Record<string, number>,
    northStar: string
  ): Promise<string> {
    const prompt = `生成月度体检报告。

本月数据：${JSON.stringify(monthlyData)}
上月能力雷达：${JSON.stringify(lastMonthRadar)}
本月能力雷达：${JSON.stringify(currentRadar)}
北极星目标：${northStar}

格式：
📊 X 月体检报告

🧠 认知成长
- 本月决策 X 个，其中 Y 个经过系统分析
- 决策质量趋势：上升/下降/持平

🎯 目标进度
- 北极星：xxx，进度 X%
- 本月里程碑：完成 X/Y 个

💪 执行力
- 任务完成率：X%
- 对比上月：+X% / -X%

💎 资产积累
- 新增思维框架 X 个
- 新增经验教训 X 条

📈 能力雷达变化
- 商业判断：X → Y（原因）
- 执行力：X → Y（原因）
...

⚠️ 需要关注
- xxx

📌 下月最重要的事
- xxx

报告不超过 500 字。`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个专业的月度报告生成器。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 800 });
      return response.content;
    } catch (error) {
      console.error('[AutoReview] 月度复盘失败:', error);
      return '月度体检报告生成失败，请稍后再试。';
    }
  }

  /**
   * 应用画像更新
   */
  async applyProfileUpdates(
    updates: Record<string, any>,
    profileManager: any
  ): Promise<void> {
    if (!updates || Object.keys(updates).length === 0) return;

    const portrait = profileManager.load();

    // 递归更新嵌套字段
    const applyUpdate = (obj: any, path: string, value: any) => {
      const keys = path.split('.');
      let current = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    };

    for (const [key, value] of Object.entries(updates)) {
      applyUpdate(portrait, key, value);
    }

    profileManager.save(portrait);
    console.log('[AutoReview] 画像已更新:', updates);
  }
}
