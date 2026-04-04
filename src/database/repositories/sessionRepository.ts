/**
 * 会话数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface Session {
  id: string;
  user_id: string;
  conversation_history: string | null;
  current_focus: string | null;
  has_pending_challenge: boolean;
  has_pending_decision_review: boolean;
  pending_decision_id: string | null;
  last_active_at: string;
  created_at: string;
}

export interface CreateSessionInput {
  user_id: string;
  conversation_history?: Array<{ role: string; content: string }>;
  current_focus?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * 会话仓库
 */
export class SessionRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建或获取会话
   */
  findOrCreate(userId: string): Session {
    const existing = this.db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(userId) as Session | undefined;

    if (existing) {
      return existing;
    }

    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, conversation_history, current_focus, has_pending_challenge, has_pending_decision_review, pending_decision_id, last_active_at, created_at)
      VALUES (?, ?, '[]', NULL, 0, 0, NULL, ?, ?)
    `).run(id, userId, now, now);

    return this.findById(id)!;
  }

  /**
   * 查找会话
   */
  findById(id: string): Session | null {
    const session = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | null;
    if (session) {
      session.has_pending_challenge = Boolean(session.has_pending_challenge);
      session.has_pending_decision_review = Boolean(session.has_pending_decision_review);
    }
    return session;
  }

  /**
   * 获取用户的会话
   */
  findByUser(userId: string): Session | null {
    const session = this.db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(userId) as Session | null;
    if (session) {
      session.has_pending_challenge = Boolean(session.has_pending_challenge);
      session.has_pending_decision_review = Boolean(session.has_pending_decision_review);
    }
    return session;
  }

  /**
   * 更新会话
   */
  update(id: string, fields: Partial<CreateSessionInput> & {
    has_pending_challenge?: boolean;
    has_pending_decision_review?: boolean;
    pending_decision_id?: string;
  }): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.conversation_history !== undefined) {
      setClauses.push('conversation_history = ?');
      values.push(JSON.stringify(fields.conversation_history));
    }
    if (fields.current_focus !== undefined) {
      setClauses.push('current_focus = ?');
      values.push(fields.current_focus);
    }
    if (fields.has_pending_challenge !== undefined) {
      setClauses.push('has_pending_challenge = ?');
      values.push(fields.has_pending_challenge ? 1 : 0);
    }
    if (fields.has_pending_decision_review !== undefined) {
      setClauses.push('has_pending_decision_review = ?');
      values.push(fields.has_pending_decision_review ? 1 : 0);
    }
    if (fields.pending_decision_id !== undefined) {
      setClauses.push('pending_decision_id = ?');
      values.push(fields.pending_decision_id);
    }

    if (setClauses.length > 0) {
      setClauses.push("last_active_at = datetime('now')");
      values.push(id);
      this.db.prepare(`UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  /**
   * 更新最后活跃时间
   */
  touch(id: string): void {
    this.db.prepare(`
      UPDATE sessions
      SET last_active_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(id: string): ConversationMessage[] {
    const session = this.findById(id);
    if (!session || !session.conversation_history) {
      return [];
    }
    try {
      return JSON.parse(session.conversation_history);
    } catch (error) {
      return [];
    }
  }

  /**
   * 添加对话消息
   */
  addMessage(id: string, role: 'user' | 'assistant', content: string, maxHistory: number = 10): void {
    const history = this.getConversationHistory(id);
    history.push({ role, content });

    // 限制历史消息数量
    while (history.length > maxHistory) {
      history.shift();
    }

    this.update(id, { conversation_history: history });
  }

  /**
   * 清除会话历史
   */
  clearHistory(id: string): void {
    this.update(id, { conversation_history: [], current_focus: null });
  }

  /**
   * 删除会话
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * 清理过期会话（30 分钟未活跃）
   */
  cleanupExpired(timeoutMinutes: number = 30): number {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const now = Date.now();

    const sessions = this.db.prepare(`
      SELECT id, last_active_at FROM sessions
    `).all() as Array<{ id: string; last_active_at: string }>;

    let deleted = 0;
    sessions.forEach(session => {
      const lastActive = new Date(session.last_active_at).getTime();
      if (now - lastActive > timeoutMs) {
        this.delete(session.id);
        deleted++;
      }
    });

    return deleted;
  }
}
