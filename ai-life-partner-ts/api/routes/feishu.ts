/**
 * 飞书路由
 * 处理飞书机器人 webhook 事件
 */

import { Router, Request, Response, json } from 'express';
import crypto from 'crypto';
import { FeishuMessageService } from '../../integrations/feishu/messageService';
import { logger } from '../../utils/logger';

const router = Router();
const messageService = new FeishuMessageService();

/**
 * 验证飞书签名
 */
function verifyFeishuSignature(req: Request, res: Response, next: Function) {
  const signature = req.headers['x-feishu-signature'] as string;
  const timestamp = req.headers['x-feishu-timestamp'] as string;
  const nonce = req.headers['x-feishu-nonce'] as string;
  const body = JSON.stringify(req.body);

  // 如果缺少签名头，跳过验证（兼容模式）
  if (!signature || !timestamp || !nonce) {
    next();
    return;
  }

  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!verificationToken) {
    next();
    return;
  }

  // 构建待签名字符串
  const stringToSign = timestamp + nonce + verificationToken + body;
  const computedSignature = crypto.createHash('sha256').update(stringToSign).digest('hex');

  if (computedSignature !== signature) {
    logger.warn('[Feishu] 签名验证失败', {
      signature,
      timestamp,
      nonce,
    });
    res.status(401).send('签名验证失败');
    return;
  }

  next();
}

/**
 * POST /feishu/event
 * 处理飞书事件
 */
router.post('/event', json(), verifyFeishuSignature, async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // 处理 URL 验证
    if (event.type === 'url_verification') {
      logger.info('[Feishu] URL 验证', { challenge: event.challenge });
      res.send({ challenge: event.challenge });
      return;
    }

    // 处理接收到的消息
    if (event.type === 'im.message.receive_v1') {
      const parsed = messageService.parseReceivedMessage(event);
      if (!parsed) {
        res.status(400).send('解析消息失败');
        return;
      }

      // 忽略机器人自己的消息
      if (parsed.openId.startsWith('ou_')) {
        res.status(200).send('OK');
        return;
      }

      // 只处理文本消息
      if (parsed.messageType === 'text' && parsed.content.trim()) {
        // 异步处理，不阻塞响应
        // 注意：实际的 handleUserMessage 函数需要在 server.ts 中导出或在此处实现
        logger.info('[Feishu] 收到消息', {
          openId: parsed.openId,
          messageType: parsed.messageType,
          contentLength: parsed.content.length,
        });

        // 此处调用消息处理逻辑
        // await handleUserMessage(parsed.openId, parsed.openId, parsed.content, parsed.messageId);
      }

      res.status(200).send('OK');
      return;
    }

    // 其他事件类型
    logger.debug('[Feishu] 未处理的事件', { type: event.type });
    res.status(200).send('OK');
  } catch (error) {
    logger.error('[Feishu] 事件处理失败', error as Error);
    res.status(500).send('事件处理失败');
  }
});

/**
 * POST /feishu/test
 * 测试飞书消息发送
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { openId, message } = req.body;

    if (!openId || !message) {
      res.status(400).json({
        success: false,
        error: { message: '缺少 openId 或 message 参数' },
      });
      return;
    }

    await messageService.sendTextMessage(openId, message);

    res.json({
      success: true,
      message: '消息已发送',
    });
  } catch (error) {
    logger.error('[Feishu] 测试失败', error as Error);
    res.status(500).json({
      success: false,
      error: { message: (error as Error).message },
    });
  }
});

export default router;
