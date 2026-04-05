import axios from 'axios';
import { generateSystemPrompt, AI_PERSONA } from './aiPersona';
import { logger } from '../../utils/logger';
import { createError, ErrorType, toAppError } from '../../utils/errorHandler';
import { TokenUsageRepository } from '../../database/repositories';

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 支持的模型提供商配置
 */
export interface ModelConfig {
  name: string;           // 配置名称
  baseURL: string;        // API 基础地址
  model: string;          // 模型名称
  apiKey: string;         // API 密钥
}

/**
 * 预定义的模型配置（函数形式，延迟读取环境变量）
 */
export function getModelPreset(provider: string): ModelConfig {
  const presets: Record<string, ModelConfig> = {
    // OpenAI
    openai: {
      name: 'OpenAI',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
    },

    // DeepSeek
    deepseek: {
      name: 'DeepSeek',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    },

    // Claude (通过 Anthropic 官方 API)
    claude: {
      name: 'Claude',
      baseURL: 'https://api.anthropic.com/v1',
      model: 'claude-sonnet-4-20250514',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    },

    // 月之暗面 (Kimi)
    moonshot: {
      name: 'Moonshot',
      baseURL: 'https://api.moonshot.cn/v1',
      model: 'moonshot-v1-8k',
      apiKey: process.env.MOONSHOT_API_KEY || '',
    },

    // 通义千问
    qwen: {
      name: 'Qwen',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      apiKey: process.env.DASHSCOPE_API_KEY || '',
    },

    // 智谱 AI
    zhipu: {
      name: 'ZhiPU',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4',
      apiKey: process.env.ZHIPU_API_KEY || '',
    },

    // 本地 Ollama
    ollama: {
      name: 'Ollama',
      baseURL: 'http://localhost:11434/v1',
      model: 'llama3',
      apiKey: 'ollama',  // Ollama 不需要密钥
    },

    // 自定义（通用 OpenAI 兼容接口）
    custom: {
      name: 'Custom',
      baseURL: process.env.CUSTOM_API_BASE_URL || '',
      model: process.env.CUSTOM_API_MODEL || '',
      apiKey: process.env.CUSTOM_API_KEY || '',
    },
  };

  return presets[provider] || presets.deepseek;
}

export class AIService {
  private config: ModelConfig;
  private tokenUsageRepo: TokenUsageRepository;
  // 模型定价（每 1000 tokens 的价格，单位：元）
  private static readonly MODEL_PRICES: Record<string, { input: number; output: number }> = {
    'deepseek-chat': { input: 0.002, output: 0.008 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
    'moonshot-v1-8k': { input: 0.012, output: 0.012 },
    'qwen-plus': { input: 0.004, output: 0.012 },
    'glm-4': { input: 0.05, output: 0.05 },
  };

  constructor(config?: ModelConfig) {
    // 默认使用 deepseek，如果没配置则使用第一个可用的
    const provider = process.env.AI_MODEL_PROVIDER || 'deepseek';

    if (config) {
      this.config = config;
    } else {
      this.config = getModelPreset(provider);
    }

    this.tokenUsageRepo = new TokenUsageRepository();

    if (!this.config.apiKey && this.config.name !== 'Ollama') {
      logger.warn('[AI] API 密钥未配置', { provider: this.config.name });
    }
  }

  /**
   * 发送消息到 AI 模型
   */
  async chat(messages: ChatMessage[], options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
  }): Promise<AIResponse> {
    const defaultSystemPrompt = generateSystemPrompt();

    // 确保第一条是 system prompt
    if (messages[0]?.role !== 'system') {
      messages = [{ role: 'system', content: defaultSystemPrompt }, ...messages];
    }

    // Claude API 有特殊格式要求
    if (this.config.name === 'Claude') {
      return this.chatWithClaude(messages, options);
    }

    try {
      const response = await axios.post(
        `${this.config.baseURL}/chat/completions`,
        {
          model: this.config.model,
          messages,
          max_tokens: options?.maxTokens || 500,
          temperature: options?.temperature ?? 0.1,  // 低温保证一致性
          stream: options?.stream || false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const choice = response.data.choices[0];
      const result = {
        content: choice.message?.content || '',
        usage: {
          promptTokens: response.data.usage?.prompt_tokens || 0,
          completionTokens: response.data.usage?.completion_tokens || 0,
          totalTokens: response.data.usage?.total_tokens || 0,
        },
      };

      // 记录 Token 使用
      this.recordTokenUsage(result.usage);

      return result;
    } catch (error) {
      const appError = toAppError(error);

      // 根据错误类型提供友好消息
      let userMessage = 'AI 服务暂时不可用，请稍后重试';

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          userMessage = '请求过于频繁，请稍后再试';
        } else if (status === 401) {
          userMessage = 'AI 服务认证失败，请检查 API 密钥配置';
        } else if (status === 503 || status === 504) {
          userMessage = 'AI 服务暂时不可用，请稍后重试';
        }
      }

      logger.error('[AI] 请求失败', {
        provider: this.config.name,
        error: appError.details,
        userMessage,
      });

      throw createError(
        ErrorType.AI_SERVICE,
        userMessage,
        appError.details,
        appError.statusCode
      );
    }
  }

