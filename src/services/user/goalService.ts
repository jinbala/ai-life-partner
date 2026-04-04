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
  createGoal(input: Omit<CreateGoalInput, 'user_id'>): string {
    const goal = this.goalRepository.create({ ...input, user_id: this.userId });
    return goal.id;
  }

  /**
   * 获取目标摘要
   */
  getSummary(): string {
    const goals = this.goalRepository.findByUser(this.userId);
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
  getTodayTasks(): Array<{ id: string; description: string; isCompleted: boolean }> {
    const today = new Date().toISOString().split('T')[0];
    const tasks = this.taskRepository.findByDate(this.userId, today);
    return tasks.map(t => ({
      id: t.id,
      description: t.description,
      isCompleted: t.is_completed,
    }));
  }

  /**
   * 添加日常任务
   */
  addDailyTask(description: string, scheduledDate: string, weeklyGoalId?: string): string {
    const task = this.taskRepository.create({
      user_id: this.userId,
      weekly_goal_id: weeklyGoalId,
      description,
      scheduled_date: scheduledDate,
    });
    return task.id;
  }

  /**
   * 标记任务完成
   */
  completeTask(taskId: string): void {
    this.taskRepository.markAsCompleted(taskId);
  }

  /**
   * 更新目标进度
   */
  updateGoalProgress(goalId: string, progress: number): void {
    this.goalRepository.updateProgress(goalId, progress);
  }

  /**
   * 获取所有目标
   */
  getAllGoals() {
    return this.goalRepository.findByUser(this.userId);
  }

  /**
   * 删除目标
   */
  deleteGoal(goalId: string): boolean {
    return this.goalRepository.delete(goalId);
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): boolean {
    return this.taskRepository.delete(taskId);
  }
}
