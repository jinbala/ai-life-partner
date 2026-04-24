/**
 * 数据导出服务
 * 支持导出用户所有数据为 JSON 格式
 */

import {
  UserRepository,
  PortraitRepository,
  GoalRepository,
  DailyTaskRepository,
  MemoryRepository,
  AbilityAssetRepository,
  DecisionRepository,
  ChallengeRepository,
  ReviewRepository,
  TokenUsageRepository,
} from '../../database/repositories';
import { SessionRepository } from '../../database/repositories/sessionRepository';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportData {
  exported_at: string;
  user: any;
  portraits: any[];
  goals: any[];
  tasks: any[];
  memories: any[];
  abilities: any[];
  decisions: any[];
  challenges: any[];
  reviews: any[];
  token_usage_summary: any;
}

/**
 * 数据导出服务
 */
export class DataExportService {
  private userRepo: UserRepository;
  private portraitRepo: PortraitRepository;
  private goalRepo: GoalRepository;
  private taskRepo: DailyTaskRepository;
  private memoryRepo: MemoryRepository;
  private abilityRepo: AbilityAssetRepository;
  private decisionRepo: DecisionRepository;
  private challengeRepo: ChallengeRepository;
  private reviewRepo: ReviewRepository;
  private tokenUsageRepo: TokenUsageRepository;
  private sessionRepo: SessionRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.portraitRepo = new PortraitRepository();
    this.goalRepo = new GoalRepository();
    this.taskRepo = new DailyTaskRepository();
    this.memoryRepo = new MemoryRepository();
    this.abilityRepo = new AbilityAssetRepository();
    this.decisionRepo = new DecisionRepository();
    this.challengeRepo = new ChallengeRepository();
    this.reviewRepo = new ReviewRepository();
    this.tokenUsageRepo = new TokenUsageRepository();
    this.sessionRepo = new SessionRepository();
  }

  /**
   * 导出用户所有数据
   */
  async exportUserData(userId: string): Promise<ExportData> {
    logger.info('[DataExport] 开始导出数据', { userId });

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const portrait = await this.portraitRepo.findByUserId(userId);

      const [goals, tasks, memories, abilities, decisions, challenges, reviews, tokenSummary] = await Promise.all([
        this.goalRepo.findByUser(userId),
        this.taskRepo.findByUser(userId),
        this.memoryRepo.findByUser(userId),
        this.abilityRepo.findByUser(userId),
        this.decisionRepo.findByUser(userId),
        this.challengeRepo.findByUser(userId),
        this.reviewRepo.findByUser(userId),
        this.tokenUsageRepo.getTotalSummary(userId),
      ]);

      const data: ExportData = {
        exported_at: new Date().toISOString(),
        user: this.sanitizeUser(user),
        portraits: portrait ? [portrait] : [],
        goals,
        tasks,
        memories,
        abilities,
        decisions,
        challenges,
        reviews,
        token_usage_summary: tokenSummary,
      };

      logger.info('[DataExport] 导出完成', {
        userId,
        recordCount: {
          goals: data.goals.length,
          tasks: data.tasks.length,
          memories: data.memories.length,
          abilities: data.abilities.length,
          decisions: data.decisions.length,
          challenges: data.challenges.length,
          reviews: data.reviews.length,
        },
      });

      return data;
    } catch (error) {
      logger.error('[DataExport] 导出失败', { userId, error });
      throw error;
    }
  }

  /**
   * 导出所有用户数据（用于管理员备份）
   */
  async exportAllUsers(): Promise<ExportData[]> {
    logger.info('[DataExport] 开始导出所有用户数据');

    const users = await this.userRepo.findAll();
    const exports: ExportData[] = [];

    for (const user of users) {
      try {
        const data = await this.exportUserData(user.id);
        exports.push(data);
      } catch (error) {
        logger.error('[DataExport] 用户导出失败', { userId: user.id, error });
      }
    }

    logger.info('[DataExport] 所有用户导出完成', { total: users.length, success: exports.length });
    return exports;
  }

  /**
   * 清理用户敏感信息
   */
  private sanitizeUser(user: any): any {
    const { id, open_id, created_at, updated_at, morning_push_enabled, review_reminder_enabled } = user;
    return {
      id,
      open_id,
      created_at,
      updated_at,
      morning_push_enabled,
      review_reminder_enabled,
    };
  }

  /**
   * 导出数据到文件
   */
  async exportToFile(userId: string, filePath: string): Promise<string> {
    const data = await this.exportUserData(userId);

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    logger.info('[DataExport] 文件导出成功', { userId, filePath });
    return filePath;
  }
}
