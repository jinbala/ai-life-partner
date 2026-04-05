/**
 * AIService 单元测试
 */

import { AIService, generateSystemPrompt, InputValidator } from '../../src/services/ai';

describe('InputValidator', () => {
  describe('validate', () => {
    it('应该通过普通输入', () => {
      const result = InputValidator.validate('今天天气不错', {
        isImportantDecision: false,
      });

      expect(result.isValid).toBe(true);
      expect(result.needsClarification).toBe(false);
    });

    it('应该检测观点性陈述', () => {
      const result = InputValidator.validate('我觉得这个投资很好', {
        isImportantDecision: true,
      });

      expect(result.needsClarification).toBe(true);
      expect(result.questions).toContain(
        '你说的这个是事实还是你的感受/观点？'
      );
    });

    it('应该检查决策信息完整度', () => {
      const result = InputValidator.validate('我要不要投资开店？', {
        isImportantDecision: true,
      });

      expect(result.needsClarification).toBe(true);
      expect(result.questions).toContain(
        '做这个判断你还需要知道什么？比如风险、收益、替代方案？'
      );
    });

    it('应该检测情绪化词汇', () => {
      const result = InputValidator.validate('我必须马上做决定！', {
        isImportantDecision: true,
      });

      expect(result.needsClarification).toBe(true);
      expect(result.questions).toContain(
        '你现在的状态适合做这个决定吗？有没有被情绪影响？'
      );
    });
  });
});

describe('generateSystemPrompt', () => {
  it('应该生成基础 prompt', () => {
    const prompt = generateSystemPrompt();

    expect(prompt).toContain('你是 AI 人生合伙人');
    expect(prompt).toContain('第一性原理');
  });

  it('应该添加当前焦点', () => {
    const prompt = generateSystemPrompt({ currentFocus: '创业分析' });

    expect(prompt).toContain('【当前焦点：创业分析】');
  });

  it('应该添加决策模式', () => {
    const prompt = generateSystemPrompt({ decisionMode: true });

    expect(prompt).toContain('6 步决策框架');
  });
});

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
  });

  describe('getModelInfo', () => {
    it('应该返回模型信息', () => {
      const info = aiService.getModelInfo();

      expect(info).toBeDefined();
      expect(info.includes('-')).toBe(true);
    });
  });

  describe('switchProvider', () => {
    it('应该成功切换提供商', () => {
      const result = aiService.switchProvider('deepseek');

      expect(result).toBe(true);
      expect(aiService.getModelInfo()).toContain('DeepSeek');
    });

    it('应该切换到默认提供商当提供商不存在', () => {
      const result = aiService.switchProvider('invalid_provider');

      // 不存在的提供商默认切换到 deepseek
      expect(result).toBe(true);
      expect(aiService.getModelInfo()).toContain('DeepSeek');
    });
  });
});
