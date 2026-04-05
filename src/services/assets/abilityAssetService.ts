/**
 * 能力资产服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { AbilityAssetRepository, CreateAssetInput } from '../../database/repositories';

export type AssetType = 'framework' | 'lesson' | 'sop' | 'insight' | 'resource';

export interface AbilityAsset {
  id: string;
  type: AssetType;
  title: string;
  content: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
}

const TYPE_MAP: Record<AssetType, string> = {
  framework: '框架',
  lesson: '教训',
  sop: '流程',
  insight: '洞察',
  resource: '资源',
};

/**
 * 能力资产服务
 */
export class AbilityAssetService {
  private repository: AbilityAssetRepository;
  private userId: string;
  private cache: Map<AssetType, AbilityAsset[]> | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new AbilityAssetRepository();
  }

  /**
   * 加载所有资产
   */
  async load(): Promise<Record<AssetType, AbilityAsset[]>> {
    if (this.cache) {
      return {
        framework: this.cache.get('framework') || [],
        lesson: this.cache.get('lesson') || [],
        sop: this.cache.get('sop') || [],
        insight: this.cache.get('insight') || [],
        resource: this.cache.get('resource') || [],
      };
    }

    const records = await this.repository.findByUser(this.userId);
    const assets: Record<AssetType, AbilityAsset[]> = {
      framework: [],
      lesson: [],
      sop: [],
      insight: [],
      resource: [],
    };

    records.forEach(r => {
      const asset: AbilityAsset = {
        id: r.id,
        type: r.type as AssetType,
        title: r.title,
        content: r.content,
        tags: r.tags ? JSON.parse(r.tags) : [],
        usageCount: r.usage_count,
        createdAt: r.created_at,
      };
      assets[r.type as AssetType].push(asset);
    });

    this.cache = new Map<AssetType, AbilityAsset[]>([
      ['framework', assets.framework],
      ['lesson', assets.lesson],
      ['sop', assets.sop],
      ['insight', assets.insight],
      ['resource', assets.resource],
    ]);

    return assets;
  }

  /**
   * 手动保存资产
   */
  async manualSave(type: string, content: string): Promise<AbilityAsset> {
    const assetType = this.parseAssetType(type);
    if (!assetType) {
      throw new Error(`不支持的资产类型：${type}`);
    }

    const record = await this.repository.create({
      user_id: this.userId,
      type: assetType,
      title: content.slice(0, 50),
      content,
      tags: [],
    });

    this.cache = null;

    return {
      id: record.id,
      type: assetType,
      title: record.title,
      content: record.content,
      tags: record.tags ? JSON.parse(record.tags) : [],
      usageCount: record.usage_count,
      createdAt: record.created_at,
    };
  }

  /**
   * 搜索资产
   */
  async search(keywords: string[]): Promise<AbilityAsset[]> {
    const records = await this.repository.search(this.userId, keywords);
    return records.map(r => ({
      id: r.id,
      type: r.type as AssetType,
      title: r.title,
      content: r.content,
      tags: r.tags ? JSON.parse(r.tags) : [],
      usageCount: r.usage_count,
      createdAt: r.created_at,
    }));
  }

  /**
   * 格式化资产为文本
   */
  formatForPrompt(assets: AbilityAsset[]): string {
    if (assets.length === 0) return '';

    return '## 相关能力资产\n' + assets.map(a =>
      `- [${TYPE_MAP[a.type]}] ${a.title}: ${a.content.slice(0, 50)}...`
    ).join('\n');
  }

  /**
   * 获取资产摘要
   */
  async getSummary(): Promise<string> {
    const assets = await this.load();
    const total = Object.values(assets).flat().length;
    if (total === 0) return '暂无能力资产';

    return `框架：${assets.framework.length} | ` +
      `教训：${assets.lesson.length} | ` +
      `流程：${assets.sop.length} | ` +
      `洞察：${assets.insight.length} | ` +
      `资源：${assets.resource.length}`;
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(assetId: string): Promise<void> {
    await this.repository.incrementUsage(assetId);
    this.cache = null;
  }

  /**
   * 删除资产
   */
  async delete(assetId: string): Promise<boolean> {
    this.cache = null;
    return await this.repository.delete(assetId);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }

  private parseAssetType(type: string): AssetType | null {
    const map: Record<string, AssetType> = {
      '框架': 'framework',
      'lesson': 'lesson',
      '教训': 'lesson',
      'sop': 'sop',
      '流程': 'sop',
      'insight': 'insight',
      '洞察': 'insight',
      'resource': 'resource',
      '资源': 'resource',
      'framework': 'framework',
    };
    return map[type.toLowerCase()] || map[type] || null;
  }
}
