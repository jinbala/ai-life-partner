/**
 * 配置验证
 * 使用 zod 验证环境变量和配置
 */

import { z } from 'zod';

// 环境变量 schema
const envSchema = z.object({
  // 服务器配置
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // 飞书配置
  FEISHU_APP_ID: z.string().optional(),
  FEISHU_APP_SECRET: z.string().optional(),
  FEISHU_VERIFICATION_TOKEN: z.string().optional(),
  FEISHU_ENCRYPTION_KEY: z.string().optional(),

  // AI 模型配置
  AI_MODEL_PROVIDER: z.enum(['custom', 'deepseek', 'openai', 'claude', 'moonshot', 'qwen', 'zhipu', 'ollama']).default('custom'),
  CUSTOM_API_BASE_URL: z.string().optional(),
  CUSTOM_API_MODEL: z.string().optional(),
  CUSTOM_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  MOONSHOT_API_KEY: z.string().optional(),
  QWEN_API_KEY: z.string().optional(),
  ZHIPU_API_KEY: z.string().optional(),

  // 数据库配置
  DATABASE_PATH: z.string().optional(),

  // 日志配置
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FILE: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * 验证并获取配置
 */
export function validateEnv(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    const errors = Object.entries(flattened.fieldErrors).map(([path, messages]) => ({
      path,
      message: messages?.join(', ') || '验证失败',
    }));

    console.error('❌ 环境变量验证失败:');
    errors.forEach(err => {
      console.error(`  - ${err.path}: ${err.message}`);
    });
    throw new Error('环境变量配置无效');
  }

  return parsed.data;
}

/**
 * 检查 AI 配置是否有效
 */
export function validateAiConfig(config: EnvConfig): { valid: boolean; error?: string } {
  const provider = config.AI_MODEL_PROVIDER;

  if (provider === 'custom') {
    if (!config.CUSTOM_API_BASE_URL || !config.CUSTOM_API_KEY) {
      return {
        valid: false,
        error: 'Custom 模式需要配置 CUSTOM_API_BASE_URL 和 CUSTOM_API_KEY',
      };
    }
  }

  if (provider === 'deepseek' && !config.DEEPSEEK_API_KEY) {
    return { valid: false, error: 'DeepSeek 模式需要配置 DEEPSEEK_API_KEY' };
  }

  if (provider === 'openai' && !config.OPENAI_API_KEY) {
    return { valid: false, error: 'OpenAI 模式需要配置 OPENAI_API_KEY' };
  }

  if (provider === 'claude' && !config.ANTHROPIC_API_KEY) {
    return { valid: false, error: 'Claude 模式需要配置 ANTHROPIC_API_KEY' };
  }

  if (provider === 'moonshot' && !config.MOONSHOT_API_KEY) {
    return { valid: false, error: 'Moonshot 模式需要配置 MOONSHOT_API_KEY' };
  }

  if (provider === 'qwen' && !config.QWEN_API_KEY) {
    return { valid: false, error: 'Qwen 模式需要配置 QWEN_API_KEY' };
  }

  if (provider === 'zhipu' && !config.ZHIPU_API_KEY) {
    return { valid: false, error: 'Zhipu 模式需要配置 ZHIPU_API_KEY' };
  }

  return { valid: true };
}

/**
 * 检查飞书配置是否有效
 */
export function validateFeishuConfig(config: EnvConfig): { valid: boolean; error?: string } {
  if (!config.FEISHU_APP_ID || !config.FEISHU_APP_SECRET) {
    return {
      valid: false,
      error: '飞书功能需要配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET',
    };
  }
  return { valid: true };
}

/**
 * 配置常量
 */
export const CONFIG = {
  // 会话超时（30 分钟）
  SESSION_TIMEOUT: 30 * 60 * 1000,

  // 记忆重要性阈值
  MEMORY_IMPORTANCE_THRESHOLD: 7,

  // 记忆过期天数
  MEMORY_EXPIRY_DAYS: 90,

  // 每周复盘时间（周日凌晨 2 点）
  WEEKLY_REVIEW_CRON: '0 2 * * 0',

  // 每日复盘时间（晚上 9 点）
  DAILY_REVIEW_CRON: '0 21 * * *',

  // 早上推送时间（早上 8 点）
  MORNING_PUSH_CRON: '0 8 * * *',

  // 速率限制
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 分钟
  RATE_LIMIT_MAX_REQUESTS: 100,

  // 最大消息历史
  MAX_CONVERSATION_HISTORY: 10,

  // 能力维度
  ABILITY_DIMENSIONS: ['businessJudgment', 'execution', 'cognition', 'riskControl', 'learningAbility'] as const,
};

export type ConfigType = typeof CONFIG;
