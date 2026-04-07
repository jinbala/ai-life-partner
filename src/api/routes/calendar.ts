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
  const { content, mood } = req.body;

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
      // 创建新日记
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
          mood: mood || null,
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

/**
 * POST /api/calendar/generate/:date
 * AI 生成日记摘要
 */
router.post('/generate/:date', sessionAuth, async (req: Request, res: Response) => {
  const userId = req.userId;
  const date = req.params.date;

  try {
    const taskRepo = new DailyTaskRepository();
    const conversationRepo = new ConversationHistoryRepository();
    const { AIService } = await import('../../services/ai/aiService');
    const aiService = new AIService();

    // 获取当天任务
    const tasks = await taskRepo.findByDate(userId, String(date));
    const completedTasks = tasks.filter(t => t.is_completed === 1);

    // 获取当天对话
    const conversations = await conversationRepo.findByDate(userId, String(date));

    // 构建 AI 提示词
    const prompt = `请根据用户${date}这天的数据，生成一篇日记摘要（200-300 字）：

【完成的任务】
${completedTasks.length > 0 ? completedTasks.map(t => `- ${t.description}`).join('\n') : '无'}

【与 AI 的对话摘要】
${conversations.length > 0 ? conversations.slice(0, 5).map(c => `${c.role === 'user' ? '用户' : 'AI'}: ${c.content.substring(0, 50)}...`).join('\n') : '无'}

要求：
1. 以第一人称"我"来写
2. 语气温暖、积极向上
3. 突出今天的收获和成长
4. 如果没有数据和对话，就说"今天是平静的一天"，并鼓励用户记录生活`;

    const aiResponse = await aiService.chat([{ role: 'user', content: prompt }], {
      maxTokens: 500,
      temperature: 0.7,
    });

    res.json({
      success: true,
      data: {
        content: aiResponse.content,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('[Calendar] AI 生成日记失败', error);
    res.status(500).json({
      success: false,
      error: { message: 'AI 生成失败，请稍后重试' },
    });
  }
});

export { router as calendarRoutes };
