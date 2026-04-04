import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  GoalTree,
  createEmptyGoalTree,
  NorthStarGoal,
  YearlyGoal,
  QuarterlyGoal,
  MonthlyGoal,
  WeeklyGoal,
  DailyTask,
  GoalAlignmentCheck
} from '../../types';

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * 目标管理器
 */
export class GoalManager {
  private goalTreePath: string;

  constructor(userId: string = 'default') {
    this.goalTreePath = path.join(DATA_DIR, `goals_${userId}.json`);
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 加载目标树
   */
  load(): GoalTree {
    if (fs.existsSync(this.goalTreePath)) {
      const data = fs.readFileSync(this.goalTreePath, 'utf-8');
      return JSON.parse(data) as GoalTree;
    }
    return createEmptyGoalTree();
  }

  /**
   * 保存目标树
   */
  save(goalTree: GoalTree): void {
    this.ensureDataDir();
    fs.writeFileSync(this.goalTreePath, JSON.stringify(goalTree, null, 2));
  }

  /**
   * 设置北极星目标
   */
  setNorthStar(
    description: string,
    successSignals: string[],
    dangerSignals: string[],
    stopLossLine: string
  ): NorthStarGoal {
    const goalTree = this.load();
    const now = new Date().toISOString();

    goalTree.northStar = {
      id: uuidv4(),
      description,
      successSignals,
      dangerSignals,
      stopLossLine,
      createdAt: now,
      updatedAt: now
    };

    this.save(goalTree);
    return goalTree.northStar;
  }

  /**
   * 添加年度目标
   */
  addYearlyGoal(
    description: string,
    successSignals: string[],
    dangerSignals: string[],
    stopLossLine: string
  ): YearlyGoal {
    const goalTree = this.load();
    const now = new Date().toISOString();

    const newGoal: YearlyGoal = {
      id: uuidv4(),
      northStarId: goalTree.northStar.id,
      description,
      successSignals,
      dangerSignals,
      stopLossLine,
      progress: 0,
      createdAt: now,
      updatedAt: now
    };

    goalTree.yearly.push(newGoal);
    this.save(goalTree);
    return newGoal;
  }

  /**
   * 添加周计划
   */
  addWeeklyGoal(
    description: string,
    startDate: string,
    endDate: string
  ): WeeklyGoal {
    const goalTree = this.load();
    const now = new Date().toISOString();

    // 找到最新的月度目标关联
    const monthlyGoalId = goalTree.monthly.length > 0
      ? goalTree.monthly[goalTree.monthly.length - 1].id
      : 'unlinked';

    const newGoal: WeeklyGoal = {
      id: uuidv4(),
      monthlyGoalId,
      description,
      progress: 0,
      startDate,
      endDate,
      createdAt: now,
      updatedAt: now
    };

    goalTree.weekly.push(newGoal);
    this.save(goalTree);
    return newGoal;
  }

  /**
   * 添加每日任务
   */
  addDailyTask(
    description: string,
    scheduledDate: string
  ): DailyTask {
    const goalTree = this.load();
    const now = new Date().toISOString();

    // 找到最新的周计划关联
    const weeklyGoalId = goalTree.weekly.length > 0
      ? goalTree.weekly[goalTree.weekly.length - 1].id
      : 'unlinked';

    const newTask: DailyTask = {
      id: uuidv4(),
      weeklyGoalId,
      description,
      isCompleted: false,
      scheduledDate,
      createdAt: now,
      updatedAt: now
    };

    goalTree.daily.push(newTask);
    this.save(goalTree);
    return newTask;
  }

  /**
   * 完成任务
   */
  completeTask(taskId: string): boolean {
    const goalTree = this.load();
    const task = goalTree.daily.find(t => t.id === taskId);

    if (task) {
      task.isCompleted = true;
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      this.save(goalTree);
      return true;
    }
    return false;
  }

  /**
   * 获取今日任务
   */
  getTodayTasks(date: string = new Date().toISOString().split('T')[0]): DailyTask[] {
    const goalTree = this.load();
    return goalTree.daily.filter(t => t.scheduledDate === date);
  }

  /**
   * 获取本周重点
   */
  getCurrentWeekGoal(date: Date = new Date()): WeeklyGoal | undefined {
    const goalTree = this.load();
    const isoDate = date.toISOString().split('T')[0];

    return goalTree.weekly.find(week =>
      week.startDate <= isoDate && week.endDate >= isoDate
    );
  }

  /**
   * 检查行动是否与目标对齐
   */
  checkAlignment(action: string): GoalAlignmentCheck {
    const goalTree = this.load();
    const result: GoalAlignmentCheck = {
      action,
      isDeviating: false
    };

    // 简单的关键词匹配检查
    const northStarKeywords = this.extractKeywords(goalTree.northStar.description);

    // 如果北极星有内容，检查行动是否相关
    if (goalTree.northStar.description.trim()) {
      const actionKeywords = this.extractKeywords(action);
      const overlap = northStarKeywords.filter(k => actionKeywords.includes(k));

      if (overlap.length === 0 && northStarKeywords.length > 0) {
        result.isDeviating = true;
        result.suggestion = `这个行动跟你的北极星目标"${goalTree.northStar.description}"关联不强。你确定要继续吗？`;
      } else {
        result.alignedGoal = {
          level: 'northStar',
          goalId: goalTree.northStar.id,
          goalDescription: goalTree.northStar.description
        };
      }
    }

    return result;
  }

  /**
   * 提取关键词（简化版）
   */
  private extractKeywords(text: string): string[] {
    // 中文分词简化处理：按标点符号分割，取有意义的词
    return text
      .split(/[，。！？、；：\s]+/)
      .filter(w => w.length >= 2)
      .slice(0, 10);
  }

  /**
   * 获取早推送内容
   */
  getMorningPushContent(): string {
    const goalTree = this.load();
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = this.getTodayTasks(today);

    let content = '🌅 早安\n\n';

    if (goalTree.northStar.description) {
      content += `📍 北极星：${goalTree.northStar.description}\n`;
    }

    const weekGoal = this.getCurrentWeekGoal();
    if (weekGoal) {
      content += `📅 本周重点：${weekGoal.description}\n`;
    }

    content += '\n今天最重要的事：\n';

    if (todayTasks.length > 0) {
      todayTasks.slice(0, 3).forEach((task, i) => {
        const status = task.isCompleted ? '✅' : '⬜';
        content += `${i + 1}. ${status} ${task.description}\n`;
      });
    } else {
      content += '（暂无任务，请添加）\n';
    }

    return content;
  }

  /**
   * 获取目标树摘要（用于 AI 上下文）
   */
  getSummary(): string {
    const goalTree = this.load();
    const parts: string[] = [];

    if (goalTree.northStar.description) {
      parts.push(`北极星：${goalTree.northStar.description}`);
    }

    const todayTasks = this.getTodayTasks();
    const completed = todayTasks.filter(t => t.isCompleted).length;
    parts.push(`今日任务：${completed}/${todayTasks.length} 完成`);

    return parts.join(' | ');
  }
}
