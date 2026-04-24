/**
 * 目标数据仓库
 */

import { BaseRepository, getNowSql } from '../BaseRepository';

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
  is_completed: number;
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

export class GoalRepository extends BaseRepository {
  /**
   * 创建目标
   */
  async create(input: CreateGoalInput): Promise<Goal> {
    const id = `goal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    await this.execute(`
      INSERT INTO goals (id, user_id, level, parent_id, description, success_signals, danger_signals, stop_loss_line, start_date, end_date, is_completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [
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
    ]);

    return (await this.findById(id))!;
  }

  /**
   * 查找目标
   */
  async findById(id: string): Promise<Goal | null> {
    return await this.queryOne<Goal>('SELECT * FROM goals WHERE id = ?', [id]);
  }

  /**
   * 获取用户的所有目标
   */
  async findByUser(userId: string): Promise<Goal[]> {
    return await this.queryMany<Goal>('SELECT * FROM goals WHERE user_id = ? ORDER BY level, created_at DESC', [userId]);
  }

  /**
   * 按级别获取目标
   */
  async findByLevel(userId: string, level: Goal['level']): Promise<Goal[]> {
    return await this.queryMany<Goal>('SELECT * FROM goals WHERE user_id = ? AND level = ? ORDER BY created_at DESC', [userId, level]);
  }

  /**
   * 获取子目标
   */
  async findChildren(parentId: string): Promise<Goal[]> {
    return await this.queryMany<Goal>('SELECT * FROM goals WHERE parent_id = ? ORDER BY created_at DESC', [parentId]);
  }

  /**
   * 更新目标进度
   */
  async updateProgress(id: string, progress: number): Promise<void> {
    await this.runUpdate(`UPDATE goals SET progress = ?, updated_at = ${getNowSql()} WHERE id = ?`, [Math.min(100, Math.max(0, progress)), id]);
  }

  /**
   * 标记目标为完成
   */
  async markAsCompleted(id: string): Promise<void> {
    await this.runUpdate(`UPDATE goals SET is_completed = 1, updated_at = ${getNowSql()} WHERE id = ?`, [id]);
  }

  /**
   * 更新目标
   */
  async update(id: string, fields: Partial<CreateGoalInput>): Promise<void> {
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
      setClauses.push(`updated_at = ${getNowSql()}`);
      values.push(id);
      await this.runUpdate(`UPDATE goals SET ${setClauses.join(', ')} WHERE id = ?`, values);
    }
  }

  /**
   * 删除目标
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.runDelete('DELETE FROM goals WHERE id = ?', [id]);
    return result > 0;
  }
}
