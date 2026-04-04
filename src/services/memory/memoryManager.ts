import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(__dirname, '../../data');
const MEMORIES_PATH = path.join(DATA_DIR, 'memories.json');
const ARCHIVE_PATH = path.join(DATA_DIR, 'archive', 'memories_archived.json');

export type MemoryType = 'fact' | 'lesson' | 'preference' | 'event' | 'decision' | 'relationship';
export type Importance = 'low' | 'medium' | 'high';

export interface Memory {
  id: string;
  date: string;
  type: MemoryType;
  content: string;
  tags: string[];
  related_goal?: string;
  importance: Importance;
  source: string;
  recall_count: number;
  last_recalled: string;
}

/**
 * 长期记忆管理器
 */
export class MemoryManager {
  constructor(private userId: string = 'default') {}

  private getMemoryPath(): string {
    return path.join(DATA_DIR, `memories_${this.userId}.json`);
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const archiveDir = path.join(DATA_DIR, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
  }

  /**
   * 加载所有记忆
   */
  loadAll(): Memory[] {
    const memoryPath = this.getMemoryPath();
    if (fs.existsSync(memoryPath)) {
      const data = fs.readFileSync(memoryPath, 'utf-8');
      return JSON.parse(data) as Memory[];
    }
    return [];
  }

  /**
   * 保存记忆列表
   */
  save(memories: Memory[]): void {
    this.ensureDataDir();
    fs.writeFileSync(this.getMemoryPath(), JSON.stringify(memories, null, 2));
  }

  /**
   * 添加新记忆
   */
  add(memory: Omit<Memory, 'id' | 'recall_count' | 'last_recalled'>): Memory {
    const memories = this.loadAll();
    const newMemory: Memory = {
      ...memory,
      id: `m_${uuidv4()}`,
      recall_count: 0,
      last_recalled: '',
    };
    memories.push(newMemory);
    this.save(memories);
    return newMemory;
  }

  /**
   * 检索相关记忆（用于注入 AI 上下文）
   */
  search(keywords: string[], limit: number = 5): Memory[] {
    const memories = this.loadAll();
    const now = new Date();

    // 匹配关键词
    const matched = memories.filter(m => {
      // tags 匹配
      const tagMatch = m.tags.some(t => keywords.some(k => t.includes(k) || k.includes(t)));
      // content 匹配
      const contentMatch = keywords.some(k => m.content.includes(k));
      return tagMatch || contentMatch;
    });

    // 排序：importance 优先，然后日期倒序
    const importanceOrder: Record<Importance, number> = { high: 3, medium: 2, low: 1 };
    matched.sort((a, b) => {
      const impDiff = importanceOrder[b.importance] - importanceOrder[a.importance];
      if (impDiff !== 0) return impDiff;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // 取前 N 条
    const top = matched.slice(0, limit);

    // 更新 recall_count
    top.forEach(m => {
      m.recall_count += 1;
      m.last_recalled = now.toISOString();
    });
    if (top.length > 0) {
      this.save(memories);
    }

    return top;
  }

  /**
   * 格式化记忆为文本（注入 system prompt）
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
   * 清理过期记忆（每月执行）
   */
  cleanup(): void {
    const memories = this.loadAll();
    const now = new Date();
    const toKeep: Memory[] = [];
    const toArchive: Memory[] = [];

    memories.forEach(m => {
      const daysOld = (now.getTime() - new Date(m.date).getTime()) / (1000 * 60 * 60 * 24);
      let shouldDelete = false;

      if (m.importance === 'low' && m.recall_count === 0 && daysOld > 90) {
        shouldDelete = true;
      } else if (m.importance === 'medium' && m.recall_count === 0 && daysOld > 180) {
        shouldDelete = true;
      }
      // high 永不自动删除

      if (shouldDelete) {
        toArchive.push(m);
      } else {
        toKeep.push(m);
      }
    });

    if (toArchive.length > 0) {
      // 备份到 archive
      this.ensureDataDir();
      const archived = this.loadArchived();
      archived.push(...toArchive);
      fs.writeFileSync(ARCHIVE_PATH, JSON.stringify(archived, null, 2));

      // 删除
      this.save(toKeep);
      console.log(`[Memory] 清理了 ${toArchive.length} 条过期记忆`);
    }
  }

  private loadArchived(): Memory[] {
    if (fs.existsSync(ARCHIVE_PATH)) {
      const data = fs.readFileSync(ARCHIVE_PATH, 'utf-8');
      return JSON.parse(data) as Memory[];
    }
    return [];
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
}
