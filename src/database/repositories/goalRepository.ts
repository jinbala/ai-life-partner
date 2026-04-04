/**
 * 目标数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface Goal {
  id: string;
  user_id: string;
  level: 'north_star' | 'annual' | 'monthly' | 'weekly';
  parent_id: string | null;
  description: string;
  progress: number;
  success_signals: string | null;
  danger_signals: string | null;
  stop_loss_line: string | null;
  start_date: string | null;
  end_date: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  user_id: string;
  level: Goal['level'];
  parent_id?: string;
  description: string;
  success_signals?: string;
  danger_signals?: string;
  stop_loss_line?: string;
  start_date?: string;
  end_date?: string;
  progress?: number;
}

export class GoalRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建目标
   */
  create(input: CreateGoalInput): Goal {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO goals (id, user_id, level, parent_id, description, success_signals, danger_signals, stop_loss_line, start_date, end_date, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      input.user_id,
      input.level,
      input.parent_id || null,
      input.description,
      input.success_signals ? JSON.stringify(input.success_signals) : null,
      input.danger_signals ? JSON.stringify(input.danger_signals) : null,
      input.stop_loss_line,
      input.start_date || null,
      input.end_date || null,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * 查找目标
   */
  findById(id: string): Goal | null {
    const goal = this.db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | null;
    if (goal) {
      goal.is_completed = Boolean(goal.is_completed);
    }
    return goal;
  }

  /**
   * 获取用户的所有目标
   */
  findByUser(userId: string): Goal[] {
    const goals = this.db.prepare(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY level, created_at DESC'
    ).all(userId) as Goal[];

    return goals.map(g => ({ ...g, is_completed: Boolean(g.is_completed) }));
  }

  /**
   * 按级别获取目标
   */
  findByLevel(userId: string, level: Goal['level']): Goal[] {
    const goals = this.db.prepare(
      'SELECT * FROM goals WHERE user_id = ? AND level = ? ORDER BY created_at DESC'
    ).all(userId, level) as Goal[];

    return goals.map(g => ({ ...g, is_completed: Boolean(g.is_completed) }));
  }

  /**
   * 获取子目标
   */
  findChildren(parentId: string): Goal[] {
    const goals = this.db.prepare(
      'SELECT * FROM goals WHERE parent_id = ? ORDER BY created_at DESC'
    ).all(parentId) as Goal[];

    return goals.map(g => ({ ...g, is_completed: Boolean(g.is_completed) }));
  }

  /**
   * 更新目标进度
   */
  updateProgress(id: string, progress: number): void {
    this.db.prepare(`
      UPDATE goals
      SET progress = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(Math.min(100, Math.max(0, progress)), id);
  }

  /**
   * 标记目标为完成
   */
  markAsCompleted(id: string): void {
    this.db.prepare(`
      UPDATE goals
      SET is_completed = 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 更新目标
   */
  update(id: string, fields: Partial<CreateGoalInput>): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.description !== undefined) {
      setClauses.push('description = ?');
      values.push(fields.description);
    }
    if (fields.progress !== undefined) {
      setClauses.push('progress = ?');
      values.push(fields.progress);
    }
    if (fields.success_signals !== undefined) {
      setClauses.push('success_signals = ?');
      values.push(JSON.stringify(fields.success_signals));
    }
    if (fields.danger_signals !== undefined) {
      setClauses.push('danger_signals = ?');
      values.push(JSON.stringify(fields.danger_signals));
    }
    if (fields.stop_loss_line !== undefined) {
      setClauses.push('stop_loss_line = ?');
      values.push(fields.stop_loss_line);
    }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      values.push(id);
      this.db.prepare(`UPDATE goals SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  /**
   * 删除目标
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
