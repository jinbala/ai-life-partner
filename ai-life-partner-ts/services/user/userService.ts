/**
 * 用户综合服务层
 * 统一管理所有子服务
 */

import { PortraitService } from './portraitService';
import { GoalService } from './goalService';
import { MemoryService } from '../memory/memoryService';
import { AbilityAssetService } from '../assets/abilityAssetService';
import { DecisionFeedbackService } from '../decision/decisionFeedbackService';
import { CognitionChallengeService } from '../growth/cognitionChallengeService';
import { ReviewService } from '../growth/reviewService';
import { PortraitEvolutionService } from './portraitEvolutionService';

/**
 * 综合服务实例
 */
export class UserService {
  public readonly portrait: PortraitService;
  public readonly goals: GoalService;
  public readonly memories: MemoryService;
  public readonly assets: AbilityAssetService;
  public readonly decisions: DecisionFeedbackService;
  public readonly challenges: CognitionChallengeService;
  public readonly reviews: ReviewService;
  public readonly evolution: PortraitEvolutionService;

  constructor(userId: string) {
    this.portrait = new PortraitService(userId);
    this.goals = new GoalService(userId);
    this.memories = new MemoryService(userId);
    this.assets = new AbilityAssetService(userId);
    this.decisions = new DecisionFeedbackService(userId);
    this.challenges = new CognitionChallengeService(userId);
    this.reviews = new ReviewService(userId);
    this.evolution = new PortraitEvolutionService();
  }

  /**
   * 获取所有服务的摘要
   */
  async getSummary(): Promise<string> {
    const parts: string[] = [];

    const portraitSummary = await this.portrait.getSummary();
    if (portraitSummary) parts.push(`[画像] ${portraitSummary}`);

    const goalSummary = await this.goals.getSummary();
    if (goalSummary) parts.push(`[目标] ${goalSummary}`);

    const memorySummary = await this.memories.getSummary();
    if (memorySummary) parts.push(`[记忆] ${memorySummary}`);

    const assetSummary = await this.assets.getSummary();
    if (assetSummary) parts.push(`[资产] ${assetSummary}`);

    const decisionSummary = await this.decisions.getSummary();
    if (decisionSummary) parts.push(`[决策] ${decisionSummary}`);

    const challengeSummary = await this.challenges.getSummary();
    if (challengeSummary) parts.push(`[挑战] ${challengeSummary}`);

    const reviewSummary = await this.reviews.getSummary();
    if (reviewSummary) parts.push(`[复盘] ${reviewSummary}`);

    return parts.join('\n') || '暂无数据';
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.portrait.clearCache();
    this.memories.clearCache();
    this.assets.clearCache();
  }

  /**
   * 获取成长轨迹摘要
   */
  async getGrowthSummary(days: number = 30): Promise<string> {
    return await this.evolution.getGrowthSummary(this.portrait['userId'], days);
  }
}
