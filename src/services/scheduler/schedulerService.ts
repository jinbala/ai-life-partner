/**
 * 定时任务服务
 * 使用 node-cron 管理定时推送
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { UserRepository, ConversationHistoryRepository, DailyTaskRepository, ReviewRepository } from '../../database/repositories';
import { FeishuMessageService } from '../../integrations/feishu';
import { GoalService } from '../../services/user/goalService';
import { PortraitEvolutionService } from '../../services/user/portraitEvolutionService';
import { AIService } from '../../services/ai/aiService';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 定时任务服务
 */
export class SchedulerService {
  private userRepository: UserRepository;
  private messageService: FeishuMessageService;
  private portraitEvolution: PortraitEvolutionService;
  private aiService: AIService;
  private conversationRepo: ConversationHistoryRepository;
  private taskRepo: DailyTaskRepository;
  private reviewRepo: ReviewRepository;
  private morningPushJob: ScheduledTask | null = null;
  private reviewReminderJob: ScheduledTask | null = null;
  private databaseBackupJob: ScheduledTask | null = null;
  private weeklyPortraitAnalysisJob: ScheduledTask | null = null;
  private dailySummaryJob: ScheduledTask | null = null;
  private conversationCleanupJob: ScheduledTask | null = null;
  private backupDir: string;

