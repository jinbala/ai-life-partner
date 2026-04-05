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
  exportUserData(userId: string): ExportData {
    logger.info('[DataExport] 开始导出数据', { userId });

    try {
      const user = this.userRepo.findById(userId);
      if (!user) {
        throw new Error('用户不存在');
      }

      const portrait = this.portraitRepo.findByUserId(userId);

      const data: ExportData = {
        exported_at: new Date().toISOString(),
        user: this.sanitizeUser(user),
        portraits: portrait ? [portrait] : [],
        goals: this.goalRepo.findByUser(userId),
        tasks: this.taskRepo.findByUser(userId),
        memories: this.memoryRepo.findByUser(userId),
        abilities: this.abilityRepo.findByUser(userId),
        decisions: this.decisionRepo.findByUser(userId),
        challenges: this.challengeRepo.findByUser(userId),
        reviews: this.reviewRepo.findByUser(userId),
        token_usage_summary: this.tokenUsageRepo.getTotalSummary(userId),
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
      logger.error('[DataExport] 导出失败', error);
      throw error;
    }
  }

  /**
   * 导出所有用户数据（管理员功能）
   */
  exportAllData(): ExportData & { users_count: number } {
    logger.info('[DataExport] 开始导出所有用户数据');

    const users = this.userRepo.findAll();
    const allData = users.map(user => this.exportUserData(user.id));

    return {
      exported_at: new Date().toISOString(),
      users_count: users.length,
      user: null as any,
      portraits: allData.flatMap(d => d.portraits),
      goals: allData.flatMap(d => d.goals),
      tasks: allData.flatMap(d => d.tasks),
      memories: allData.flatMap(d => d.memories),
      abilities: allData.flatMap(d => d.abilities),
      decisions: allData.flatMap(d => d.decisions),
      challenges: allData.flatMap(d => d.challenges),
      reviews: allData.flatMap(d => d.reviews),
      token_usage_summary: this.tokenUsageRepo.getTotalSummary(),
    };
  }

  /**
   * 导出为 JSON 文件
   */
  exportToFile(userId: string, filePath: string): void {
    const data = this.exportUserData(userId);
    const fs = require('fs');
    const path = require('path');

    // 确保目录存在
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('[DataExport] 数据已导出到文件', { filePath });
  }

  /**
   * 清理敏感信息
   */
  private sanitizeUser(user: any): any {
    const { ...safeUser } = user;
    // 移除可能的敏感字段
    delete (safeUser as any).password;
    delete (safeUser as any).token;
    delete (safeUser as any).secret;
    return safeUser;
  }

  /**
   * 获取导出统计
   */
  getExportStats(): {
    total_users: number;
    total_records: {
      portraits: number;
      goals: number;
      tasks: number;
      memories: number;
      abilities: number;
      decisions: number;
      challenges: number;
      reviews: number;
    };
  } {
    const db = require('../../database').getDatabase();

    return {
      total_users: this.userRepo.findAll().length,
      total_records: {
        portraits: db.prepare('SELECT COUNT(*) as count FROM user_portraits').get().count,
        goals: db.prepare('SELECT COUNT(*) as count FROM goals').get().count,
        tasks: db.prepare('SELECT COUNT(*) as count FROM daily_tasks').get().count,
        memories: db.prepare('SELECT COUNT(*) as count FROM memories').get().count,
        abilities: db.prepare('SELECT COUNT(*) as count FROM ability_assets').get().count,
        decisions: db.prepare('SELECT COUNT(*) as count FROM decisions').get().count,
        challenges: db.prepare('SELECT COUNT(*) as count FROM challenges').get().count,
        reviews: db.prepare('SELECT COUNT(*) as count FROM reviews').get().count,
      },
    };
  }
}
