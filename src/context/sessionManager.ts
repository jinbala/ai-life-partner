/**
 * 会话管理器
 * 管理用户会话状态，支持数据库持久化
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { CONFIG } from '../constants';
import { SessionRepository } from '../database/repositories/sessionRepository';

interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: number;
  lastActiveAt: number;
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  metadata: Record<string, any>;
}

interface SessionOptions {
  onSessionExpired?: (userId: string) => void;
  cleanupInterval?: number;
  useDatabase?: boolean; // 是否使用数据库持久化
}

/**
 * 会话管理器类
 *
 * 功能：
 * 1. 会话创建和获取（支持数据库持久化）
 * 2. 自动过期清理
 * 3. 会话数据同步到数据库
 * 4. 内存缓存 + 数据库双重存储
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map(); // 内存缓存：sessionId -> SessionData
  private cleanupInterval: NodeJS.Timeout;
  private readonly cleanupDelay: number;
  private readonly onSessionExpired?: (userId: string) => void;
  private readonly useDatabase: boolean;
  private sessionRepo: SessionRepository;

  constructor(options: SessionOptions = {}) {
    super();
    this.onSessionExpired = options.onSessionExpired;
    this.cleanupDelay = options.cleanupInterval || 5 * 60 * 1000; // 默认 5 分钟清理一次
    this.useDatabase = options.useDatabase ?? true; // 默认使用数据库持久化
    this.sessionRepo = new SessionRepository();

    // 启动定时清理
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredSessions(),
      this.cleanupDelay
    );

    // 优雅关闭时清理
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());

    logger.info('[SessionManager] 已初始化', {
      cleanupInterval: this.cleanupDelay,
      sessionTimeout: CONFIG.SESSION_TIMEOUT,
      useDatabase: this.useDatabase,
    });
  }

  /**
   * 创建或获取会话
   * 注意：现在使用 sessionId 作为键，而不是 userId
   */
  async getOrCreateSession(sessionId: string, userId?: string): Promise<SessionData> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      logger.debug('[SessionManager] 内存中命中', { sessionId });
      existing.lastActiveAt = Date.now();
      // 同步到数据库
      if (this.useDatabase) {
        await this.saveSessionToDatabase(existing);
      }
      return existing;
    }

    logger.debug('[SessionManager] 内存中未找到，尝试从数据库加载', { sessionId, userId });

    // 尝试从数据库加载（优先通过 sessionId 加载）
    if (this.useDatabase) {
      logger.debug('[SessionManager] 准备调用 sessionRepo.findById', { sessionId });
      let dbSession = await this.sessionRepo.findById(sessionId);
      logger.debug('[SessionManager] sessionRepo.findById 返回', { sessionId, found: !!dbSession });

      // 如果没有找到，尝试通过 userId 加载用户的最近会话
      if (!dbSession && userId) {
        logger.debug('[SessionManager] 通过 userId 查询', { userId });
        dbSession = await this.sessionRepo.findByUser(userId);
        logger.debug('[SessionManager] sessionRepo.findByUser 返回', { userId, found: !!dbSession });
      }

      if (dbSession) {
        logger.debug('[SessionManager] 数据库中找到会话，开始解析', { sessionId });
        try {
          const conversationHistory = dbSession.conversation_history
            ? JSON.parse(dbSession.conversation_history)
            : [];
          logger.debug('[SessionManager] 解析对话历史', { count: conversationHistory.length });

          const loadedSession: SessionData = {
            userId: dbSession.user_id,
            sessionId: dbSession.id,
            createdAt: new Date(dbSession.created_at).getTime(),
            lastActiveAt: new Date(dbSession.last_active_at).getTime(),
            conversation: conversationHistory.map((item: any) => ({
              role: item.role,
              content: item.content,
              timestamp: item.timestamp || Date.now(),
            })),
            metadata: {
              chatSession: {
                conversationHistory: conversationHistory, // 使用解析后的历史
                currentFocus: dbSession.current_focus || undefined,
              },
              hasPendingChallenge: dbSession.has_pending_challenge === 1,
              hasPendingDecisionReview: dbSession.has_pending_decision_review === 1,
              pendingDecisionId: dbSession.pending_decision_id,
            },
          };

          this.sessions.set(sessionId, loadedSession);
          logger.debug('[SessionManager] 从数据库加载会话成功', { sessionId, userId, historyLength: conversationHistory.length });
          return loadedSession;
        } catch (error) {
          logger.error('[SessionManager] 解析会话历史失败', { sessionId, error });
        }
      }
    }

    // 创建新会话
    logger.debug('[SessionManager] 创建新会话', { sessionId, userId });
    const newSession: SessionData = {
      userId: userId || `anonymous_${sessionId}`,
      sessionId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      conversation: [],
      metadata: {},
    };

    this.sessions.set(sessionId, newSession);

    // 保存到数据库
    if (this.useDatabase) {
      logger.debug('[SessionManager] 保存新会话到数据库', { sessionId });
      await this.saveSessionToDatabase(newSession);
    }

    logger.debug('[SessionManager] 创建新会话完成', { sessionId, count: this.sessions.size });

    return newSession;
  }

  /**
   * 保存会话到数据库
   */
  private async saveSessionToDatabase(session: SessionData): Promise<void> {
    try {
      logger.debug('[SessionManager] saveSessionToDatabase 开始', { sessionId: session.sessionId });
      const chatSession = session.metadata.chatSession;
      const conversationHistory = chatSession?.conversationHistory ||
        session.conversation.map(c => ({ role: c.role, content: c.content }));

      logger.debug('[SessionManager] 准备调用 sessionRepo.upsert', {
        sessionId: session.sessionId,
        userId: session.userId,
        historyLength: conversationHistory.length
      });

      await this.sessionRepo.upsert(session.sessionId, session.userId, {
        conversation_history: conversationHistory,
        current_focus: chatSession?.currentFocus || session.metadata.currentFocus,
        has_pending_challenge: session.metadata.hasPendingChallenge || false,
        has_pending_decision_review: session.metadata.hasPendingDecisionReview || false,
        pending_decision_id: session.metadata.pendingDecisionId || null,
      });

      logger.debug('[SessionManager] sessionRepo.upsert 完成', { sessionId: session.sessionId });
    } catch (error) {
      logger.warn('[SessionManager] 保存会话到数据库失败', { sessionId: session.sessionId, error });
    }
  }

  /**
   * 获取会话（不更新活跃时间）
   */
  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 添加对话消息（同步到数据库）
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.conversation.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // 限制对话长度，避免内存无限增长
    if (session.conversation.length > 100) {
      session.conversation = session.conversation.slice(-50);
      logger.debug('[SessionManager] 对话截断', { sessionId, length: session.conversation.length });
    }

    // 同步到数据库
    if (this.useDatabase) {
      await this.saveSessionToDatabase(session);
    }
  }

  /**
   * 获取对话历史
   */
  getConversation(sessionId: string, limit?: number): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }> {
    const session = this.getSession(sessionId);
    if (!session) return [];

    const conversation = session.conversation;
    if (!limit || limit >= conversation.length) {
      return conversation;
    }

    return conversation.slice(-limit);
  }

  /**
   * 更新会话元数据（同步到数据库）
   */
  async updateMetadata(sessionId: string, metadata: Record<string, any>): Promise<void> {
    const session = await this.getOrCreateSession(sessionId);
    session.metadata = { ...session.metadata, ...metadata };

    // 同步到数据库
    if (this.useDatabase) {
      await this.saveSessionToDatabase(session);
    }
  }

  /**
   * 获取元数据
   */
  getMetadata(sessionId: string, key?: string): any {
    const session = this.getSession(sessionId);
    if (!session) return null;

    if (key) {
      return session.metadata[key];
    }
    return session.metadata;
  }

  /**
   * 删除会话（同时删除数据库记录）
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const existed = this.sessions.delete(sessionId);

    // 同时删除数据库记录
    if (this.useDatabase) {
      await this.sessionRepo.delete(sessionId);
    }

    if (existed) {
      logger.debug('[SessionManager] 删除会话', { sessionId, remaining: this.sessions.size });
      this.emit('session:deleted', sessionId);
    }
    return existed;
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActiveAt;
      if (inactiveTime > CONFIG.SESSION_TIMEOUT) {
        expired.push(sessionId);
      }
    }

    if (expired.length > 0) {
      logger.info('[SessionManager] 清理过期会话', {
        count: expired.length,
        sessionIds: expired,
      });

      for (const sessionId of expired) {
        this.sessions.delete(sessionId);
        this.onSessionExpired?.(sessionId);
        this.emit('session:expired', sessionId);
      }
    }
  }

  /**
   * 获取会话统计
   */
  getStats(): {
    activeSessions: number;
    oldestSession: number | null;
    avgSessionAge: number;
  } {
    const now = Date.now();
    const sessions = Array.from(this.sessions.values());

    if (sessions.length === 0) {
      return {
        activeSessions: sessions.length,
        oldestSession: null,
        avgSessionAge: 0,
      };
    }

    const ages = sessions.map(s => now - s.createdAt);
    const oldestSession = Math.max(...ages);
    const avgSessionAge = ages.reduce((a, b) => a + b, 0) / ages.length;

    return {
      activeSessions: sessions.length,
      oldestSession,
      avgSessionAge: Math.round(avgSessionAge),
    };
  }

  /**
   * 导出所有会话（用于持久化）
   */
  exportAll(): Map<string, SessionData> {
    return new Map(this.sessions);
  }

  /**
   * 导入会话（用于恢复）
   */
  importAll(sessions: Map<string, SessionData>): void {
    this.sessions = new Map(sessions);
    logger.info('[SessionManager] 导入会话', { count: this.sessions.size });
  }

  /**
   * 关闭管理器
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);

    // 关闭前同步所有会话到数据库
    if (this.useDatabase) {
      logger.info('[SessionManager] 正在同步所有会话到数据库...', { count: this.sessions.size });
      for (const session of this.sessions.values()) {
        this.saveSessionToDatabase(session);
      }
    }

    logger.info('[SessionManager] 已关闭', {
      finalSessionCount: this.sessions.size,
    });
    this.emit('shutdown');
  }

  /**
   * 强制清理所有会话
   */
  clearAll(): void {
    const count = this.sessions.size;
    this.sessions.clear();
    logger.info('[SessionManager] 已清空所有会话', { count });
  }
}

// 导出单例
export const sessionManager = new SessionManager();
