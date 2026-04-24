/**
 * 日常任务数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

export interface DailyTask {
  id: string;
  user_id: string;
  weekly_goal_id: string | null;
  description: string;
  scheduled_date: string;
  is_completed: number;
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

export class DailyTaskRepository extends BaseRepository {
  /**
   * 创建任务
   */
  async create(input: CreateTaskInput): Promise<DailyTask> {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.execute(`
      INSERT INTO daily_tasks (id, user_id, weekly_goal_id, description, scheduled_date, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `, [
      id,
      input.user_id,
      input.weekly_goal_id || null,
      input.description,
      input.scheduled_date,
      now,
      now
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找任务
   */
  async findById(id: string): Promise<DailyTask | null> {
    return await this.queryOne<DailyTask>('SELECT * FROM daily_tasks WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有任务
   */
  async findByUser(userId: string): Promise<DailyTask[]> {
    return await this.queryMany<DailyTask>('SELECT * FROM daily_tasks WHERE user_id = ? ORDER BY scheduled_date DESC, created_at DESC', [userId]);
  }

  /**
   * 获取指定日期的任务
   */
  async findByDate(userId: string, date: string): Promise<DailyTask[]> {
    return await this.queryMany<DailyTask>('SELECT * FROM daily_tasks WHERE user_id = ? AND scheduled_date = ? ORDER BY created_at DESC', [userId, date]);
  }

  /**
   * 获取今日任务
   */
  async findToday(userId: string): Promise<DailyTask[]> {
    const today = new Date().toISOString().split('T')[0];
    return await this.findByDate(userId, today);
  }

  /**
   * 获取未完成任务
   */
  async findPending(userId: string): Promise<DailyTask[]> {
    return await this.queryMany<DailyTask>('SELECT * FROM daily_tasks WHERE user_id = ? AND is_completed = 0 ORDER BY scheduled_date ASC, created_at DESC', [userId]);
  }

  /**
   * 标记任务为完成
   */
  async markAsCompleted(id: string): Promise<void> {
    await this.runUpdate(`UPDATE daily_tasks SET is_completed = 1, completed_at = ${getNowSql()}, updated_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 更新任务
   */
  async update(id: string, fields: Partial<CreateTaskInput>): Promise<void> {
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
      setClauses.push(`updated_at = ${getNowSql()}`);
      values.push(id);
      await this.runUpdate(`UPDATE daily_tasks SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }
  }

  /**
   * 删除任务
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM daily_tasks WHERE id = ?', [id]);
    return result > 0;
  }
}
