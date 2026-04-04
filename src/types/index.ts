/**
 * 统一类型导出
 */

// Portrait
export interface UserPortrait {
  version: number;
  updatedAt: string;
  basics: {
    industry: string;
    incomeStructure: {
      sources: Array<{ name: string; amount: number; stability: string; percentage: number }>;
      largestSource: string;
    };
    resources: {
      skills: string[];
      networks: string[];
      tools: string[];
    };
  };
  behaviorPatterns: {
    decisionStyle: string;
    stuckPoints: string[];
    procrastinationTriggers: string[];
  };
  abilities: {
    businessJudgment: number;
    execution: number;
    cognition: number;
    riskControl: number;
    learningAbility: number;
  };
  growthTrack: {
    abilityTrend: any[];
    decisionQuality: any[];
    cognitionUpgrades: any[];
  };
}

export function createDefaultPortrait(): UserPortrait {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    basics: {
      industry: '',
      incomeStructure: {
        sources: [],
        largestSource: '',
      },
      resources: {
        skills: [],
        networks: [],
        tools: [],
      },
    },
    behaviorPatterns: {
      decisionStyle: 'unknown',
      stuckPoints: [],
      procrastinationTriggers: [],
    },
    abilities: {
      businessJudgment: 5,
      execution: 5,
      cognition: 5,
      riskControl: 5,
      learningAbility: 5,
    },
    growthTrack: {
      abilityTrend: [],
      decisionQuality: [],
      cognitionUpgrades: [],
    },
  };
}

// Goal
export interface GoalTree {
  northStar: NorthStarGoal;
  yearly: YearlyGoal[];
  monthly: MonthlyGoal[];
  weekly: WeeklyGoal[];
  daily: DailyTask[];
}

export interface NorthStarGoal {
  id: string;
  description: string;
  successSignals: string[];
  dangerSignals: string[];
  stopLossLine: string;
  createdAt: string;
  updatedAt: string;
}

export interface YearlyGoal {
  id: string;
  northStarId: string;
  description: string;
  successSignals: string[];
  dangerSignals: string[];
  stopLossLine: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyGoal {
  id: string;
  yearlyGoalId: string;
  description: string;
  progress: number;
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
  scheduledDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalAlignmentCheck {
  action: string;
  isDeviating: boolean;
  suggestion?: string;
  alignedGoal?: {
    level: string;
    goalId: string;
    goalDescription: string;
  };
}

export function createEmptyGoalTree(): GoalTree {
  return {
    northStar: {
      id: '',
      description: '',
      successSignals: [],
      dangerSignals: [],
      stopLossLine: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    yearly: [],
    monthly: [],
    weekly: [],
    daily: [],
  };
}

// Decision
export interface DecisionRecord {
  id: string;
  date: string;
  topic: string;
  essence: string;
  options: Array<{
    name: string;
    cost: string;
    benefit: string;
    reversible: boolean;
  }>;
  chosen: string;
  reason: string;
  expected_outcome: string;
  verify_date: string;
  actual_outcome: string;
  deviation: string;
  deviation_reason: string;
  lesson_extracted: string;
  lesson_asset_id: string;
  profile_impact: string;
  status: string;
  reminded: boolean;
}
