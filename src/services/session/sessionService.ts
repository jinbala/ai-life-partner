/**
 * 会话服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { SessionRepository, ConversationMessage } from '../../database/repositories';

export interface SessionData {
  id: string;
  userId: string;
  conversationHistory: ConversationMessage[];
  currentFocus: string | null;
  hasPendingChallenge: boolean;
  hasPendingDecisionReview: boolean;
  pendingDecisionId: string | null;
}

/**
 * 会话服务
 */
export class SessionService {
  private repository: SessionRepository;
  private cache: Map<string, SessionData> = new Map();

  constructor() {
    this.repository = new SessionRepository();
  }

  /**
   * 获取或创建会话
   */
  getOrCreate(userId: string): SessionData {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    const session = this.repository.findOrCreate(userId);
    const data = this.mapToSessionData(session);
    this.cache.set(userId, data);
    return data;
  }

  /**
   * 获取会话
   */
  getSession(userId: string): SessionData | null {
    const cached = this.cache.get(userId);
    if (cached) {
      return cached;
    }

    const session = this.repository.findByUser(userId);
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
  update(userId: string, fields: Partial<SessionData>): void {
    const session = this.repository.findByUser(userId);
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

    this.repository.update(session.id, updateData);

    // 更新缓存
    const cached = this.cache.get(userId);
    if (cached) {
      this.cache.set(userId, { ...cached, ...fields });
    }
  }

  /**
   * 添加对话消息
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.repository.findByUser(userId);
    if (!session) return;

    this.repository.addMessage(session.id, role, content);

    // 更新缓存
    const cached = this.cache.get(userId);
    if (cached) {
      cached.conversationHistory.push({ role, content });
      if (cached.conversationHistory.length > 10) {
        cached.conversationHistory.shift();
      }
    }
  }

  /**
   * 清除会话
   */
  clear(userId: string): void {
    const session = this.repository.findByUser(userId);
    if (!session) return;

    this.repository.clearHistory(session.id);
    this.cache.delete(userId);
  }

  /**
   * 删除会话
   */
  delete(userId: string): boolean {
    const session = this.repository.findByUser(userId);
    if (!session) return false;

    this.cache.delete(userId);
    return this.repository.delete(session.id);
  }

  /**
   * 清理过期会话
   */
  cleanupExpired(timeoutMinutes: number = 30): number {
    const deleted = this.repository.cleanupExpired(timeoutMinutes);
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
      hasPendingChallenge: session.has_pending_challenge,
      hasPendingDecisionReview: session.has_pending_decision_review,
      pendingDecisionId: session.pending_decision_id,
    };
  }
}
