import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AIService, ChatMessage } from '../ai';

const DATA_DIR = path.join(__dirname, '../../data');

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Challenge {
  id: string;
  date: string;
  question: string;
  related_ability: string;
  difficulty: Difficulty;
  user_answer?: string;
  ai_evaluation?: string;
  score?: number;
  answered: boolean;
  answer_date?: string;
  evaluation_criteria?: string;
}

/**
 * 认知挑战系统管理器
 */
export class CognitionChallengeManager {
  private aiService: AIService;

  constructor(private userId: string = 'default') {
    this.aiService = new AIService();
  }

  private getChallengesPath(): string {
    return path.join(DATA_DIR, `challenges_${this.userId}.json`);
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 加载所有挑战
   */
  load(): Challenge[] {
    const path_ = this.getChallengesPath();
    if (fs.existsSync(path_)) {
      const data = fs.readFileSync(path_, 'utf-8');
      return JSON.parse(data) as Challenge[];
    }
    return [];
  }

  /**
   * 保存挑战
   */
  save(challenges: Challenge[]): void {
    this.ensureDataDir();
    fs.writeFileSync(this.getChallengesPath(), JSON.stringify(challenges, null, 2));
  }

  /**
   * 获取未回答的挑战
   */
  getPendingChallenge(): Challenge | undefined {
    const challenges = this.load();
    return challenges.find(c => !c.answered);
  }

  /**
   * 生成挑战题（每周二、周五调用）
   */
  async generateChallenge(
    profile: any,
    goals: any[],
    recentTopics: string[],
    recentChallenges: Challenge[]
  ): Promise<Challenge> {
    // 找到最薄弱的能力维度
    const abilities = profile.abilities || {};
    const abilityScores = Object.entries(abilities) as [string, number][];
    abilityScores.sort((a, b) => a[1] - b[1]);
    const weakestAbilities = abilityScores.slice(0, 2).map(([key]) => key);

    const prompt = `你是认知教练。为用户生成 1 个思考题。

用户画像：${JSON.stringify(profile)}
当前目标：${JSON.stringify(goals)}
最薄弱维度：${JSON.stringify(weakestAbilities)}
最近话题：${JSON.stringify(recentTopics)}
最近 5 次挑战：${JSON.stringify(recentChallenges.slice(-5).map(c => c.question))}（避免重复）

要求：
1. 针对最薄弱的能力维度
2. 跟用户当前阶段和行业直接相关
3. 用第一性原理的方式提问
4. 能暴露认知盲区
5. 不超过 3 句话
6. 不要跟最近 5 次重复

输出 JSON：
{
  "question": "问题内容",
  "related_ability": "对应的能力维度",
  "difficulty": "easy/medium/hard",
  "evaluation_criteria": "评估标准（用于评分）"
}`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个认知教练，擅长用第一性原理设计思考题。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 400 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr);

      // 保存到挑战记录
      const challenge: Challenge = {
        id: `c_${uuidv4()}`,
        date: new Date().toISOString(),
        answered: false,
        ...result,
      };

      const challenges = this.load();
      challenges.push(challenge);
      this.save(challenges);

      return challenge;
    } catch (error) {
      console.error('[CognitionChallenge] 生成挑战失败:', error);
      throw error;
    }
  }

  /**
   * 评估用户回答
   */
  async evaluateAnswer(
    challengeId: string,
    userAnswer: string,
    profile: any
  ): Promise<{
    score: number;
    evaluation: string;
    insight: string;
    ability_adjustment: number;
  }> {
    const challenges = this.load();
    const challenge = challenges.find(c => c.id === challengeId);

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    const prompt = `评估用户对以下问题的回答。

问题：${challenge.question}
评估标准：${challenge.evaluation_criteria}
用户回答：${userAnswer}
用户画像：${JSON.stringify(profile)}

输出 JSON：
{
  "score": 1-10 的评分,
  "evaluation": "评价（不超过 100 字，指出优点和盲区）",
  "insight": "这道题揭示了用户在 xxx 方面的认知水平",
  "ability_adjustment": 0.0
}

评分标准：
1-3：没有抓住问题本质
4-6：有思考但有明显盲区
7-8：分析到位，有独立见解
9-10：超出预期，有深度洞察

ability_adjustment 范围：-0.5 到 +0.5`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个认知评估专家。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 400 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr);

      // 更新挑战记录
      challenge.answered = true;
      challenge.user_answer = userAnswer;
      challenge.ai_evaluation = result.evaluation;
      challenge.score = result.score;
      challenge.answer_date = new Date().toISOString();
      this.save(challenges);

      return result;
    } catch (error) {
      console.error('[CognitionChallenge] 评估失败:', error);
      throw error;
    }
  }

  /**
   * 获取挑战摘要
   */
  getSummary(): string {
    const challenges = this.load();
    const answered = challenges.filter(c => c.answered).length;
    const avgScore = answered > 0
      ? (challenges.filter(c => c.answered && c.score).reduce((sum, c) => sum + (c.score || 0), 0) / answered).toFixed(1)
      : 0;
    return `认知挑战：已完成${answered}/${challenges.length}，平均分${avgScore}`;
  }
}