  /**
   * Claude API 特殊处理
   */
  private async chatWithClaude(messages: ChatMessage[], options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<AIResponse> {
    // 分离 system prompt
    let systemPrompt = '';
    const claudeMessages = messages.filter(msg => {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
        return false;
      }
      return true;
    }).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));

    try {
      const response = await axios.post(
        `${this.config.baseURL}/messages`,
        {
          model: this.config.model,
          max_tokens: options?.maxTokens || 500,
          system: systemPrompt,
          messages: claudeMessages,
        },
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const content = response.data.content?.[0]?.text || '';
      const result = {
        content,
        usage: {
          promptTokens: response.data.usage?.input_tokens || 0,
          completionTokens: response.data.usage?.output_tokens || 0,
          totalTokens: (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0),
        },
      };

      // 记录 Token 使用
      this.recordTokenUsage(result.usage);

      return result;
    } catch (error) {
      const appError = toAppError(error);

      let userMessage = 'AI 服务暂时不可用，请稍后重试';

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 429) {
          userMessage = '请求过于频繁，请稍后再试';
        } else if (status === 401) {
          userMessage = 'AI 服务认证失败，请检查 API 密钥配置';
        }
      }

      logger.error('[AI] Claude 请求失败', {
        error: appError.details,
        userMessage,
      });

      throw createError(
        ErrorType.AI_SERVICE,
        userMessage,
        appError.details,
        appError.statusCode
      );
    }
  }

  /**
   * 获取当前配置的模型信息
   */
  getModelInfo(): string {
    return `${this.config.name} - ${this.config.model}`;
  }

  /**
   * 切换模型提供商
   */
  switchProvider(provider: string): boolean {
    const preset = getModelPreset(provider);
    if (preset) {
      this.config = preset;
      return true;
    }
    return false;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat([
        { role: 'user', content: 'Hello' },
      ], { maxTokens: 10 });
      return !!response.content;
    } catch (error) {
      logger.error('[AI] 连接测试失败', error);
      return false;
    }
  }

  /**
   * 记录 Token 使用
   */
  private recordTokenUsage(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    try {
      const cost = this.calculateCost(usage.promptTokens, usage.completionTokens);

      this.tokenUsageRepo.record({
        provider: this.config.name,
        model: this.config.model,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        cost,
      });

      logger.debug('[AI] Token 使用记录', {
        provider: this.config.name,
        model: this.config.model,
        tokens: usage.totalTokens,
        cost: `¥${cost.toFixed(4)}`,
      });
    } catch (error) {
      logger.error('[AI] 记录 Token 使用失败', error);
    }
  }

  /**
   * 计算成本
   */
  private calculateCost(promptTokens: number, completionTokens: number): number {
    const price = AIService.MODEL_PRICES[this.config.model];
    if (!price) {
      return 0; // 未知模型不计费
    }

    const promptCost = (promptTokens / 1000) * price.input;
    const completionCost = (completionTokens / 1000) * price.output;
    return promptCost + completionCost;
  }

  /**
   * 获取 Token 使用统计
   */
  getTokenUsage(userId?: string, days?: number) {
    return {
      total: this.tokenUsageRepo.getTotalSummary(userId, days),
      byProvider: this.tokenUsageRepo.getSummaryByProvider(userId, days),
      recent: this.tokenUsageRepo.getRecentRecords(10, userId),
    };
  }

  /**
   * 简易回复（日常对话）
   */
  async quickReply(userMessage: string, context?: {
    currentFocus?: string;
  }): Promise<string> {
    const systemPrompt = generateSystemPrompt({
      currentFocus: context?.currentFocus,
    });

    const response = await this.chat([
      { role: 'user', content: userMessage },
    ], {
      maxTokens: 200,  // 限制长度
      temperature: 0.1,
    });

    return response.content;
  }

  /**
   * 决策分析模式
   */
  async decisionAnalysis(
    decisionTopic: string,
    userContext?: string
  ): Promise<string> {
    const systemPrompt = generateSystemPrompt({
      decisionMode: true,
    });

    const prompt = `用户面临一个决策，请使用 6 步决策框架分析：

**决策主题**: ${decisionTopic}
${userContext ? `**补充信息**: ${userContext}` : ''}

请按照以下框架分析：
1. 本质问题（第一性原理）
2. 信息盘点（已知 + 缺失 + 通用知识标注可信度）
3. 选项分析（代价/收益/可逆性/对长期目标影响）
4. 初级建议 + 引导思考
5. 执行计划 + 预期结果
6. 止损线（什么情况说明选错了 + 备选方案）`;

    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ], {
      maxTokens: 800,
      temperature: 0.1,
    });

    return response.content;
  }

  /**
   * 紧急决策模式
   */
  async quickDecision(situation: string): Promise<string> {
    const prompt = `用户需要紧急决策。请直接问 3 个关键问题：
1. 最坏结果你能不能承受？
2. 这个决定可以反悔吗？
3. 不做决定会怎样？

情况：${situation}

请简洁回复，帮用户在 5 分钟内理清思路。`;

    const response = await this.chat([
      { role: 'user', content: prompt },
    ], {
      maxTokens: 150,
      temperature: 0.1,
    });

    return response.content;
  }

  /**
   * 引导式提问（用于用户画像初始化等场景）
   */
  async guidedQuestion(
    topic: string,
    previousAnswer?: string
  ): Promise<string> {
    const prompt = previousAnswer
      ? `用户回答了关于${topic}的问题："${previousAnswer}"。
         请根据回答继续追问下一个相关问题，或者确认信息已足够。
         保持简洁，一个问题即可。`
      : `请问用户一个关于${topic}的问题，帮他建立清晰的自我认知。
         保持简洁，一次只问一个问题。`;

    const response = await this.chat([
      { role: 'user', content: prompt },
    ], {
      maxTokens: 100,
      temperature: 0.3,
    });

    return response.content;
  }
}
