/**
 * 决策引擎数据结构
 */

export interface DecisionRecord {
  id: string;
  userId: string;

  // 决策内容
  title: string;
  description: string;

  // 6 步框架结果
  framework: DecisionFramework;

  // 预期与结果
  expectedOutcome?: string;
  actualOutcome?: string;
  validationDate?: string;       // 验证时间
  validationMethod?: string;     // 验证方式

  // 状态
  status: 'pending' | 'executing' | 'completed' | 'abandoned';
  quality?: number;              // 决策质量 1-10

  // 时间
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}

export interface DecisionFramework {
  // Step 1: 本质问题
  step1_essence: {
    coreQuestion: string;        // 第一性原理问题
    fundamentalLogic: string;    // 最底层的逻辑
  };

  // Step 2: 信息盘点
  step2_information: {
    knownFacts: string[];        // 已知事实
    missingInfo: string[];       // 缺失信息
    generalKnowledge: Array<{    // 通用知识（标注可信度）
      item: string;
      confidence: 'high' | 'medium' | 'low';
    }>;
  };

  // Step 3: 选项分析
  step3_options: Array<{
    name: string;
    pros: string[];              // 收益
    cons: string[];              // 代价
    reversibility: 'reversible' | 'irreversible' | 'partially-reversible';
    longTermImpact: string;      // 对长期目标影响
  }>;

  // Step 4: 初级建议 + 引导思考
  step4_advisory: {
    initialDirection: string;    // AI 先给方向
    reflectionQuestions: string[]; // 抛问题
  };

  // Step 5: 执行计划
  step5_execution: {
    firstStep: string;           // 第一步
    expectedOutcome: string;     // 可衡量的预期
    validationTime: string;      // 验证时间
  };

  // Step 6: 止损线
  step6_stopLoss: {
    warningSignals: string[];    // 什么情况说明选错了
    backupPlan: string;          // 备选方案
  };
}

export interface QuickDecision {
  // 紧急决策模式
  id: string;
  userId: string;
  situation: string;

  // 3 个关键问题
  answers: {
    worstCaseAcceptable: boolean;  // 最坏结果能不能承受
    reversible: boolean;           // 这个决定可以反悔吗
    noActionConsequence: string;   // 不做决定会怎样
  };

  conclusion: string;
  createdAt: string;
  followUpAdded?: boolean;         // 事后是否补充完整分析
}

/**
 * 决策日志存储结构
 */
export interface DecisionLog {
  decisions: DecisionRecord[];
  quickDecisions: QuickDecision[];
}
