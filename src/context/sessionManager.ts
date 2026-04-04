/**
 * 会话管理器
 * 管理用户会话状态，避免内存泄漏
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { CONFIG } from '../constants';

interface SessionData {
  userId: string;
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
}

/**
 * 会话管理器类
 *
 * 功能：
 * 1. 会话创建和获取
 * 2. 自动过期清理
 * 3. 会话持久化钩子
 * 4. 内存使用监控
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private readonly cleanupDelay: number;
  private readonly onSessionExpired?: (userId: string) => void;

  constructor(options: SessionOptions = {}) {
    super();
    this.onSessionExpired = options.onSessionExpired;
    this.cleanupDelay = options.cleanupInterval || 5 * 60 * 1000; // 默认 5 分钟清理一次

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
    });
  }

  /**
   * 创建或获取会话
   */
  getOrCreateSession(userId: string): SessionData {
    const existing = this.sessions.get(userId);
    if (existing) {
      existing.lastActiveAt = Date.now();
      return existing;
    }

    const newSession: SessionData = {
      userId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      conversation: [],
      metadata: {},
    };

    this.sessions.set(userId, newSession);
    logger.debug('[SessionManager] 创建新会话', { userId, count: this.sessions.size });

    return newSession;
  }

  /**
   * 获取会话（不更新活跃时间）
   */
  getSession(userId: string): SessionData | null {
    return this.sessions.get(userId) || null;
  }

  /**
   * 添加对话消息
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.getOrCreateSession(userId);
    session.conversation.push({
      role,
      content,
      timestamp: Date.now(),
    });

    // 限制对话长度，避免内存无限增长
    if (session.conversation.length > 100) {
      session.conversation = session.conversation.slice(-50);
      logger.debug('[SessionManager] 对话截断', { userId, length: session.conversation.length });
    }
  }

  /**
   * 获取对话历史
   */
  getConversation(userId: string, limit?: number): Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }> {
    const session = this.getSession(userId);
    if (!session) return [];

    const conversation = session.conversation;
    if (!limit || limit >= conversation.length) {
      return conversation;
    }

    return conversation.slice(-limit);
  }

  /**
   * 更新会话元数据
   */
  updateMetadata(userId: string, metadata: Record<string, any>): void {
    const session = this.getOrCreateSession(userId);
    session.metadata = { ...session.metadata, ...metadata };
  }

  /**
   * 获取元数据
   */
  getMetadata(userId: string, key?: string): any {
    const session = this.getSession(userId);
    if (!session) return null;

    if (key) {
      return session.metadata[key];
    }
    return session.metadata;
  }

  /**
   * 删除会话
   */
  deleteSession(userId: string): boolean {
    const existed = this.sessions.delete(userId);
    if (existed) {
      logger.debug('[SessionManager] 删除会话', { userId, remaining: this.sessions.size });
      this.emit('session:deleted', userId);
    }
    return existed;
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [userId, session] of this.sessions.entries()) {
      const inactiveTime = now - session.lastActiveAt;
      if (inactiveTime > CONFIG.SESSION_TIMEOUT) {
        expired.push(userId);
      }
    }

    if (expired.length > 0) {
      logger.info('[SessionManager] 清理过期会话', {
        count: expired.length,
        userIds: expired,
      });

      for (const userId of expired) {
        this.sessions.delete(userId);
        this.onSessionExpired?.(userId);
        this.emit('session:expired', userId);
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
        activeSessions: 0,
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
