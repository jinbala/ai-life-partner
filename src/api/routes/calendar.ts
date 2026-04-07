/**
 * 日历日记 API 路由
 */

import { Router, Request, Response } from 'express';
import { sessionAuth } from '../middleware/auth';
import { ReviewRepository, DailyTaskRepository, ConversationHistoryRepository } from '../../database/repositories';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/calendar/entries
 * 获取指定年月的日记列表
 */
router.get('/entries', sessionAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const year = parseInt(req.query.year as string);
  const month = parseInt(req.query.month as string);

  try {
    const reviewRepo = new ReviewRepository();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const reviews = await reviewRepo.findByPeriod(userId, startDate, endDate);

    // 转换为日历条目格式
    const entries: Record<string, any> = {};
    for (const review of reviews) {
      if (review.type === 'daily') {
        entries[review.period_start || ''] = {
          id: review.id,
          date: review.period_start,
          content: review.content,
          summary: review.content?.substring(0, 50) + '...' || '',
          createdAt: review.created_at,
        };
      }
    }

    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error('[Calendar] 获取日记列表失败', error);
    res.status(500).json({
      success: false,
      error: { message: '获取日记列表失败' },
    });
  }
});

/**
 * GET /api/calendar/entry/:date
 * 获取指定日期的详细信息（日记 + 完成任务 + 对话摘要）
 */
router.get('/entry/:date', sessionAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const date = req.params.date;

  try {
    const reviewRepo = new ReviewRepository();
    const taskRepo = new DailyTaskRepository();
    const conversationRepo = new ConversationHistoryRepository();

    // 获取日记
    const reviews = await reviewRepo.findByType(userId, 'daily');
    const entry = reviews.find(r => r.period_start === date);

    // 获取当天完成的任务
    const tasks = await taskRepo.findByDate(userId, String(date));
    const completedTasks = tasks.filter(t => t.is_completed === 1);

    // 获取当天对话历史
    const conversations = await conversationRepo.findByDate(userId, String(date));

    res.json({
      success: true,
      data: {
        entry: entry ? {
          id: entry.id,
          date: entry.period_start,
          content: entry.content,
          summary: entry.content?.substring(0, 100) + '...' || '',
          createdAt: entry.created_at,
        } : null,
        completedTasks: completedTasks.map(t => ({
          id: t.id,
          description: t.description,
          completedAt: t.completed_at,
        })),
        conversations: conversations.slice(0, 20).map(c => ({
          role: c.role,
          content: c.content.substring(0, 200) + '...',
          createdAt: c.created_at,
        })),
      },
    });
  } catch (error) {
    logger.error('[Calendar] 获取日记详情失败', error);
    res.status(500).json({
      success: false,
      error: { message: '获取日记详情失败' },
    });
  }
});

/**
 * POST /api/calendar/entry/:date
 * 创建或更新日记
 */
router.post('/entry/:date', sessionAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const date = req.params.date;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: { message: '日记内容不能为空' },
    });
  }

  try {
    const reviewRepo = new ReviewRepository();
    const reviews = await reviewRepo.findByType(userId, 'daily');
    const existingEntry = reviews.find(r => r.period_start === date);

    let entry;
    if (existingEntry) {
      // 更新现有日记
      entry = await reviewRepo.update(existingEntry.id, content.trim());
    } else {
      // 创建新日记 - 使用 findById 查找已有的或者新建
      // 由于 create 方法会生成 id，我们需要先检查是否已存在
      const existingReviews = await reviewRepo.findByType(userId, 'daily');
      let existing = existingReviews.find(r => r.period_start === date);

      if (existing) {
        entry = await reviewRepo.update(existing.id, content.trim());
      } else {
        await reviewRepo.create({
          user_id: userId,
          type: 'daily',
          period_start: String(date),
          period_end: String(date),
          content: content.trim(),
        });
        // 重新获取
        const reviews = await reviewRepo.findByType(userId, 'daily');
        entry = reviews.find(r => r.period_start === date);
      }
    }

    res.json({
      success: true,
      data: {
        entry: {
          id: entry.id,
          date: entry.period_start,
          content: entry.content,
          summary: entry.content?.substring(0, 100) + '...' || '',
          createdAt: entry.created_at,
        },
      },
    });
  } catch (error) {
    logger.error('[Calendar] 保存日记失败', error);
    res.status(500).json({
      success: false,
      error: { message: '保存日记失败' },
    });
  }
});

/**
 * DELETE /api/calendar/entry/:date
 * 删除日记
 */
router.delete('/entry/:date', sessionAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const date = req.params.date;

  try {
    const reviewRepo = new ReviewRepository();
    const reviews = await reviewRepo.findByType(userId, 'daily');
    const entry = reviews.find(r => r.period_start === date);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: { message: '日记不存在' },
      });
    }

    await reviewRepo.delete(entry.id);

    res.json({ success: true });
  } catch (error) {
    logger.error('[Calendar] 删除日记失败', error);
    res.status(500).json({
      success: false,
      error: { message: '删除日记失败' },
    });
  }
});

export { router as calendarRoutes };
