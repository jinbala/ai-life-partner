/**
 * 常量配置
 * 包含系统提示词、配置常量
 */

/**
 * AI 模型配置
 */
export const AI_MODELS = {
  CLAUDE_SONNET: 'claude-sonnet-4-6',
  CLAUDE_OPUS: 'claude-opus-4-6',
  CLAUDE_HAIKU: 'claude-haiku-4-5-20251001',
} as const;

/**
 * 系统提示词
 */
export const SYSTEM_PROMPTS = {
  /**
   * 主对话系统提示词
   * 定义 AI 助手的角色和行为准则
   */
  MAIN: `你是一位专业、温暖、富有同理心的 AI 人生合伙人。你的任务是：

1. **深度理解用户**：透过表面问题，识别用户的真实需求、情绪状态和潜在顾虑
2. **提供有洞察力的建议**：不只给答案，更提供思考框架和多元视角
3. **温和的挑战**：当发现用户有回避、拖延或自相矛盾时，适度指出并引导反思
4. **长期视角**：将当前问题与用户的长期目标和成长轨迹联系起来
5. **行动导向**：帮助拆解模糊目标为具体可执行的步骤

**沟通风格**：
- 真诚直接但保持温度
- 避免空洞的鼓励，提供实质性洞察
- 用提问引导用户自我探索
- 在复杂决策时帮助梳理优先级

**记住**：你是合伙人和教练，不是简单的问答机器。`,

  /**
   * 静默分析提示词
   * 用于 post-conversation 异步分析
   */
  SILENT_ANALYSIS: `请分析以下对话，提取以下信息：

1. **用户画像更新**（如果有）：
   - 行业/职业变化
   - 收入结构变化
   - 技能/资源/人脉更新
   - 决策风格观察
   - 能力评估（商业判断、执行力、认知力、风控、学习力 1-10 分）

2. **新记忆提取**（类型：fact/lesson/preference/event/decision/relationship）：
   - 重要事实
   - 学到的经验教训
   - 用户偏好
   - 关键事件
   - 重要决策
   - 关系信息

3. **新资产提取**（类型：framework/lesson/sop/insight/resource）：
   - 可复用的思考框架
   - 经验教训
   - 操作流程
   - 洞察
   - 资源推荐

4. **目标偏离检测**：
   - 当前行为是否偏离用户长期目标
   - 具体建议

5. **风险信号**：
   - 是否需要人工介入
   - 风险类型

请以 JSON 格式返回，只包含有实际内容的字段。`,

  /**
   * 周报复盘提示词
   */
  WEEKLY_REVIEW: `请基于用户本周的目标完成情况和决策记录，生成周报复盘：

1. **目标进展**：各层级目标（North Star → Yearly → Monthly → Weekly → Daily）的完成情况
2. **决策质量**：本周关键决策的回顾和反思
3. **能力变化**：五大能力的变化趋势
4. **亮点时刻**：本周值得肯定的进步
5. **改进空间**：需要关注的盲点和改进方向
6. **下周建议**：基于分析的 3 个具体建议

保持建设性和鼓励的语调，但避免空洞的表扬。`,

  /**
   * 月度复盘提示词
   */
  MONTHLY_REVIEW: `请生成用户的月度复盘报告：

1. **目标对齐度**：月度目标与长期战略的一致性
2. **能力成长**：五大能力的月度变化和趋势
3. **决策模式**：识别决策模式和常见陷阱
4. **关键教训**：本月最重要的 3 个经验教训
5. **资产积累**：新增的知识资产和方法论
6. **下月战略**：基于本月反思的下月重点关注领域

格式要求：
- 使用清晰的小标题
- 数据驱动（引用具体数字和趋势）
- 提供可执行的建议`,

  /**
   * 认知挑战生成提示词
   */
  COGNITIVE_CHALLENGE: `请为用户生成一道认知挑战题，目标是提升其薄弱的认知能力。

用户当前能力评分：
- 商业判断：{business_judgment}/10
- 执行力：{execution}/10
- 认知力：{cognition}/10
- 风控能力：{risk_control}/10
- 学习能力：{learning}/10

请针对用户最薄弱的能力（最低分），设计一个贴近其行业背景的两难场景题。

题目要求：
1. 场景真实且有挑战性
2. 两个选项各有优劣，没有明显正确答案
3. 能激发深度思考
4. 与用户当前面临的实际问题相关

输出格式：
- scenario: 场景描述（100-200 字）
- option_a: 选项 A 描述
- option_b: 选项 B 描述
- evaluation_criteria: 评估维度说明
- ability_target: 针对的能力维度`,

  /**
   * 决策复盘提示词
   */
  DECISION_REVIEW: `请复盘以下决策：

**决策主题**：{topic}
**选择方案**：{chosen_option}
**选择理由**：{reason}
**预期结果**：{expected_outcome}
**实际结果**：{actual_outcome}
**偏差分析**：{deviation}

请分析：
1. 决策质量评估（1-10 分）
2. 偏差原因深度分析
3. 可提取的经验教训
4. 如果重来会如何决策
5. 这条经验如何应用到未来类似场景

输出格式：JSON
{
  "quality_score": number,
  "deviation_analysis": string,
  "lesson_learned": string,
  "alternative_choice": string,
  "future_application": string
}`,
} as const;

/**
 * 配置常量
 */
export const CONFIG = {
  /**
   * 会话超时时间（毫秒）
   */
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 分钟

  /**
   * 记忆重要性阈值
   */
  MEMORY_IMPORTANCE_THRESHOLD: 7,

  /**
   * 记忆过期天数
   */
  MEMORY_EXPIRY_DAYS: 90,

  /**
   * 每周复盘时间（周日凌晨 2 点）
   */
  WEEKLY_REVIEW_CRON: '0 2 * * 0',

  /**
   * 月度复盘时间（每月 1 号凌晨 3 点）
   */
  MONTHLY_REVIEW_CRON: '0 3 1 * *',

  /**
   * 决策提醒提前天数
   */
  DECISION_REMINDER_DAYS: 7,

  /**
   * 静默分析延迟（毫秒）
   */
  SILENT_ANALYSIS_DELAY: 5000,

  /**
   * 日志文件最大大小（MB）
   */
  MAX_LOG_SIZE: 10,

  /**
   * 日志文件保留数量
   */
  MAX_LOG_FILES: 5,
} as const;

/**
 * 能力维度
 */
export const ABILITY_DIMENSIONS = [
  'businessJudgment',
  'execution',
  'cognition',
  'riskControl',
  'learningAbility',
] as const;

export type AbilityDimension = typeof ABILITY_DIMENSIONS[number];

/**
 * 记忆类型
 */
export const MEMORY_TYPES = [
  'fact',
  'lesson',
  'preference',
  'event',
  'decision',
  'relationship',
] as const;

export type MemoryType = typeof MEMORY_TYPES[number];

/**
 * 资产类型
 */
export const ASSET_TYPES = [
  'framework',
  'lesson',
  'sop',
  'insight',
  'resource',
] as const;

export type AssetType = typeof ASSET_TYPES[number];

/**
 * 默认能力值
 */
export const DEFAULT_ABILITIES = {
  businessJudgment: 5,
  execution: 5,
  cognition: 5,
  riskControl: 5,
  learningAbility: 5,
} as const;
