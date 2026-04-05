/**
 * 会话服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { SessionRepository, ConversationMessage } from '../../database/repositories';
import { AIService } from '../ai';
import { logger } from '../../utils/logger';

export interface SessionData {
  id: string;
  userId: string;
  conversationHistory: ConversationMessage[];
  currentFocus: string | null;
  hasPendingChallenge: boolean;
  hasPendingDecisionReview: boolean;
  pendingDecisionId: string | null;
  summary?: string | null;  // 会话摘要
  summaryUpdatedAt?: number;  // 摘要更新时间戳
}

/**
 * 会话服务
 */
export class SessionService {
  private repository: SessionRepository;
  private cache: Map<string, SessionData> = new Map();
  private aiService: AIService;
  private autoSummaryThreshold: number = 10;  // 多少条对话后触发自动摘要

  constructor() {
    this.repository = new SessionRepository();
    this.aiService = new AIService();
  }

  /**
   * 获取或创建会话
   */
  async getOrCreate(userId: string): Promise<SessionData> {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    const session = await this.repository.findOrCreate(userId);
    const data = this.mapToSessionData(session);
    this.cache.set(userId, data);
    return data;
  }

  /**
   * 获取会话
   */
  async getSession(userId: string): Promise<SessionData | null> {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    const session = await this.repository.findByUser(userId);
    if (!session) {
      return null;
    }

    const data = this.mapToSessionData(session);
    this.cache.set(userId, data);
    return data;
  }

  /**
   * 更新会话
   */
  async update(userId: string, fields: Partial<SessionData>): Promise<void> {
    const session = await this.repository.findByUser(userId);
    if (!session) return;

    const updateData: any = {};

    if (fields.conversationHistory !== undefined) {
      updateData.conversation_history = fields.conversationHistory;
    }
    if (fields.currentFocus !== undefined) {
      updateData.current_focus = fields.currentFocus;
    }
    if (fields.hasPendingChallenge !== undefined) {
      updateData.has_pending_challenge = fields.hasPendingChallenge;
    }
    if (fields.hasPendingDecisionReview !== undefined) {
      updateData.has_pending_decision_review = fields.hasPendingDecisionReview;
    }
    if (fields.pendingDecisionId !== undefined) {
      updateData.pending_decision_id = fields.pendingDecisionId;
    }

    await this.repository.upsert(session.id, userId, updateData);

    // 更新缓存
    const cached = this.cache.get(userId);
    if (cached) {
      this.cache.set(userId, { ...cached, ...fields });
    }
  }

  /**
   * 添加对话消息
   */
  async addMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const session = await this.repository.findByUser(userId);
    if (!session) return;

    await this.repository.addMessage(session.id, role, content);

    // 更新缓存
    const cached = this.cache.get(userId);
    if (cached) {
      cached.conversationHistory.push({ role, content });
      if (cached.conversationHistory.length > 10) {
        cached.conversationHistory.shift();
      }
    }

    // 检查是否需要生成摘要
    await this.maybeGenerateSummary(userId, session.id);
  }

  /**
   * 检查并生成会话摘要（防止上下文漂移）
   */
  private async maybeGenerateSummary(userId: string, sessionId: string): Promise<void> {
    const cached = this.cache.get(userId);
    if (!cached) return;

    const history = cached.conversationHistory;
    if (history.length === 0) return;

    // 检查是否达到摘要阈值
    if (history.length >= this.autoSummaryThreshold) {
      // 如果还没有摘要或者距离上次摘要已经新增了很多对话
      const lastSummaryAt = cached?.summaryUpdatedAt || 0;
      const messagesSinceSummary = history.filter(msg => {
        const msgTime = new Date(msg.content).getTime() || Date.now();
        return msgTime > lastSummaryAt;
      }).length;

      if (messagesSinceSummary >= this.autoSummaryThreshold || !cached?.summary) {
        await this.generateSummary(userId, sessionId, history);
      }
    }
  }

  /**
   * 生成会话摘要
   */
  private async generateSummary(
    userId: string,
    sessionId: string,
    history: ConversationMessage[]
  ): Promise<void> {
    try {
      const recentHistory = history.slice(-20); // 只取最近 20 条
      const historyText = recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');

      const prompt = `请为以下对话生成简洁的摘要（100 字以内），包括：
1. 用户的核心关注点
2. 已讨论的关键内容
3. 待继续的话题

对话历史：
${historyText}

请直接输出摘要内容，不要有多余解释。`;

      const response = await this.aiService.chat([
        { role: 'user', content: prompt },
      ], {
        maxTokens: 150,
        temperature: 0.1,
      });

      // 更新会话摘要
      await this.update(userId, {
        summary: response.content,
        summaryUpdatedAt: Date.now(),
      } as any);

      logger.info('[SessionService] 生成会话摘要', {
        userId,
        sessionId,
        summaryLength: response.content.length,
      });
    } catch (error) {
      logger.error('[SessionService] 生成会话摘要失败', error);
    }
  }

  /**
   * 清除会话
   */
  async clear(userId: string): Promise<void> {
    const session = await this.repository.findByUser(userId);
    if (!session) return;

    await this.repository.clearHistory(session.id);
    this.cache.delete(userId);
  }

  /**
   * 删除会话
   */
  async delete(userId: string): Promise<boolean> {
    const session = await this.repository.findByUser(userId);
    if (!session) return false;

    this.cache.delete(userId);
    return await this.repository.delete(session.id);
  }

  /**
   * 清理过期会话
   */
  async cleanupExpired(timeoutMinutes: number = 30): Promise<number> {
    const deleted = await this.repository.cleanupExpired(timeoutMinutes);
    this.cache.clear();
    return deleted;
  }

  /**
   * 获取缓存数量
   */
  getCachedCount(): number {
    return this.cache.size;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  private mapToSessionData(session: any): SessionData {
    let conversationHistory: ConversationMessage[] = [];
    try {
      if (session.conversation_history) {
        conversationHistory = JSON.parse(session.conversation_history);
      }
    } catch (error) {
      conversationHistory = [];
    }

    return {
      id: session.id,
      userId: session.user_id,
      conversationHistory,
      currentFocus: session.current_focus,
      hasPendingChallenge: session.has_pending_challenge === 1,
      hasPendingDecisionReview: session.has_pending_decision_review === 1,
      pendingDecisionId: session.pending_decision_id,
    };
  }
}
