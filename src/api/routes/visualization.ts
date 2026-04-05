/**
 * 数据可视化 API 路由
 * 提供能力雷达图、成长曲线、目标进度等数据
 */

import { Router, Request, Response } from 'express';
import { UserRepository, PortraitRepository, GoalRepository, DailyTaskRepository, TokenUsageRepository } from '../../database/repositories';
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

export { router as visualizationRoutes };
