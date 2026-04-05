import * as lark from '@larksuiteoapi/node-sdk';
import dotenv from 'dotenv';
import { logger } from '../../utils/logger';

dotenv.config();

/**
 * 飞书客户端配置
 */
export const feishuClient = new lark.Client({
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
});

/**
 * 飞书消息服务
 */
export class FeishuMessageService {
  /**
   * 发送文本消息
   */
  async sendTextMessage(
    openId: string,
    content: string,
    replyToMessageId?: string
  ): Promise<boolean> {
    try {
      await feishuClient.im.message.create(
        {
          data: {
            receive_id: openId,
            msg_type: 'text',
            content: JSON.stringify({ text: content }),
            ...(replyToMessageId ? { reply_id: replyToMessageId } : {}),
          },
          params: { receive_id_type: 'open_id' as const },
        }
      );

      return true;
    } catch (error) {
      logger.error('[Feishu] 发送消息失败', error);
      return false;
    }
  }

  /**
   * 发送交互式消息（带按钮）
   */
  async sendInteractiveMessage(
    openId: string,
    text: string,
    buttons: Array<{ label: string; value: string }>
  ): Promise<boolean> {
    try {
      const content = {
        config: {
          wide_screen_mode: true,
        },
        header: {
          template: 'blue',
          title: {
            tag: 'plain_text',
            content: 'AI 人生合伙人',
          },
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: text,
            },
          },
          {
            tag: 'action',
            actions: buttons.map(btn => ({
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: btn.label,
              },
              type: 'primary',
              value: {
                type: btn.value,
              },
            })),
          },
        ],
      };

      await feishuClient.im.message.create(
        {
          data: {
            receive_id: openId,
            msg_type: 'interactive',
            content: JSON.stringify(content),
          },
          params: { receive_id_type: 'open_id' as const },
        }
      );

      return true;
    } catch (error) {
      logger.error('[Feishu] 发送交互式消息失败', error);
      return false;
    }
  }

  /**
   * 解析接收到的消息
   */
  parseReceivedMessage(event: any): {
    messageType: 'text' | 'interactive';
    content: string;
    openId: string;
    messageId: string;
    chatType: 'p2p' | 'group';
  } | null {
    try {
      const message = event.message;

      return {
        messageType: message.message_type as 'text' | 'interactive',
        content: message.content?.text || '',
        openId: event.sender.sender_id.open_id || '',
        messageId: message.message_id,
        chatType: message.chat_type as 'p2p' | 'group',
      };
    } catch (error) {
      logger.error('[Feishu] 解析消息失败', error);
      return null;
    }
  }
}

/**
 * 飞书定时任务服务
 */
export class FeishuSchedulerService {
  private messageService: FeishuMessageService;

  constructor() {
    this.messageService = new FeishuMessageService();
  }

  /**
   * 早上推送（8:00）
   */
  async sendMorningPush(
    openId: string,
    content: string
  ): Promise<boolean> {
    return this.messageService.sendTextMessage(openId, content);
  }

  /**
   * 每日复盘提醒（22:00）
   */
  async sendDailyReviewReminder(openId: string): Promise<boolean> {
    const content = `🌙 每日复盘时间

简单回答 3 个问题：
1. 今天最重要的事完成了吗？
2. 卡在哪了？
3. 明天第一件事做什么？

每个问题一句话就行。`;

    return this.messageService.sendTextMessage(openId, content);
  }

  /**
   * 周复盘提醒（每周日）
   */
  async sendWeeklyReviewReminder(openId: string): Promise<boolean> {
    const content = `📊 周复盘时间（约 15 分钟）

1. 本周目标完成情况？
2. 本周最大认知变化是什么？
3. 下周最重要的 1 件事？
4. 目标是否需要调整？`;

    return this.messageService.sendTextMessage(openId, content);
  }

  /**
   * 认知挑战提醒（每周二、五）
   */
  async sendCognitionChallenge(openId: string, question: string): Promise<boolean> {
    return this.messageService.sendTextMessage(openId, `💡 本周思考题：

${question}

想好后回复我，我们一起拆解。`);
  }
}
