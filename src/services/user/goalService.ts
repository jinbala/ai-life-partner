/**
 * 目标服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { GoalRepository, DailyTaskRepository, CreateGoalInput, CreateTaskInput } from '../../database/repositories';

export interface GoalSummary {
  northStar: string | null;
  annual: Array<{ id: string; description: string; progress: number }>;
  monthly: Array<{ id: string; description: string; progress: number }>;
  weekly: Array<{ id: string; description: string; progress: number }>;
}

/**
 * 目标服务
 */
export class GoalService {
  private goalRepository: GoalRepository;
  private taskRepository: DailyTaskRepository;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.goalRepository = new GoalRepository();
    this.taskRepository = new DailyTaskRepository();
  }

  /**
   * 创建目标
   */
  async createGoal(input: Omit<CreateGoalInput, 'user_id'>): Promise<string> {
    const goal = await this.goalRepository.create({ ...input, user_id: this.userId });
    return goal.id;
  }

  /**
   * 获取目标摘要
   */
  async getSummary(): Promise<string> {
    const goals = await this.goalRepository.findByUser(this.userId);
    if (goals.length === 0) {
      return '暂无目标';
    }

    const northStar = goals.find(g => g.level === 'north_star');
    const annual = goals.filter(g => g.level === 'annual');
    const monthly = goals.filter(g => g.level === 'monthly');
    const weekly = goals.filter(g => g.level === 'weekly');

    let result = '';
    if (northStar) {
      result += `北极星：${northStar.description}\n`;
    }
    if (annual.length > 0) {
      result += `年度目标：${annual.length}个\n`;
    }
    if (monthly.length > 0) {
      result += `月度目标：${monthly.length}个\n`;
    }
    if (weekly.length > 0) {
      result += `周目标：${weekly.length}个\n`;
    }

    return result || '暂无明确目标';
  }

  /**
   * 获取今日任务
   */
  async getTodayTasks(): Promise<Array<{ id: string; description: string; isCompleted: boolean }>> {
    const today = new Date().toISOString().split('T')[0];
    const tasks = await this.taskRepository.findByDate(this.userId, today);
    return tasks.map(t => ({
      id: t.id,
      description: t.description,
      isCompleted: t.is_completed === 1,
    }));
  }

  /**
   * 创建任务
   */
  async createTask(input: Omit<CreateTaskInput, 'user_id'>): Promise<string> {
    const task = await this.taskRepository.create({ ...input, user_id: this.userId });
    return task.id;
  }

  /**
   * 标记任务为完成
   */
  async markTaskCompleted(taskId: string): Promise<void> {
    await this.taskRepository.markAsCompleted(taskId);
  }

  /**
   * 获取所有目标
   */
  async getAllGoals(): Promise<any[]> {
    const goals = await this.goalRepository.findByUser(this.userId);
    return goals.map(g => ({
      id: g.id,
      level: g.level,
      description: g.description,
      progress: g.progress,
      isCompleted: g.is_completed === 1,
    }));
  }

  /**
   * 更新目标进度
   */
  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    await this.goalRepository.updateProgress(goalId, progress);
  }

  /**
   * 标记目标为完成
   */
  async markGoalCompleted(goalId: string): Promise<void> {
    await this.goalRepository.markAsCompleted(goalId);
  }

  /**
   * 删除目标
   */
  async deleteGoal(goalId: string): Promise<boolean> {
    return await this.goalRepository.delete(goalId);
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<boolean> {
    return await this.taskRepository.delete(taskId);
  }
}
