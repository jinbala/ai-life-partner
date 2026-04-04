/**
 * 目标管理数据结构
 */

export interface GoalTree {
  northStar: NorthStarGoal;     // 北极星（人生方向）
  yearly: YearlyGoal[];         // 年度目标
  quarterly: QuarterlyGoal[];   // 季度里程碑
  monthly: MonthlyGoal[];       // 月度重点
  weekly: WeeklyGoal[];         // 周计划
  daily: DailyTask[];           // 每日任务
}

export interface NorthStarGoal {
  id: string;
  description: string;          // 人生方向描述
  successSignals: string[];     // 成功标志
  dangerSignals: string[];      // 危险信号
  stopLossLine: string;         // 止损线
  createdAt: string;
  updatedAt: string;
}

export interface YearlyGoal {
  id: string;
  northStarId: string;          // 关联的北极星 ID
  description: string;
  successSignals: string[];
  dangerSignals: string[];
  stopLossLine: string;
  progress: number;             // 0-100
  createdAt: string;
  updatedAt: string;
}

export interface QuarterlyGoal {
  id: string;
  yearlyGoalId: string;
  description: string;
  successSignals: string[];
  dangerSignals: string[];
  stopLossLine: string;
  progress: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  quarterlyGoalId: string;
  description: string;
  progress: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyGoal {
  id: string;
  monthlyGoalId: string;
  description: string;
  progress: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTask {
  id: string;
  weeklyGoalId: string;
  description: string;
  isCompleted: boolean;
  completedAt?: string;
  scheduledDate: string;        // 计划日期
  createdAt: string;
  updatedAt: string;
}

export interface GoalAlignmentCheck {
  /**
   * 检查某个行动是否与目标对齐
   */
  action: string;
  alignedGoal?: {
    level: 'northStar' | 'yearly' | 'quarterly' | 'monthly' | 'weekly' | 'daily';
    goalId: string;
    goalDescription: string;
  };
  isDeviating: boolean;         // 是否偏离主线
  deviationWeeks?: number;      // 连续偏离周数
  suggestion?: string;          // AI 建议
}

/**
 * 创建空的目标树
 */
export function createEmptyGoalTree(): GoalTree {
  return {
    northStar: {
      id: 'ns-1',
      description: '',
      successSignals: [],
      dangerSignals: [],
      stopLossLine: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    yearly: [],
    quarterly: [],
    monthly: [],
    weekly: [],
    daily: []
  };
}
