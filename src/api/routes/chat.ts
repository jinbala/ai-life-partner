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
import { optionalAuth } from '../middleware/auth';
import { UserService } from '../../services/user';

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
async function getChatSession(sessionId: string, userId?: string): Promise<ChatSession> {
  const sessionData = await sessionManager.getOrCreateSession(sessionId, userId || 'anonymous');

  if (!sessionData.metadata.chatSession) {
    sessionData.metadata.chatSession = {
      conversationHistory: [],
      currentFocus: undefined,
    };
  }

  return sessionData.metadata.chatSession;
}

/**
 * 提取关键词
 */
function extractKeywords(text: string, limit: number = 10): string[] {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  const all = [...chineseChars, ...englishWords];
  const freq = new Map<string, number>();
  all.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([word]) => word);
}

/**
 * POST /chat/message
 * 发送消息并获取回复
 * 认证：可选（Bearer Token）
 */
router.post('/message', optionalAuth, async (req: Request, res: Response) => {
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

    // 优先使用 token 中的 userId，如果没有则使用请求参数中的 userId
    const tokenUserId = (req as any).userId;
    const { userId: bodyUserId, sessionId, message } = validation.data!;
    const userId = tokenUserId || bodyUserId || 'anonymous';
    const session = await getChatSession(sessionId, userId);
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

    // 加载用户上下文（画像、记忆、目标等）
    const userServices = new UserService(userId);
    const portraitSummary = await userServices.portrait.getSummary();
    const goalSummary = await userServices.goals.getSummary();
    const memorySummary = await userServices.memories.getSummary();
    const assetsSummary = await userServices.assets.getSummary();

    // 检索相关记忆和资产
    const keywords = extractKeywords(message);
    const relatedMemories = await userServices.memories.search(keywords);
    const relatedAssets = await userServices.assets.search(keywords);

    // 生成系统提示
    const systemPrompt = await generateSystemPrompt({
      currentFocus: session.currentFocus,
    });

    // 注入记忆和资产
    const memoriesText = userServices.memories.formatForPrompt(relatedMemories);
    const assetsText = userServices.assets.formatForPrompt(relatedAssets);
    const extraContext = [memoriesText, assetsText].filter(Boolean).join('\n\n');

    // 调用 AI 服务
    const aiResponse = await aiService.chat(
      [
        {
          role: 'system',
          content: `${systemPrompt}\n\n用户画像：${portraitSummary}\n目标状态：${goalSummary}\n${extraContext ? extraContext + '\n' : ''}`,
        },
        ...conversationHistory.slice(-10).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
      {
        maxTokens: 2000,
        temperature: 0.7,
      }
    );

    // 添加 AI 响应到历史
    conversationHistory.push({ role: 'assistant', content: aiResponse.content });

    // 添加到会话管理器（异步，不阻塞响应）
    await sessionManager.addMessage(sessionId, 'user', message);
    await sessionManager.addMessage(sessionId, 'assistant', aiResponse.content);

    // 记录对话到历史表（用于日历显示）
    const { ConversationHistoryRepository } = await import('../../database/repositories');
    const convRepo = new ConversationHistoryRepository();
    convRepo.add(userId, 'user', message).catch(err => logger.warn('记录对话失败', err));
    convRepo.add(userId, 'assistant', aiResponse.content).catch(err => logger.warn('记录对话失败', err));

    // 异步分析对话并更新画像（不阻塞响应）
    // 每 5 次对话分析一次，减少 API 调用
    if (conversationHistory.length % 5 === 0) {
      userServices.evolution.analyzeAndUpdatePortrait(userId, conversationHistory).then(result => {
        if (result.portraitUpdates.length > 0 || result.newMemories.length > 0) {
          logger.info('[Chat] 画像进化分析完成', {
            userId,
            updates: result.portraitUpdates.length,
            newMemories: result.newMemories.length,
          });
        }
      }).catch(err => {
        logger.warn('[Chat] 画像进化分析失败', { userId, error: err.message });
      });
    }

    res.json({
      success: true,
      data: {
        message: aiResponse.content,
        sessionId,
        conversationLength: conversationHistory.length,
      },
    });
  } catch (error) {
    logger.error('[Chat] 处理消息失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

/**
 * GET /chat/session/:sessionId
 * 获取会话历史
 * 认证：可选
 */
router.get('/session/:sessionId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const sessionData = await sessionManager.getOrCreateSession(sessionId);
    const conversation = sessionData.metadata.chatSession?.conversationHistory || [];

    res.json({
      success: true,
      data: {
        sessionId,
        conversation,
      },
    });
  } catch (error) {
    logger.error('[Chat] 获取会话失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

/**
 * DELETE /chat/session/:sessionId
 * 删除会话
 * 认证：可选
 */
router.delete('/session/:sessionId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    await sessionManager.deleteSession(sessionId);

    res.json({
      success: true,
      data: {
        sessionId,
      },
    });
  } catch (error) {
    logger.error('[Chat] 删除会话失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

export { router as chatRoutes };
