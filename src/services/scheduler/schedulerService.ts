/**
 * 定时任务服务
 * 使用 node-cron 管理定时推送
 */

import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { UserRepository } from '../../database/repositories';
import { FeishuMessageService } from '../../integrations/feishu';
import { GoalService } from '../../services/user/goalService';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 定时任务服务
 */
export class SchedulerService {
  private userRepository: UserRepository;
  private messageService: FeishuMessageService;
  private morningPushJob: ScheduledTask | null = null;
  private reviewReminderJob: ScheduledTask | null = null;
  private databaseBackupJob: ScheduledTask | null = null;
  private backupDir: string;

  constructor() {
    this.userRepository = new UserRepository();
    this.messageService = new FeishuMessageService();
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
}
