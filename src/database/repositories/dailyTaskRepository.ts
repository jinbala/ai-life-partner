/**
 * 日常任务数据仓库
 */

import { getDatabase } from '../index';
import type { Database as DatabaseType } from 'better-sqlite3';

export interface DailyTask {
  id: string;
  user_id: string;
  weekly_goal_id: string | null;
  description: string;
  scheduled_date: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  user_id: string;
  weekly_goal_id?: string;
  description: string;
  scheduled_date: string;
}

export class DailyTaskRepository {
  private db: DatabaseType;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * 创建任务
   */
  create(input: CreateTaskInput): DailyTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO daily_tasks (id, user_id, weekly_goal_id, description, scheduled_date, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      input.user_id,
      input.weekly_goal_id || null,
      input.description,
      input.scheduled_date,
      now,
      now
    );

    return this.findById(id)!;
  }

  /**
   * 查找任务
   */
  findById(id: string): DailyTask | null {
    return this.db.prepare('SELECT * FROM daily_tasks WHERE id = ?').get(id) as DailyTask | null;
  }

  /**
   * 获取用户的所有任务
   */
  findByUser(userId: string): DailyTask[] {
    return this.db.prepare(
      'SELECT * FROM daily_tasks WHERE user_id = ? ORDER BY scheduled_date DESC, created_at DESC'
    ).all(userId) as DailyTask[];
  }

  /**
   * 获取指定日期的任务
   */
  findByDate(userId: string, date: string): DailyTask[] {
    return this.db.prepare(
      'SELECT * FROM daily_tasks WHERE user_id = ? AND scheduled_date = ? ORDER BY created_at DESC'
    ).all(userId, date) as DailyTask[];
  }

  /**
   * 获取今日任务
   */
  findToday(userId: string): DailyTask[] {
    const today = new Date().toISOString().split('T')[0];
    return this.findByDate(userId, today);
  }

  /**
   * 获取未完成任务
   */
  findPending(userId: string): DailyTask[] {
    return this.db.prepare(`
      SELECT * FROM daily_tasks
      WHERE user_id = ? AND is_completed = 0
      ORDER BY scheduled_date ASC, created_at DESC
    `).all(userId) as DailyTask[];
  }

  /**
   * 标记任务为完成
   */
  markAsCompleted(id: string): void {
    this.db.prepare(`
      UPDATE daily_tasks
      SET is_completed = 1, completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  }

  /**
   * 更新任务
   */
  update(id: string, fields: Partial<CreateTaskInput>): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (fields.description !== undefined) {
      setClauses.push('description = ?');
      values.push(fields.description);
    }
    if (fields.scheduled_date !== undefined) {
      setClauses.push('scheduled_date = ?');
      values.push(fields.scheduled_date);
    }
    if (fields.weekly_goal_id !== undefined) {
      setClauses.push('weekly_goal_id = ?');
      values.push(fields.weekly_goal_id);
    }

    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      values.push(id);
      this.db.prepare(`UPDATE daily_tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  /**
   * 删除任务
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM daily_tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
