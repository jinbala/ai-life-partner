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

/**
 * 定时任务服务
 */
export class SchedulerService {
  private userRepository: UserRepository;
  private messageService: FeishuMessageService;
  private morningPushJob: ScheduledTask | null = null;
  private reviewReminderJob: ScheduledTask | null = null;

  constructor() {
    this.userRepository = new UserRepository();
    this.messageService = new FeishuMessageService();
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
    logger.info('[Scheduler] 定时任务已停止');
  }

  /**
   * 发送早上推送
   */
  private async sendMorningPush(): Promise<void> {
    logger.info('[MorningPush] 开始发送早上推送...');

    const users = this.userRepository.findWithMorningPushEnabled();
    const today = new Date();
    const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        const goals = new GoalService(user.id);
        const goalSummary = goals.getSummary();
        const tasks = goals.getTodayTasks();

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

    const users = this.userRepository.findWithReviewReminderEnabled();

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
}