  constructor() {
    this.userRepository = new UserRepository();
    this.messageService = new FeishuMessageService();
    this.portraitEvolution = new PortraitEvolutionService();
    this.aiService = new AIService();
    this.conversationRepo = new ConversationHistoryRepository();
    this.taskRepo = new DailyTaskRepository();
    this.reviewRepo = new ReviewRepository();
    this.backupDir = path.join(process.cwd(), 'data', 'backups');

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 启动所有定时任务
   */
  start(): void {
    // 每天早上 8:00 发送推送
    this.morningPushJob = cron.schedule('0 8 * * *', () => {
      this.sendMorningPush().catch(err => {
        logger.error('[Scheduler] 早上推送失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    // 每天晚上 9:00 发送复盘提醒
    this.reviewReminderJob = cron.schedule('0 21 * * *', () => {
      this.sendReviewReminder().catch(err => {
        logger.error('[Scheduler] 复盘提醒失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    // 每天凌晨 3:00 备份数据库
    this.databaseBackupJob = cron.schedule('0 3 * * *', () => {
      this.backupDatabase().catch(err => {
        logger.error('[Scheduler] 数据库备份失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    // 每周一上午 10:00 执行画像分析（为活跃用户）
    this.weeklyPortraitAnalysisJob = cron.schedule('0 10 * * 1', () => {
      this.runWeeklyPortraitAnalysis().catch(err => {
        logger.error('[Scheduler] 周画像分析失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    // 每天晚上 11:00 自动生成当日总结
    this.dailySummaryJob = cron.schedule('0 23 * * *', () => {
      this.generateDailySummary().catch(err => {
        logger.error('[Scheduler] 每日总结失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    // 每周日凌晨 2:00 清理过期对话（保留 90 天）
    this.conversationCleanupJob = cron.schedule('0 2 * * 0', () => {
      this.cleanupOldConversations().catch(err => {
        logger.error('[Scheduler] 对话清理失败', err);
      });
    }, {
      timezone: 'Asia/Shanghai',
    });

    logger.info('[Scheduler] 定时任务已启动');
  }

  /**
   * 停止所有定时任务
   */
  stop(): void {
    if (this.morningPushJob) {
      this.morningPushJob.stop();
      this.morningPushJob = null;
    }
    if (this.reviewReminderJob) {
      this.reviewReminderJob.stop();
      this.reviewReminderJob = null;
    }
    if (this.databaseBackupJob) {
      this.databaseBackupJob.stop();
      this.databaseBackupJob = null;
    }
    if (this.weeklyPortraitAnalysisJob) {
      this.weeklyPortraitAnalysisJob.stop();
      this.weeklyPortraitAnalysisJob = null;
    }
    if (this.dailySummaryJob) {
      this.dailySummaryJob.stop();
      this.dailySummaryJob = null;
    }
    if (this.conversationCleanupJob) {
      this.conversationCleanupJob.stop();
      this.conversationCleanupJob = null;
    }
    logger.info('[Scheduler] 定时任务已停止');
  }

  /**
   * 发送早上推送
   */
  private async sendMorningPush(): Promise<void> {
    logger.info('[MorningPush] 开始发送早上推送...');

    const users = await this.userRepository.findWithMorningPushEnabled();
    const today = new Date();
    const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const goals = new GoalService(user.id);
        const goalSummary = await goals.getSummary();
        const tasks = await goals.getTodayTasks();

        let content = `☀️ 早上好！${dateStr}\n\n`;

        if (tasks.length > 0) {
          content += `📋 今日任务：\n`;
          tasks.forEach((t, i) => {
            content += `${t.isCompleted ? '✅' : '⬜'} ${i + 1}. ${t.description}\n`;
          });
          content += '\n';
        }

        content += `💬 当前目标：${goalSummary || '暂无明确目标'}\n\n`;
        content += `今天有什么重要计划？随时跟我聊聊。`;

        await this.messageService.sendTextMessage(user.open_id, content);
        successCount++;
        logger.info('[MorningPush] 已发送给用户', { openId: user.open_id });
      } catch (error) {
        failCount++;
        logger.error('[MorningPush] 发送失败', { openId: user.open_id, error });
      }
    }

    logger.info('[MorningPush] 推送完成', { total: users.length, success: successCount, failed: failCount });
  }

  /**
   * 发送复盘提醒
   */
  private async sendReviewReminder(): Promise<void> {
    logger.info('[ReviewReminder] 开始发送复盘提醒...');

    const users = await this.userRepository.findWithReviewReminderEnabled();

    for (const user of users) {
      try {
        const content = `📝 每日复盘时间到了！

1. 今天最重要的事完成了吗？
2. 卡在哪了？
3. 明天第一件事做什么？

直接回复就行，每个问题一句话。`;

        await this.messageService.sendTextMessage(user.open_id, content);
        logger.info('[ReviewReminder] 已发送给用户', { openId: user.open_id });
      } catch (error) {
        logger.error('[ReviewReminder] 发送失败', { openId: user.open_id, error });
      }
    }

    logger.info('[ReviewReminder] 提醒完成', { total: users.length });
  }

  /**
   * 备份数据库
   */
  private async backupDatabase(): Promise<void> {
    logger.info('[DatabaseBackup] 开始备份数据库...');

    try {
      const dbPath = path.join(process.cwd(), 'data', 'app.db');

      if (!fs.existsSync(dbPath)) {
        logger.warn('[DatabaseBackup] 数据库文件不存在，跳过备份');
        return;
      }

      // 生成备份文件名（带日期）
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timestamp = date.getTime();
      const backupFileName = `app_backup_${dateStr}_${timestamp}.db`;
      const backupPath = path.join(this.backupDir, backupFileName);

      // 复制数据库文件
      fs.copyFileSync(dbPath, backupPath);

      // 清理 7 天前的旧备份
      this.cleanupOldBackups(7);

      const stats = fs.statSync(backupPath);
      logger.info('[DatabaseBackup] 备份完成', {
        backupPath,
        size: (stats.size / 1024).toFixed(2) + ' KB',
      });
    } catch (error) {
      logger.error('[DatabaseBackup] 备份失败', error);
      throw error;
    }
  }

  /**
   * 清理过期备份
   */
  private cleanupOldBackups(keepDays: number): void {
    try {
      const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);
      const files = fs.readdirSync(this.backupDir);

      let deletedCount = 0;
      for (const file of files) {
        if (!file.startsWith('app_backup_') || !file.endsWith('.db')) {
          continue;
        }

        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        logger.info('[DatabaseBackup] 清理过期备份', { deleted: deletedCount });
      }
    } catch (error) {
      logger.error('[DatabaseBackup] 清理过期备份失败', error);
    }
  }

  /**
   * 每周画像分析（为活跃用户）
   */
  private async runWeeklyPortraitAnalysis(): Promise<void> {
    logger.info('[PortraitAnalysis] 开始执行周画像分析...');

    try {
      // 获取所有用户
      const users = await this.userRepository.findAll();

      let analyzedCount = 0;
      let updatedCount = 0;

      for (const user of users) {
        // 这里可以添加活跃度判断，只分析活跃用户
        // 简单实现：分析所有用户
        const result = await this.portraitEvolution.analyzeAndUpdatePortrait(
          user.id,
          [], // 空对话，仅触发能力分数检查
          true // 强制更新版本号
        );

        analyzedCount++;
        if (result.portraitUpdates.length > 0) {
          updatedCount++;
          logger.info('[PortraitAnalysis] 用户画像已更新', {
            userId: user.id,
            updates: result.portraitUpdates.length,
          });
        }
      }

      logger.info('[PortraitAnalysis] 周画像分析完成', {
        total: users.length,
        analyzed: analyzedCount,
        updated: updatedCount,
      });
    } catch (error) {
      logger.error('[PortraitAnalysis] 周画像分析失败', error);
      throw error;
    }
  }

  /**
   * 生成每日自动总结（晚上 11 点执行）
   */
  private async generateDailySummary(): Promise<void> {
    logger.info('[DailySummary] 开始生成每日总结...');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

      // 获取所有用户
      const users = await this.userRepository.findAll();
      let successCount = 0;

      for (const user of users) {
        try {
          // 获取当天的对话历史
          const conversations = await this.conversationRepo.findByDate(user.id, dateStr);
          if (conversations.length === 0) {
            logger.debug('[DailySummary] 用户今日无对话，跳过', { userId: user.id });
            continue;
          }

          // 获取当天完成的任务
          const tasks = await this.taskRepo.findByDate(user.id, dateStr);
          const completedTasks = tasks.filter(t => t.is_completed === 1);

          // 检查是否已有日记
          const existingReviews = await this.reviewRepo.findByType(user.id, 'daily');
          const existingEntry = existingReviews.find(r => r.period_start === dateStr);
          if (existingEntry) {
            logger.debug('[DailySummary] 用户今日已有日记，跳过自动生成', { userId: user.id });
            continue;
          }

          // 准备 AI 分析的上下文
          const conversationText = conversations
            .slice(0, 50) // 限制对话数量
            .map(c => `${c.role === 'user' ? '用户' : 'AI'}: ${c.content.substring(0, 200)}`)
            .join('\n');

          const tasksText = completedTasks.length > 0
            ? completedTasks.map(t => `- ${t.description}`).join('\n')
            : '无完成任务';

          const prompt = `请为以下用户当日活动生成一份简洁的总结日记：

【对话记录】
${conversationText}

【完成任务】
${tasksText}

请生成一份 200-300 字的总结，包含：
1. 今日主要活动/讨论话题
2. 完成的任务
3. 关键洞察或收获（如果有）
4. 温磬提示或建议

保持友好、鼓励的语气，用中文回复。`;

          const aiResponse = await this.aiService.chat([
            { role: 'user', content: prompt },
          ], {
            maxTokens: 500,
            temperature: 0.7,
          });

          // 创建日记条目
          await this.reviewRepo.create({
            user_id: user.id,
            type: 'daily',
            period_start: dateStr,
            period_end: dateStr,
            content: aiResponse.content,
          });

          successCount++;
          logger.info('[DailySummary] 已为用户生成每日总结', {
            userId: user.id,
            conversations: conversations.length,
            completedTasks: completedTasks.length,
          });
        } catch (error) {
          logger.error('[DailySummary] 用户总结失败', {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('[DailySummary] 每日总结完成', {
        totalUsers: users.length,
        success: successCount,
      });
    } catch (error) {
      logger.error('[DailySummary] 每日总结失败', error);
      throw error;
    }
  }

  /**
   * 清理过期对话（保留 90 天）
   */
  private async cleanupOldConversations(): Promise<void> {
    logger.info('[ConversationCleanup] 开始清理过期对话...');

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 保留 90 天
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      // 获取所有用户
      const users = await this.userRepository.findAll();
      let totalDeleted = 0;

      for (const user of users) {
        try {
          const deleted = await this.conversationRepo.deleteBefore(user.id, cutoffDateStr);
          if (deleted > 0) {
            logger.info('[ConversationCleanup] 已清理用户旧对话', {
              userId: user.id,
              deleted,
            });
            totalDeleted += deleted;
          }
        } catch (error) {
          logger.error('[ConversationCleanup] 用户清理失败', {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('[ConversationCleanup] 对话清理完成', {
        totalUsers: users.length,
        totalDeleted,
        cutoffDate: cutoffDateStr,
      });
    } catch (error) {
      logger.error('[ConversationCleanup] 对话清理失败', error);
      throw error;
    }
  }
}
