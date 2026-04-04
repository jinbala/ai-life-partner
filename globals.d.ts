/**
 * 全局类型定义
 */

// 扩展 NodeJS 进程环境变量类型
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly PORT?: string;
    readonly AI_MODEL_PROVIDER?: string;
    readonly FEISHU_VERIFICATION_TOKEN?: string;
    readonly FEISHU_APP_ID?: string;
    readonly FEISHU_APP_SECRET?: string;
    readonly API_KEY?: string;
    readonly OPENAI_API_KEY?: string;
    readonly DEEPSEEK_API_KEY?: string;
    readonly ANTHROPIC_API_KEY?: string;
    readonly MOONSHOT_API_KEY?: string;
    readonly DASHSCOPE_API_KEY?: string;
    readonly ZHIPU_API_KEY?: string;
    readonly CUSTOM_API_BASE_URL?: string;
    readonly CUSTOM_API_MODEL?: string;
    readonly CUSTOM_API_KEY?: string;
  }
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      userId?: string;
      auth?: {
        userId: string;
        type: 'api_key' | 'session' | 'jwt';
        issuedAt: number;
        expiresAt?: number;
      };
    }
  }
}

// 确保模块被识别
export {};
