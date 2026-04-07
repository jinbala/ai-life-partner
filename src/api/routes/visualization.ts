/**
 * 数据可视化 API 路由
 * 提供能力雷达图、成长曲线、目标进度、决策分析等数据
 */

import { Router, Request, Response } from 'express';
import { UserRepository, PortraitRepository, GoalRepository, DailyTaskRepository, TokenUsageRepository, DecisionRepository, ReviewRepository, ConversationHistoryRepository } from '../../database/repositories';
import { logger } from '../../utils/logger';
import { sessionAuth } from '../middleware/auth';

const router = Router();

/**
 * 获取能力雷达图数据
 * GET /api/viz/ability-radar
 * 需要认证：Bearer Token
 */
router.get('/ability-radar', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const portraitRepo = new PortraitRepository();
    const portrait = await portraitRepo.findByUserId(userId as string);

    if (!portrait || !portrait.abilities) {
      res.json({
        success: true,
        data: {
          labels: ['商业判断力', '执行力', '认知水平', '风险控制', '学习能力'],
          values: [5, 5, 5, 5, 5],
          maxValue: 10,
        },
      });
      return;
    }

    const abilities = JSON.parse(portrait.abilities);
    const data = {
      labels: ['商业判断力', '执行力', '认知水平', '风险控制', '学习能力'],
      values: [
        abilities.businessJudgment,
        abilities.execution,
        abilities.cognition,
        abilities.riskControl,
        abilities.learningAbility,
      ],
      maxValue: 10,
    };

    res.json({ success: true, data });
  } catch (error) {
    logger.error('[Visualization] 获取能力雷达数据失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 获取能力成长曲线数据
 * GET /api/viz/ability-trend?days=30
 * 需要认证：Bearer Token
 */
router.get('/ability-trend', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { days } = req.query;
  const daysNum = days ? parseInt(days as string) : 90;

  try {
    const portraitRepo = new PortraitRepository();
    const portrait = await portraitRepo.findByUserId(userId as string);

    if (!portrait || !portrait.growth_track) {
      res.json({
        success: true,
        data: {
          labels: [],
          datasets: [],
        },
      });
      return;
    }

    const growthTrack = JSON.parse(portrait.growth_track);
    const abilityTrend = growthTrack.abilityTrend || [];

    // 过滤指定天数内的数据
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);

    const filteredTrend = abilityTrend.filter((item: any) => {
      const itemDate = new Date(item.date);
      return itemDate >= cutoffDate;
    });

    // 按日期分组
    const dateMap = new Map<string, Record<string, number>>();

    // 初始化当前能力值
    const abilities = JSON.parse(portrait.abilities);
    const currentAbilities = {
      businessJudgment: abilities.businessJudgment,
      execution: abilities.execution,
      cognition: abilities.cognition,
      riskControl: abilities.riskControl,
      learningAbility: abilities.learningAbility,
    };

    // 从后向前遍历，计算每个时间点的能力值
    const reversedTrend = [...filteredTrend].reverse();
    reversedTrend.forEach((item: any) => {
      const date = item.date.split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { ...currentAbilities });
      }
      // 更新能力值（向前回溯）
      const abilityKey = item.ability as string;
      if (currentAbilities[abilityKey as keyof typeof currentAbilities] !== undefined) {
        currentAbilities[abilityKey as keyof typeof currentAbilities] = item.oldValue;
      }
    });

    // 添加当前值
    const today = new Date().toISOString().split('T')[0];
    dateMap.set(today, currentAbilities);

    // 转换为图表数据
    const labels = Array.from(dateMap.keys()).sort();
    const datasets = [
      { label: '商业判断力', data: labels.map(date => dateMap.get(date)!.businessJudgment), borderColor: '#FF6384' },
      { label: '执行力', data: labels.map(date => dateMap.get(date)!.execution), borderColor: '#36A2EB' },
      { label: '认知水平', data: labels.map(date => dateMap.get(date)!.cognition), borderColor: '#FFCE56' },
      { label: '风险控制', data: labels.map(date => dateMap.get(date)!.riskControl), borderColor: '#4BC0C0' },
      { label: '学习能力', data: labels.map(date => dateMap.get(date)!.learningAbility), borderColor: '#9966FF' },
    ];

    res.json({
      success: true,
      data: { labels, datasets },
    });
  } catch (error) {
    logger.error('[Visualization] 获取能力成长曲线失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 获取目标进度数据
 * GET /api/viz/goal-progress
 * 需要认证：Bearer Token
 */
router.get('/goal-progress', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const goalRepo = new GoalRepository();
    const taskRepo = new DailyTaskRepository();
    const goals = await goalRepo.findByUser(userId as string);

    // 按级别分组
    const northStar = goals.find(g => g.level === 'north_star');
    const annual = goals.filter(g => g.level === 'annual');
    const monthly = goals.filter(g => g.level === 'monthly');
    const weekly = goals.filter(g => g.level === 'weekly');

    // 获取今日任务
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = await taskRepo.findByDate(userId as string, today);
    const completedTasks = todayTasks.filter(t => t.is_completed === 1).length;
    const taskProgress = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 100 : 0;

    const data = {
      northStar: northStar ? {
        description: northStar.description,
        progress: northStar.progress,
      } : null,
      annual: annual.map(g => ({
        id: g.id,
        description: g.description,
        progress: g.progress,
      })),
      monthly: monthly.map(g => ({
        id: g.id,
        description: g.description,
        progress: g.progress,
      })),
      weekly: weekly.map(g => ({
        id: g.id,
        description: g.description,
        progress: g.progress,
      })),
      todayTasks: {
        total: todayTasks.length,
        completed: completedTasks,
        progress: taskProgress,
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    logger.error('[Visualization] 获取目标进度失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 获取综合统计数据
 * GET /api/viz/dashboard
 * 需要认证：Bearer Token
 */
router.get('/dashboard', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const portraitRepo = new PortraitRepository();
    const goalRepo = new GoalRepository();
    const taskRepo = new DailyTaskRepository();
    const tokenUsageRepo = new TokenUsageRepository();

    const portrait = await portraitRepo.findByUserId(userId as string);
    const goals = await goalRepo.findByUser(userId as string);
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = await taskRepo.findByDate(userId as string, today);
    const tokenStats = await tokenUsageRepo.getTotalSummary(userId as string, 7);

    const abilities = portrait?.abilities ? JSON.parse(portrait.abilities) : {
      businessJudgment: 5,
      execution: 5,
      cognition: 5,
      riskControl: 5,
      learningAbility: 5,
    };
    const growthTrack = portrait?.growth_track ? JSON.parse(portrait.growth_track) : null;

    const data = {
      overview: {
        totalGoals: goals.length,
        todayTasks: todayTasks.length,
        completedTasks: todayTasks.filter(t => t.is_completed === 1).length,
        decisionStyle: portrait?.decision_style || 'intuitive',
      },
      abilities: {
        radar: {
          labels: ['商业判断力', '执行力', '认知水平', '风险控制', '学习能力'],
          values: [
            abilities.businessJudgment,
            abilities.execution,
            abilities.cognition,
            abilities.riskControl,
            abilities.learningAbility,
          ],
        },
        avgScore: (
          abilities.businessJudgment +
          abilities.execution +
          abilities.cognition +
          abilities.riskControl +
          abilities.learningAbility
        ) / 5,
      },
      growth: {
        totalDecisions: growthTrack?.decisionQuality?.length || 0,
        totalCognitionUpgrades: growthTrack?.cognitionUpgrades?.length || 0,
        totalAbilityChanges: growthTrack?.abilityTrend?.length || 0,
      },
      tokenUsage: {
        totalTokens: tokenStats.total_tokens,
        totalRequests: tokenStats.total_requests,
        estimatedCost: tokenStats.estimated_cost,
      },
    };

    res.json({ success: true, data });
  } catch (error) {
    logger.error('[Visualization] 获取综合统计数据失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/growth-summary
 * 获取成长轨迹摘要（画像进化服务）
 * 需要认证：Bearer Token
 */
router.get('/growth-summary', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const days = parseInt((req.query.days as string) || '30');

  try {
    const { UserService } = await import('../../services/user');
    const userServices = new UserService(userId);

    const summary = await userServices.getGrowthSummary(days);

    res.json({
      success: true,
      data: {
        userId,
        days,
        summary,
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取成长摘要失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/decision-stats
 * 获取决策统计数据（成功率、类型分布等）
 * 需要认证：Bearer Token
 */
router.get('/decision-stats', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const decisionRepo = new DecisionRepository();
    const decisions = await decisionRepo.findByUser(userId as string);

    // 按状态统计
    const total = decisions.length;
    const completed = decisions.filter(d => d.status === 'completed').length;
    const reviewed = decisions.filter(d => d.status === 'reviewed').length;
    const pending = decisions.filter(d => d.status === 'pending').length;

    // 计算成功率（预期结果匹配度）
    const successRate = completed > 0
      ? Math.round((completed / total) * 100)
      : 0;

    // 按选项类型分析
    const optionAnalysis: Record<string, number> = {};
    decisions.forEach(d => {
      if (d.chosen) {
        optionAnalysis[d.chosen] = (optionAnalysis[d.chosen] || 0) + 1;
      }
    });

    // 最近决策趋势（按月份）
    const monthlyTrend: Record<string, { total: number; success: number }> = {};
    decisions.forEach(d => {
      const month = d.created_at?.substring(0, 7) || 'unknown';
      if (!monthlyTrend[month]) {
        monthlyTrend[month] = { total: 0, success: 0 };
      }
      monthlyTrend[month].total++;
      if (d.status === 'completed' || d.status === 'reviewed') {
        monthlyTrend[month].success++;
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          total,
          completed,
          reviewed,
          pending,
          successRate,
        },
        optionDistribution: Object.entries(optionAnalysis).map(([name, count]) => ({
          name,
          value: count,
        })),
        trend: Object.entries(monthlyTrend).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
          month,
          total: data.total,
          success: data.success,
          rate: Math.round((data.success / data.total) * 100),
        })),
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取决策统计失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/task-completion-trend
 * 获取任务完成率趋势数据
 * 需要认证：Bearer Token
 */
router.get('/task-completion-trend', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { days } = req.query;
  const daysNum = days ? parseInt(days as string) : 30;

  try {
    const taskRepo = new DailyTaskRepository();
    const today = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(today.getDate() - daysNum);

    // 按日期分组统计
    const dailyStats: Record<string, { total: number; completed: number }> = {};

    // 初始化所有日期
    for (let d = new Date(cutoffDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyStats[dateStr] = { total: 0, completed: 0 };
    }

    // 获取所有任务（简化处理，实际应该按日期范围查询）
    const allTasks = await taskRepo.findByUser(userId as string);

    // 统计每天的任务
    allTasks.forEach(task => {
      const dateStr = task.scheduled_date?.split('T')[0];
      if (dateStr && dailyStats[dateStr]) {
        dailyStats[dateStr].total++;
        if (task.is_completed === 1) {
          dailyStats[dateStr].completed++;
        }
      }
    });

    // 转换为图表数据
    const labels = Object.keys(dailyStats).sort();
    const completionRates = labels.map(date => {
      const { total, completed } = dailyStats[date];
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    });
    const totalTasks = labels.map(date => dailyStats[date].total);
    const completedTasks = labels.map(date => dailyStats[date].completed);

    // 计算平均完成率
    const validDays = labels.filter(date => dailyStats[date].total > 0);
    const avgCompletionRate = validDays.length > 0
      ? Math.round(validDays.reduce((sum, date) => {
          const { total, completed } = dailyStats[date];
          return sum + (total > 0 ? (completed / total) * 100 : 0);
        }, 0) / validDays.length)
      : 0;

    res.json({
      success: true,
      data: {
        labels,
        datasets: [
          { label: '完成率 (%)', data: completionRates, borderColor: '#4BC0C0', backgroundColor: 'rgba(75, 192, 192, 0.1)', yAxisID: 'y1' },
          { label: '总任务数', data: totalTasks, borderColor: '#FF6384', backgroundColor: 'rgba(255, 99, 132, 0.1)', yAxisID: 'y2' },
          { label: '完成任务数', data: completedTasks, borderColor: '#36A2EB', backgroundColor: 'rgba(54, 162, 235, 0.1)', yAxisID: 'y2' },
        ],
        avgCompletionRate,
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取任务完成率失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/topic-analysis
 * 获取高频话题分析
 * 需要认证：Bearer Token
 */
router.get('/topic-analysis', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { days } = req.query;
  const daysNum = days ? parseInt(days as string) : 30;

  try {
    const convRepo = new ConversationHistoryRepository();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysNum);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 获取最近的对话
    const conversations = await convRepo.findRecent(userId as string, 500);

    // 过滤指定日期内的对话
    const filteredConv = conversations.filter(c => {
      const convDate = c.created_at?.split('T')[0];
      return convDate && convDate >= cutoffDateStr;
    });

    // 提取关键词（简单的中文词频统计）
    const chineseCharFreq = new Map<string, number>();
    filteredConv.forEach(c => {
      const chars = c.content.match(/[\u4e00-\u9fa5]/g) || [];
      chars.forEach(char => {
        // 忽略常见虚词
        if (!['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个'].includes(char)) {
          chineseCharFreq.set(char, (chineseCharFreq.get(char) || 0) + 1);
        }
      });
    });

    // 获取最高频的词
    const topKeywords = Array.from(chineseCharFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // 按日期统计对话数量
    const dailyConvCount: Record<string, number> = {};
    filteredConv.forEach(c => {
      const date = c.created_at?.split('T')[0];
      if (date) {
        dailyConvCount[date] = (dailyConvCount[date] || 0) + 1;
      }
    });

    // 对话数量趋势
    const trendLabels = Object.keys(dailyConvCount).sort();
    const trendData = trendLabels.map(date => dailyConvCount[date]);

    // 用户 vs AI 对话比例
    const userCount = filteredConv.filter(c => c.role === 'user').length;
    const assistantCount = filteredConv.filter(c => c.role === 'assistant').length;

    res.json({
      success: true,
      data: {
        topKeywords,
        conversationTrend: {
          labels: trendLabels,
          data: trendData,
        },
        roleDistribution: {
          user: userCount,
          assistant: assistantCount,
        },
        totalConversations: filteredConv.length,
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取话题分析失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/weekly-report
 * 获取周度报告数据
 * 需要认证：Bearer Token
 */
router.get('/weekly-report', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const taskRepo = new DailyTaskRepository();
    const decisionRepo = new DecisionRepository();
    const reviewRepo = new ReviewRepository();

    // 计算本周和上周的日期范围
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // 本周一
    const thisWeekMonday = new Date(today);
    thisWeekMonday.setDate(today.getDate() - mondayOffset);
    thisWeekMonday.setHours(0, 0, 0, 0);

    // 上周一
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);

    const thisWeekStart = thisWeekMonday.toISOString().split('T')[0];
    const lastWeekStart = lastWeekMonday.toISOString().split('T')[0];

    // 获取任务数据
    const allTasks = await taskRepo.findByUser(userId as string);

    const thisWeekTasks = allTasks.filter(t => t.scheduled_date >= thisWeekStart);
    const lastWeekTasks = allTasks.filter(t => t.scheduled_date >= lastWeekStart && t.scheduled_date < thisWeekStart);

    const thisWeekCompleted = thisWeekTasks.filter(t => t.is_completed === 1).length;
    const lastWeekCompleted = lastWeekTasks.filter(t => t.is_completed === 1).length;

    // 获取决策数据
    const allDecisions = await decisionRepo.findByUser(userId as string);

    const thisWeekDecisions = allDecisions.filter(d => d.created_at >= thisWeekStart);
    const lastWeekDecisions = allDecisions.filter(d => d.created_at >= lastWeekStart && d.created_at < thisWeekStart);

    // 获取复盘数据
    const allReviews = await reviewRepo.findByType(userId as string, 'daily');

    const thisWeekReviews = allReviews.filter(r => r.period_start >= thisWeekStart);
    const lastWeekReviews = allReviews.filter(r => r.period_start >= lastWeekStart && r.period_start < thisWeekStart);

    // 计算对比
    const taskComparison = {
      thisWeek: { total: thisWeekTasks.length, completed: thisWeekCompleted },
      lastWeek: { total: lastWeekTasks.length, completed: lastWeekCompleted },
      change: thisWeekTasks.length - lastWeekTasks.length,
      changeRate: lastWeekTasks.length > 0
        ? Math.round(((thisWeekTasks.length - lastWeekTasks.length) / lastWeekTasks.length) * 100)
        : 0,
    };

    const completionRateComparison = {
      thisWeek: thisWeekTasks.length > 0 ? Math.round((thisWeekCompleted / thisWeekTasks.length) * 100) : 0,
      lastWeek: lastWeekTasks.length > 0 ? Math.round((lastWeekCompleted / lastWeekTasks.length) * 100) : 0,
    };

    res.json({
      success: true,
      data: {
        period: {
          thisWeek: thisWeekStart,
          lastWeek: lastWeekStart,
        },
        tasks: taskComparison,
        completionRate: completionRateComparison,
        decisions: {
          thisWeek: thisWeekDecisions.length,
          lastWeek: lastWeekDecisions.length,
        },
        reviews: {
          thisWeek: thisWeekReviews.length,
          lastWeek: lastWeekReviews.length,
        },
        summary: {
          taskTrend: taskComparison.change > 0 ? '增加' : taskComparison.change < 0 ? '减少' : '持平',
          completionTrend: completionRateComparison.thisWeek > completionRateComparison.lastWeek ? '提升' : completionRateComparison.thisWeek < completionRateComparison.lastWeek ? '下降' : '持平',
        },
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取周度报告失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/viz/monthly-report
 * 获取月度报告数据
 * 需要认证：Bearer Token
 */
router.get('/monthly-report', sessionAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { month } = req.query; // 格式：YYYY-MM

  try {
    const taskRepo = new DailyTaskRepository();
    const decisionRepo = new DecisionRepository();
    const reviewRepo = new ReviewRepository();

    // 如果没有指定月份，默认为当前月
    const targetMonth = month ? month as string : new Date().toISOString().split('T')[0].substring(0, 7);
    const [year, monthNum] = targetMonth.split('-').map(Number);

    // 计算月份范围
    const monthStart = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNum, 0).getDate();
    const monthEnd = `${year}-${String(monthNum).padStart(2, '0')}-${lastDay}`;

    // 获取上月范围
    const lastMonthDate = new Date(year, monthNum - 2, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNum = lastMonthDate.getMonth() + 1;
    const lastMonthStart = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`;
    const lastMonthLastDay = new Date(lastMonthYear, lastMonthNum, 0).getDate();
    const lastMonthEnd = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${lastMonthLastDay}`;

    // 获取任务数据
    const allTasks = await taskRepo.findByUser(userId as string);

    const thisMonthTasks = allTasks.filter(t => t.scheduled_date >= monthStart && t.scheduled_date <= monthEnd);
    const lastMonthTasks = allTasks.filter(t => t.scheduled_date >= lastMonthStart && t.scheduled_date <= lastMonthEnd);

    const thisMonthCompleted = thisMonthTasks.filter(t => t.is_completed === 1).length;
    const lastMonthCompleted = lastMonthTasks.filter(t => t.is_completed === 1).length;

    // 获取决策数据
    const allDecisions = await decisionRepo.findByUser(userId as string);

    const thisMonthDecisions = allDecisions.filter(d => d.created_at >= monthStart && d.created_at <= monthEnd);
    const lastMonthDecisions = allDecisions.filter(d => d.created_at >= lastMonthStart && d.created_at <= lastMonthEnd);

    // 获取复盘数据
    const allReviews = await reviewRepo.findByType(userId as string, 'daily');

    const thisMonthReviews = allReviews.filter(r => r.period_start >= monthStart && r.period_start <= monthEnd);
    const lastMonthReviews = allReviews.filter(r => r.period_start >= lastMonthStart && r.period_start <= lastMonthEnd);

    // 按日期统计任务完成情况（用于趋势图）
    const dailyTaskStats: Record<string, { total: number; completed: number }> = {};
    for (let day = 1; day <= lastDay; day++) {
      const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dailyTaskStats[date] = { total: 0, completed: 0 };
    }

    thisMonthTasks.forEach(task => {
      const date = task.scheduled_date?.split('T')[0];
      if (date && dailyTaskStats[date]) {
        dailyTaskStats[date].total++;
        if (task.is_completed === 1) {
          dailyTaskStats[date].completed++;
        }
      }
    });

    const trendLabels = Object.keys(dailyTaskStats);
    const trendTotal = trendLabels.map(date => dailyTaskStats[date].total);
    const trendCompleted = trendLabels.map(date => dailyTaskStats[date].completed);

    res.json({
      success: true,
      data: {
        period: {
          month: targetMonth,
          days: lastDay,
        },
        tasks: {
          thisMonth: { total: thisMonthTasks.length, completed: thisMonthCompleted },
          lastMonth: { total: lastMonthTasks.length, completed: lastMonthCompleted },
          change: thisMonthTasks.length - lastMonthTasks.length,
          changeRate: lastMonthTasks.length > 0
            ? Math.round(((thisMonthTasks.length - lastMonthTasks.length) / lastMonthTasks.length) * 100)
            : 0,
          trend: {
            labels: trendLabels,
            total: trendTotal,
            completed: trendCompleted,
          },
        },
        decisions: {
          thisMonth: thisMonthDecisions.length,
          lastMonth: lastMonthDecisions.length,
          change: thisMonthDecisions.length - lastMonthDecisions.length,
        },
        reviews: {
          thisMonth: thisMonthReviews.length,
          lastMonth: lastMonthReviews.length,
          change: thisMonthReviews.length - lastMonthReviews.length,
        },
      },
    });
  } catch (error) {
    logger.error('[Visualization] 获取月度报告失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as visualizationRoutes };
