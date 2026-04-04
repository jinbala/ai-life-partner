import { PortraitManager } from './portraitManager';
import { GoalManager } from './goalManager';
import { MemoryManager } from './memoryManager';
import { AbilityAssetManager } from './abilityAssetManager';
import { AutoReviewManager } from './autoReviewManager';
import { AIService, ChatMessage } from './aiService';

/**
 * 静默分析结果
 */
export interface SilentAnalysisResult {
  profile_updates: Record<string, any>;
  new_memories: any[];
  new_assets: any[];
  goal_deviation: string | null;
  risk_signal: string | null;
  emotion_state: string;
}

/**
 * 静默分析管理器
 * 每次对话结束后异步执行，用户无感知
 */
export class SilentAnalysisManager {
  private aiService: AIService;

  constructor(
    private userId: string,
    private portraitManager: PortraitManager,
    private goalManager: GoalManager,
    private memoryManager: MemoryManager,
    private assetsManager: AbilityAssetManager,
    private autoReviewManager: AutoReviewManager
  ) {
    this.aiService = new AIService();
  }

  /**
   * 合并 Prompt：一次性提取所有信息（减少 API 调用）
   */
  async analyze(conversation: string): Promise<SilentAnalysisResult> {
    const currentProfile = this.portraitManager.getSummary();
    const currentGoals = this.goalManager.getSummary();
    const existingMemories = this.memoryManager.loadAll();
    const existingAssets = this.assetsManager.load();
    const assetTitles = Object.values(existingAssets).flat().map(a => a.title);

    const prompt = `分析以下对话，输出 JSON：
{
  "profile_updates": {} 或 null,
  "new_memories": [] 或 [],
  "new_assets": [] 或 [],
  "goal_deviation": "描述" 或 null,
  "risk_signal": "描述" 或 null,
  "emotion_state": "正常/低落/焦虑/兴奋"
}

对话内容：${conversation}
当前画像：${currentProfile}
当前目标：${currentGoals}
已有记忆数量：${existingMemories.length}
已有资产标题：${JSON.stringify(assetTitles)}

要求：
- 不编造信息
- 没有变化的字段输出 null 或空数组
- 记忆只记录有长期价值的信息（fact/lesson/preference/event/decision/relationship）
- 资产只提取可复用的内容（frameworks/lessons/sops/insights/resources）
- 能力雷达单次调整不超过 0.5 分

new_memories 格式：
[{
  "type": "fact/lesson/preference/event/decision/relationship",
  "content": "内容",
  "tags": ["标签"],
  "importance": "low/medium/high"
}]

new_assets 格式：
[{
  "type": "frameworks/lessons/sops/insights/resources",
  "title": "标题（15 字内）",
  "content": "内容（100 字内）",
  "tags": ["标签"]
}]`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个专业的用户行为分析和知识管理专家。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 1000 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonStr) as SilentAnalysisResult;

      // 应用更新
      await this.applyUpdates(result);

      return result;
    } catch (error) {
      console.error('[SilentAnalysis] 分析失败:', error);
      return {
        profile_updates: {},
        new_memories: [],
        new_assets: [],
        goal_deviation: null,
        risk_signal: null,
        emotion_state: 'normal',
      };
    }
  }

  /**
   * 应用所有更新
   */
  private async applyUpdates(result: SilentAnalysisResult): Promise<void> {
    // 1. 更新画像
    if (result.profile_updates && Object.keys(result.profile_updates).length > 0) {
      await this.autoReviewManager.applyProfileUpdates(result.profile_updates, this.portraitManager);
    }

    // 2. 保存新记忆
    result.new_memories.forEach(mem => {
      this.memoryManager.add({
        date: new Date().toISOString(),
        type: mem.type,
        content: mem.content,
        tags: mem.tags,
        importance: mem.importance,
        source: '对话提取',
      });
    });

    // 3. 保存新资产
    result.new_assets.forEach(asset => {
      this.assetsManager.add({
        title: asset.title,
        content: asset.content,
        tags: asset.tags,
        type: asset.type,
        source_topic: '对话提取',
      });
    });

    // 4. 记录风险信号（用于后续警告）
    if (result.risk_signal) {
      // TODO: 设置标志位，下次对话时提醒
      console.log('[SilentAnalysis] 风险信号:', result.risk_signal);
    }

    // 5. 记录目标偏离
    if (result.goal_deviation) {
      // TODO: 设置标志位，下次对话时提醒
      console.log('[SilentAnalysis] 目标偏离:', result.goal_deviation);
    }
  }
}
