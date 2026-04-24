/**
 * 用户画像数据结构
 */

export interface UserPortrait {
  // 基本面
  basics: {
    industry?: string;        // 行业/职业
    incomeStructure: {        // 收入结构
      sources: IncomeSource[];
      largestSource?: string;
    };
    availableTime: number;    // 每日可支配时间（小时）
    resources: {              // 手上的资源
      funds: string;          // 资金情况
      connections: string;    // 人脉
      skills: string[];       // 技能
    };
  };

  // 能力雷达 (1-10 分)
  abilities: {
    businessJudgment: number;   // 商业判断力
    execution: number;          // 执行力
    cognition: number;          // 认知水平
    riskControl: number;        // 风险控制
    learningAbility: number;    // 学习能力
  };

  // 行为模式
  behaviorPatterns: {
    decisionStyle: 'impulsive' | 'hesitant' | 'rational' | 'intuitive';  // 决策风格
    stuckPoints: string[];      // 容易卡住的环节
    procrastinationTriggers: string[];  // 拖延触发器
    peakEfficiencyTime: string; // 高效时段
  };

  // 成长轨迹
  growthTrack: {
    abilityTrend: AbilityChange[];  // 能力变化趋势
    decisionQuality: DecisionRecord[]; // 决策质量记录
    cognitionUpgrades: CognitionUpgrade[]; // 认知升级记录
  };

  // 元数据
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface IncomeSource {
  name: string;
  amount: number;
  stability: 'stable' | 'unstable' | 'seasonal';
  percentage: number;  // 占总收入比例
}

export interface AbilityChange {
  date: string;
  ability: keyof UserPortrait['abilities'];
  oldValue: number;
  newValue: number;
  reason: string;
}

export interface DecisionRecord {
  date: string;
  decision: string;
  quality: number;  // 1-10
  outcome?: string;
}

export interface CognitionUpgrade {
  date: string;
  description: string;
  trigger: string;  // 触发这个认知升级的事件
}

/**
 * 创建默认用户画像
 */
export function createDefaultPortrait(): UserPortrait {
  const now = new Date().toISOString();
  return {
    basics: {
      industry: undefined,
      incomeStructure: {
        sources: [],
        largestSource: undefined
      },
      availableTime: 1,  // 默认每日 1 小时
      resources: {
        funds: '待补充',
        connections: '待补充',
        skills: []
      }
    },
    abilities: {
      businessJudgment: 5,
      execution: 5,
      cognition: 5,
      riskControl: 5,
      learningAbility: 5
    },
    behaviorPatterns: {
      decisionStyle: 'intuitive',  // 默认靠直觉
      stuckPoints: [],
      procrastinationTriggers: [],
      peakEfficiencyTime: '待补充'
    },
    growthTrack: {
      abilityTrend: [],
      decisionQuality: [],
      cognitionUpgrades: []
    },
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}
