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
  create(input: Omit<CreateReviewInput, 'user_id'>): string {
    const review = this.repository.create({ ...input, user_id: this.userId });
    return review.id;
  }

  /**
   * 获取所有复盘
   */
  getAll(): ReviewRecord[] {
    const reviews = this.repository.findByUser(this.userId);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 按类型获取复盘
   */
  getByType(type: ReviewType): ReviewRecord[] {
    const reviews = this.repository.findByType(this.userId, type);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 获取最近的复盘
   */
  getRecent(type: ReviewType, limit: number = 5): ReviewRecord[] {
    const reviews = this.repository.findRecent(this.userId, type, limit);
    return reviews.map(r => this.mapToReviewRecord(r));
  }

  /**
   * 获取复盘详情
   */
  getById(id: string): ReviewRecord | null {
    const review = this.repository.findById(id);
    return review ? this.mapToReviewRecord(review) : null;
  }

  /**
   * 删除复盘
   */
  delete(id: string): boolean {
    return this.repository.delete(id);
  }

  /**
   * 获取复盘摘要
   */
  getSummary(): string {
    const reviews = this.getAll();
    const daily = reviews.filter(r => r.type === 'daily').length;
    const weekly = reviews.filter(r => r.type === 'weekly').length;
    const monthly = reviews.filter(r => r.type === 'monthly').length;

    if (reviews.length === 0) return '暂无复盘记录';

    return `复盘记录：${reviews.length}条 | ` +
      `每日：${daily} | ` +
      `每周：${weekly} | ` +
      `每月：${monthly}`;
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
