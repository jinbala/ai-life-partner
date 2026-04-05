/**
 * 聊天路由
 * 处理 Web 聊天界面的请求
 */

import { Router, Request, Response } from 'express';
import { AIService, ChatMessage } from '../../services/ai';
import { generateSystemPrompt } from '../../services/ai/aiPersona';
import { sessionManager } from '../../context/sessionManager';
import { logger } from '../../utils/logger';
import { validate, ChatMessageWithSessionSchema } from '../../utils/validators';

const router = Router();
const aiService = new AIService();

/**
 * 会话数据结构
 */
interface ChatSession {
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentFocus?: string;
}

/**
 * 获取或创建聊天会话
 */
function getChatSession(sessionId: string, userId?: string): ChatSession {
  const sessionData = sessionManager.getOrCreateSession(sessionId, userId || 'anonymous');

  if (!sessionData.metadata.chatSession) {
    sessionData.metadata.chatSession = {
      conversationHistory: [],
      currentFocus: undefined,
    };
  }

  return sessionData.metadata.chatSession;
}

/**
 * POST /chat/message
 * 发送消息并获取回复
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    // 验证请求参数
    const validation = validate(ChatMessageWithSessionSchema, req.body);
    if (validation.error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
        },
      });
      return;
    }

    const { userId, sessionId, message } = validation.data!;
    const session = getChatSession(sessionId, userId);
    const { conversationHistory, currentFocus } = session;

    logger.debug('[Chat] 获取会话', {
      sessionId,
      userId,
      historyLength: conversationHistory.length,
      history: conversationHistory.slice(-3),
    });

    // 添加用户消息到历史
    conversationHistory.push({ role: 'user', content: message });

    // 限制历史长度
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }

    // 生成系统提示
    const systemPrompt = generateSystemPrompt({ currentFocus });

    // 构建消息
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(h => ({ role: h.role, content: h.content }) as ChatMessage),
    ];

    // 调用 AI 服务
    const response = await aiService.chat(messages, {
      maxTokens: 500,
      temperature: 0.1,
    });

    // 添加 AI 回复到历史
    conversationHistory.push({ role: 'assistant', content: response.content });

    // 保存到会话管理器
    sessionManager.updateMetadata(sessionId, { chatSession: session });

    logger.info('[Chat] 消息处理成功', {
      sessionId,
      messageLength: message.length,
      responseLength: response.content.length,
    });

    res.json({
      success: true,
      data: {
        message: response.content,
        sessionId,
        usage: response.usage,
      },
    });
  } catch (error) {
    logger.error('[Chat] 消息处理失败', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

/**
 * GET /chat/session/:sessionId
 * 获取会话历史
 */
router.get('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const session = getChatSession(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
        history: session.conversationHistory,
        currentFocus: session.currentFocus,
      },
    });
  } catch (error) {
    logger.error('[Chat] 获取会话失败', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

/**
 * DELETE /chat/session/:sessionId
 * 清空会话历史
 */
router.delete('/session/:sessionId', (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const session = getChatSession(sessionId);

    session.conversationHistory = [];
    session.currentFocus = undefined;

    sessionManager.updateMetadata(sessionId, { chatSession: session });

    res.json({
      success: true,
      message: '会话已清空',
    });
  } catch (error) {
    logger.error('[Chat] 清空会话失败', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SESSION_ERROR',
        message: (error as Error).message,
      },
    });
  }
});

export default router;
