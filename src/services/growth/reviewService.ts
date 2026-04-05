/**
 * 复盘服务层
 * 基于数据库 Repository 封装业务逻辑
 */

import { ReviewRepository, CreateReviewInput } from '../../database/repositories';

export type ReviewType = 'daily' | 'weekly' | 'monthly';

export interface ReviewRecord {
  id: string;
  type: ReviewType;
  periodStart: string | null;
  periodEnd: string | null;
  content: string;
  createdAt: string;
}

/**
 * 复盘服务
 */
export class ReviewService {
  private repository: ReviewRepository;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.repository = new ReviewRepository();
  }

  /**
   * 创建复盘记录
   */
  async create(input: Omit<CreateReviewInput, 'user_id'>): Promise<string> {
    const review = await this.repository.create({ ...input, user_id: this.userId });
    return review.id;
  }

  /**
   * 获取所有复盘
   */
  async getAll(): Promise<ReviewRecord[]> {
    const reviews = await this.repository.findByUser(this.userId);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 按类型获取复盘
   */
  async getByType(type: ReviewType): Promise<ReviewRecord[]> {
    const reviews = await this.repository.findByType(this.userId, type);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 获取最近的复盘
   */
  async getRecent(type: ReviewType, limit: number = 5): Promise<ReviewRecord[]> {
    const reviews = await this.repository.findRecent(this.userId, type, limit);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 获取复盘详情
   */
  async getById(id: string): Promise<ReviewRecord | null> {
    const review = await this.repository.findById(id);
    return review ? this.mapToReviewRecord(review) : null;
  }

  /**
   * 删除复盘
   */
  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  /**
   * 获取复盘摘要
   */
  async getSummary(): Promise<string> {
    const reviews = await this.getAll();
    if (reviews.length === 0) return '暂无复盘记录';

    const byType: Record<string, number> = {};
    reviews.forEach(r => {
      byType[r.type] = (byType[r.type] || 0) + 1;
    });

    return `复盘记录：${reviews.length}条 | ` +
      `日报：${byType['daily'] || 0} | ` +
      `周报：${byType['weekly'] || 0} | ` +
      `月报：${byType['monthly'] || 0}`;
  }

  private mapToReviewRecord(r: any): ReviewRecord {
    return {
      id: r.id,
      type: r.type as ReviewType,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      content: r.content,
      createdAt: r.created_at,
    };
  }
}
