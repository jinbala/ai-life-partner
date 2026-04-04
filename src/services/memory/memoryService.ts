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
  loadAll(): Memory[] {
    if (this.cache) {
      return this.cache;
    }
    const records = this.repository.findByUser(this.userId);
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
  add(input: Omit<CreateMemoryInput, 'user_id'>): string {
    const memory = this.repository.create({ ...input, user_id: this.userId });
    this.cache = null;
    return memory.id;
  }

  /**
   * 检索相关记忆
   */
  search(keywords: string[], limit: number = 5): Memory[] {
    const records = this.repository.search(this.userId, keywords);
    const top = records.slice(0, limit);

    // 更新召回次数
    top.forEach(m => {
      this.repository.incrementRecall(m.id);
    });

    this.cache = null;
    return top.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      type: r.type,
      content: r.content,
      importance: r.importance,
      recallCount: r.recall_count + 1,
      expiresAt: r.expires_at,
    }));
  }

  /**
   * 格式化记忆为文本
   */
  formatForPrompt(memories: Memory[]): string {
    if (memories.length === 0) return '';

    const typeMap: Record<MemoryType, string> = {
      fact: '事实',
      lesson: '教训',
      preference: '偏好',
      event: '事件',
      decision: '决策',
      relationship: '关系',
    };

    return '## 相关记忆\n' + memories.map(m =>
      `- [${typeMap[m.type]}] ${m.content}`
    ).join('\n');
  }

  /**
   * 获取记忆摘要
   */
  getSummary(): string {
    const memories = this.loadAll();
    const recent = memories.slice(-5);
    if (recent.length === 0) return '暂无长期记忆';
    return `最近记忆：${recent.map(m => m.content.slice(0, 20)).join('；')}...`;
  }

  /**
   * 按类型获取记忆
   */
  getByType(type: MemoryType): Memory[] {
    const records = this.repository.findByType(this.userId, type);
    return records.map(r => ({
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
   * 更新记忆重要性
   */
  updateImportance(memoryId: string, importance: number): void {
    this.repository.updateImportance(memoryId, importance);
    this.cache = null;
  }

  /**
   * 删除记忆
   */
  delete(memoryId: string): boolean {
    this.cache = null;
    return this.repository.delete(memoryId);
  }

  /**
   * 清理过期记忆
   */
  cleanup(): number {
    const deleted = this.repository.deleteExpired();
    this.cache = null;
    return deleted;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache = null;
  }
}
