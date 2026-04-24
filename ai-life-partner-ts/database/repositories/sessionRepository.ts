/**
 * 会话数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface Session {
  id: string;
  user_id: string;
  conversation_history: string | null;
  current_focus: string | null;
  has_pending_challenge: number;
  has_pending_decision_review: number;
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
export class SessionRepository extends BaseRepository {
  /**
   * 创建或获取会话
   */
  async findOrCreate(userId: string): Promise<Session> {
    const existing = await this.queryOne<Session>(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (existing) {
      return existing;
    }

    const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const db = await this.getDb();
    await db.execute(`
      INSERT INTO sessions (id, user_id, conversation_history, current_focus, has_pending_challenge, has_pending_decision_review, pending_decision_id, last_active_at, created_at)
      VALUES (?, ?, '[]', NULL, 0, 0, NULL, ?, ?)
    `, [id, userId, now, now]);

    return await this.findById(id) as Session;
  }

  /**
   * 查找会话
   */
  async findById(id: string): Promise<Session | null> {
    return await this.queryOne<Session>(
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );
  }

  /**
   * 获取用户的会话
   */
  async findByUser(userId: string): Promise<Session | null> {
    return await this.queryOne<Session>(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
  }

  /**
   * 创建或更新会话（upsert）
   * 注意：会先确保用户存在
   */
  async upsert(id: string, userId: string, fields: Partial<CreateSessionInput> & {
    has_pending_challenge?: boolean;
    has_pending_decision_review?: boolean;
    pending_decision_id?: string;
  }): Promise<void> {
    const now = new Date().toISOString();

    // 确保用户存在（外键约束）
    const db = await this.getDb();
    await db.execute(
      `INSERT OR IGNORE INTO users (id, open_id, created_at, updated_at) VALUES (?, ?, ${getNowSql()}, ${getNowSql()})`,
      [userId, userId]
    );

    const existing = await this.findById(id);

    if (existing) {
      await this.updateSession(id, fields);
    } else {
      await db.execute(`
        INSERT INTO sessions (
          id, user_id, conversation_history, current_focus,
          has_pending_challenge, has_pending_decision_review, pending_decision_id,
          last_active_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        userId,
        fields.conversation_history ? JSON.stringify(fields.conversation_history) : '[]',
        fields.current_focus || null,
        fields.has_pending_challenge ? 1 : 0,
        fields.has_pending_decision_review ? 1 : 0,
        fields.pending_decision_id || null,
        now,
        now
      ]);
    }
  }

  /**
   * 更新会话（内部方法）
   */
  private async updateSession(id: string, fields: Partial<CreateSessionInput> & {
    has_pending_challenge?: boolean;
    has_pending_decision_review?: boolean;
    pending_decision_id?: string;
  }): Promise<void> {
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
      setClauses.push(`last_active_at = ${getNowSql()}`);
      values.push(id);
      await this.runUpdate(
        `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  /**
   * 更新最后活跃时间
   */
  async touch(id: string): Promise<void> {
    await this.runUpdate(`UPDATE sessions SET last_active_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(id: string): Promise<ConversationMessage[]> {
    const session = await this.findById(id);
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
  async addMessage(id: string, role: 'user' | 'assistant', content: string, maxHistory: number = 10): Promise<void> {
    const history = await this.getConversationHistory(id);
    history.push({ role, content });

    // 限制历史消息数量
    while (history.length > maxHistory) {
      history.shift();
    }

    await this.updateSession(id, { conversation_history: history });
  }

  /**
   * 清除会话历史
   */
  async clearHistory(id: string): Promise<void> {
    await this.updateSession(id, { conversation_history: [], current_focus: null });
  }

  /**
   * 删除会话
   */
  async delete(id: string): Promise<boolean> {
    return await this.deleteSession(id);
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM sessions WHERE id = ?', [id]);
    return result > 0;
  }

  /**
   * 清理过期会话（30 分钟未活跃）
   */
  async cleanupExpired(timeoutMinutes: number = 30): Promise<number> {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const now = Date.now();

    const sessions = await this.queryMany<{ id: string; last_active_at: string }>(
      'SELECT id, last_active_at FROM sessions'
    );

    let deleted = 0;
    for (const session of sessions) {
      const lastActive = new Date(session.last_active_at).getTime();
      if (now - lastActive > timeoutMs) {
        await this.deleteSession(session.id);
        deleted++;
      }
    }

    return deleted;
  }
}
