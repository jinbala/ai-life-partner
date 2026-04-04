import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AIService, ChatMessage } from '../ai';

const DATA_DIR = path.join(__dirname, '../../data');

export type AssetType = 'frameworks' | 'lessons' | 'sops' | 'insights' | 'resources';

export interface AbilityAsset {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: AssetType;
  source_topic: string;
  created_at: string;
  usage_count: number;
  last_used: string;
}

export interface AssetsData {
  frameworks: AbilityAsset[];
  lessons: AbilityAsset[];
  sops: AbilityAsset[];
  insights: AbilityAsset[];
  resources: AbilityAsset[];
}

/**
 * 能力资产库管理器
 */
export class AbilityAssetManager {
  private aiService: AIService;

  constructor(private userId: string = 'default') {
    this.aiService = new AIService();
  }

  private getAssetsPath(): string {
    return path.join(DATA_DIR, `assets_${this.userId}.json`);
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  /**
   * 加载所有资产
   */
  load(): AssetsData {
    const assetsPath = this.getAssetsPath();
    if (fs.existsSync(assetsPath)) {
      const data = fs.readFileSync(assetsPath, 'utf-8');
      return JSON.parse(data) as AssetsData;
    }

    // 返回空结构
    return {
      frameworks: [],
      lessons: [],
      sops: [],
      insights: [],
      resources: [],
    };
  }

  /**
   * 保存资产
   */
  save(assets: AssetsData): void {
    this.ensureDataDir();
    fs.writeFileSync(this.getAssetsPath(), JSON.stringify(assets, null, 2));
  }

  /**
   * 添加资产
   */
  add(asset: Omit<AbilityAsset, 'id' | 'created_at' | 'usage_count' | 'last_used'>): AbilityAsset {
    const assets = this.load();
    const newAsset: AbilityAsset = {
      ...asset,
      id: `a_${asset.type}_${uuidv4()}`,
      created_at: new Date().toISOString(),
      usage_count: 0,
      last_used: '',
    };

    const type = asset.type as keyof AssetsData;
    assets[type].push(newAsset);
    this.save(assets);
    return newAsset;
  }

  /**
   * 从对话中提取资产（由 F08 静默分析调用）
   */
  async extractAssets(conversation: string, existingTitles: string[]): Promise<AbilityAsset[]> {
    const prompt = `分析以下对话，判断是否有值得沉淀的能力资产。

对话内容：
${conversation}

已有资产标题列表（避免重复）：
${JSON.stringify(existingTitles)}

资产类型定义：
- frameworks：思维框架、分析方法（可复用的思考方式）
- lessons：经验教训（踩坑或成功的原因总结）
- sops：执行手册（做某件事的标准步骤）
- insights：认知升级（新的理解和洞察）
- resources：资源发现（人脉、工具、渠道、信息源）

要求：
- 只提取真正有复用价值的内容
- 不要为了输出而强行提取
- title 不超过 15 字
- content 不超过 100 字
- 跟已有资产重复的不要提取

输出 JSON 数组：
[
  {
    "type": "frameworks/lessons/sops/insights/resources",
    "title": "标题",
    "content": "内容",
    "tags": ["标签 1", "标签 2"]
  }
]
没有值得提取的输出空数组 []`;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: '你是一个知识管理专家，擅长从对话中提取有价值的知识资产。' },
        { role: 'user', content: prompt },
      ];

      const response = await this.aiService.chat(messages, { maxTokens: 800 });
      const jsonStr = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(jsonStr) as Array<Omit<AbilityAsset, 'id' | 'created_at' | 'usage_count' | 'last_used'>>;

      // 保存到对应类别
      const newAssets: AbilityAsset[] = [];
      extracted.forEach(item => {
        const asset = this.add(item);
        newAssets.push(asset);
      });

      return newAssets;
    } catch (error) {
      console.error('[AbilityAsset] 提取资产失败:', error);
      return [];
    }
  }

  /**
   * 检索相关资产（注入 AI 上下文）
   */
  search(keywords: string[], limit: number = 3): AbilityAsset[] {
    const assets = this.load();
    const allAssets = Object.values(assets).flat();

    // 匹配
    const matched = allAssets.filter(a => {
      const tagMatch = a.tags.some(t => keywords.some(k => t.includes(k) || k.includes(t)));
      const titleMatch = keywords.some(k => a.title.includes(k));
      const contentMatch = keywords.some(k => a.content.includes(k));
      return tagMatch || titleMatch || contentMatch;
    });

    // 排序：usage_count 高的优先
    matched.sort((a, b) => b.usage_count - a.usage_count);

    // 取前 N 条，更新 usage_count
    const top = matched.slice(0, limit);
    const now = new Date().toISOString();
    top.forEach(a => {
      a.usage_count += 1;
      a.last_used = now;
    });

    if (top.length > 0) {
      this.save(assets);
    }

    return top;
  }

  /**
   * 格式化资产为文本（注入 system prompt）
   */
  formatForPrompt(assets: AbilityAsset[]): string {
    if (assets.length === 0) return '';

    const typeMap: Record<AssetType, string> = {
      frameworks: '框架',
      lessons: '教训',
      sops: '流程',
      insights: '洞察',
      resources: '资源',
    };

    return '## 相关能力资产\n' + assets.map(a =>
      `- [${typeMap[a.type]}] ${a.title}：${a.content}`
    ).join('\n');
  }

  /**
   * 手动保存资产（通过命令）
   */
  manualSave(type: string, content: string): AbilityAsset {
    const typeMap: Record<string, AssetType> = {
      '教训': 'lessons',
      '框架': 'frameworks',
      '流程': 'sops',
      '洞察': 'insights',
      '资源': 'resources',
    };

    const assetType = typeMap[type] || 'lessons';
    const title = content.slice(0, 15);

    return this.add({
      title,
      content,
      tags: [], // TODO: 可以用 jieba 提取关键词
      type: assetType,
      source_topic: '用户手动保存',
    });
  }

  /**
   * 获取资产摘要
   */
  getSummary(): string {
    const assets = this.load();
    const counts = {
      frameworks: assets.frameworks.length,
      lessons: assets.lessons.length,
      sops: assets.sops.length,
      insights: assets.insights.length,
      resources: assets.resources.length,
    };
    return `能力资产：${Object.values(counts).reduce((a, b) => a + b, 0)} 条`;
  }
}
