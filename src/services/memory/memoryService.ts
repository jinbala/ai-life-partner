/**
 * 记忆服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { MemoryRepository, CreateMemoryInput } from '../../database/repositories';

export type MemoryType = 'fact' | 'lesson' | 'preference' | 'event' | 'decision' | 'relationship';

export interface Memory {
  id: string;
  createdAt: string;
  type: MemoryType;
  content: string;
  importance: number;
  recallCount: number;
  expiresAt: string | null;
}

/**
 * 记忆服务
 */
export class MemoryService {
  private repository: MemoryRepository;
  private userId: string;
  private cache: Memory[] | null = null;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new MemoryRepository();
  }

  /**
   * 加载所有记忆
   */
  async loadAll(): Promise<Memory[]> {
    if (this.cache) {
      return this.cache;
    }
    const records = await this.repository.findByUser(this.userId);
    this.cache = records.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      type: r.type,
      content: r.content,
      importance: r.importance,
      recallCount: r.recall_count,
      expiresAt: r.expires_at,
    }));
    return this.cache;
  }

  /**
   * 添加记忆
   */
  async add(input: Omit<CreateMemoryInput, 'user_id'>): Promise<string> {
    const memory = await this.repository.create({ ...input, user_id: this.userId });
    this.cache = null;
    return memory.id;
  }

  /**
   * 检索相关记忆
   */
  async search(keywords: string[], limit: number = 5): Promise<Memory[]> {
    const records = await this.repository.search(this.userId, keywords);
    const top = records.slice(0, limit);

    // 更新召回次数
    for (const m of top) {
      await this.repository.incrementRecall(m.id);
    }

    this.cache = null;
    return top.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      type: r.type,
      content: r.content,
      importance: r.importance,
      recallCount: r.recall_count,
      expiresAt: r.expires_at,
    }));
  }

  /**
   * 添加记忆（快捷方法）
   */
  async addMemory(type: MemoryType, content: string, importance?: number): Promise<string> {
    return await this.add({ type, content, importance: importance || 5 });
  }

  /**
   * 获取记忆摘要
   */
  async getSummary(): Promise<string> {
    const memories = await this.loadAll();
    if (memories.length === 0) return '暂无记忆';

    const byType: Record<string, number> = {};
    memories.forEach(m => {
      byType[m.type] = (byType[m.type] || 0) + 1;
    });

    return Object.entries(byType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(' | ');
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    this.cache = null;
    return await this.repository.delete(id);
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpired(): Promise<number> {
    return await this.repository.deleteExpired();
  }

  /**
   * 格式化记忆为文本
   */
  formatForPrompt(memories: Memory[]): string {
    if (memories.length === 0) return '';
    return '## 相关记忆\n' + memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }
}
