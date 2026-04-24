/**
 * Zod 输入验证 Schema
 * 用于验证用户输入和 API 请求
 */

import { z } from 'zod/v4';

/**
 * 聊天消息验证（带 sessionId）
 */
export const ChatMessageWithSessionSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
  sessionId: z.string().min(1, '会话 ID 不能为空'),
  message: z.string().min(1, '消息内容不能为空').max(5000, '消息内容过长'),
});

export type ChatMessageWithSessionInput = z.infer<typeof ChatMessageWithSessionSchema>;

/**
 * JWT 令牌创建验证
 */
export const CreateTokenSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
  type: z.enum(['api_key', 'session', 'refresh']).optional(),
});

export type CreateTokenInput = z.infer<typeof CreateTokenSchema>;

/**
 * 聊天消息验证
 */
export const ChatMessageSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
  content: z.string().min(1, '消息内容不能为空').max(5000, '消息内容过长'),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;

/**
 * 目标创建验证
 */
export const CreateGoalSchema = z.object({
  level: z.enum(['north_star', 'annual', 'monthly', 'weekly'], {
    error: '目标级别无效',
  }),
  description: z.string().min(1, '目标描述不能为空').max(1000, '目标描述过长'),
  parentId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  successSignals: z.string().optional(),
  dangerSignals: z.string().optional(),
  stopLossLine: z.string().optional(),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

/**
 * 任务创建验证
 */
export const CreateTaskSchema = z.object({
  description: z.string().min(1, '任务描述不能为空').max(500, '任务描述过长'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式无效'),
  weeklyGoalId: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

/**
 * 决策记录验证
 */
export const CreateDecisionSchema = z.object({
  topic: z.string().min(1, '决策主题不能为空').max(500, '决策主题过长'),
  options: z.array(z.object({
    description: z.string(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
  })).min(2, '至少需要两个选项'),
  chosen: z.string().min(1, '必须选择一个选项'),
  reason: z.string().optional(),
  expectedOutcome: z.string().optional(),
  verifyDate: z.string().optional(),
});

export type CreateDecisionInput = z.infer<typeof CreateDecisionSchema>;

/**
 * 用户画像更新验证
 */
export const UpdatePortraitSchema = z.object({
  industry: z.string().optional(),
  incomeStructure: z.object({
    sources: z.array(z.object({
      name: z.string(),
      amount: z.number().optional(),
      stability: z.enum(['stable', 'unstable', 'variable']).optional(),
      percentage: z.number().min(0).max(100).optional(),
    })).optional(),
    largestSource: z.string().optional(),
  }).optional(),
  resources: z.object({
    skills: z.array(z.string()).optional(),
    connections: z.array(z.string()).optional(),
  }).optional(),
  decisionStyle: z.enum(['impulsive', 'hesitant', 'rational', 'intuitive']).optional(),
  stuckPoints: z.array(z.string()).optional(),
  procrastinationTriggers: z.array(z.string()).optional(),
});

export type UpdatePortraitInput = z.infer<typeof UpdatePortraitSchema>;

/**
 * 能力自评验证
 */
export const AbilitySelfAssessmentSchema = z.object({
  businessJudgment: z.number().min(1).max(10).optional(),
  execution: z.number().min(1).max(10).optional(),
  cognition: z.number().min(1).max(10).optional(),
  riskControl: z.number().min(1).max(10).optional(),
  learningAbility: z.number().min(1).max(10).optional(),
});

export type AbilitySelfAssessmentInput = z.infer<typeof AbilitySelfAssessmentSchema>;

/**
 * 复盘记录验证
 */
export const CreateReviewSchema = z.object({
  type: z.enum(['daily', 'weekly', 'monthly', 'quarterly'], {
    error: '复盘类型无效',
  }),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式无效'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式无效'),
  content: z.string().min(1, '复盘内容不能为空').max(10000, '复盘内容过长'),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

/**
 * 认知挑战回答验证
 */
export const ChallengeAnswerSchema = z.object({
  challengeId: z.string().min(1, '挑战 ID 不能为空'),
  answer: z.string().min(1, '回答内容不能为空').max(2000, '回答内容过长'),
});

export type ChallengeAnswerInput = z.infer<typeof ChallengeAnswerSchema>;

/**
 * 飞书消息验证
 */
export const FeishuMessageSchema = z.object({
  openId: z.string().min(1, 'openId 不能为空'),
  content: z.string().min(1, '消息内容不能为空').max(5000, '消息内容过长'),
  messageType: z.enum(['text', 'post', 'interactive']).optional(),
});

export type FeishuMessageInput = z.infer<typeof FeishuMessageSchema>;

/**
 * 导出请求验证
 */
export const ExportRequestSchema = z.object({
  userId: z.string().min(1, '用户 ID 不能为空'),
  format: z.enum(['json', 'file']).optional(),
  includeTypes: z.array(z.enum([
    'portrait', 'goals', 'tasks', 'memories',
    'abilities', 'decisions', 'challenges', 'reviews',
  ])).optional(),
});

export type ExportRequestInput = z.infer<typeof ExportRequestSchema>;

/**
 * 通用验证函数
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { data: T; error?: null } | { data?: null; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data, error: null };
  }
  const errorMessage = result.error.issues
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join('; ');
  return { data: null, error: errorMessage };
}

/**
 * 中间件工厂：创建 Express 验证中间件
 */
export function createValidateMiddleware<T>(schema: z.ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req[source]);
    if (result.success) {
      req.validated = result.data;
      next();
    } else {
      const errorMessage = result.error.issues
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数验证失败',
          details: errorMessage,
        },
      });
    }
  };
}
