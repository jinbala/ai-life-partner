/**
 * AI 人生合伙人 - 服务器入口
 * 重构版本 - 使用服务层和 Repository 模式
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';

// 配置验证
import { validateEnv, validateAiConfig } from './config/env';

// 数据库
import { initializeDatabase, runMigrations, closeDatabase } from './database';

// 服务层
import { AIService, ChatMessage, generateSystemPrompt } from './services/ai';
import { UserService } from './services/user';
import { SessionService } from './services/session';
import { SchedulerService } from './services/scheduler';
import { WebSocketService } from './services/websocket';
import { FeishuMessageService } from './integrations/feishu';
import { DataExportService } from './services/export';

// 中间件
import { requestLogger, requestId } from './api/middleware';
import { healthRoutes, chatRoutes, feishuRoutes, visualizationRoutes, authRoutes, calendarRoutes } from './api/routes';

// Repository
import { DailyTaskRepository, ConversationHistoryRepository, ReviewRepository } from './database/repositories';

// 工具
import { logger, setLogFile, cleanupOldLogs } from './utils/logger';

// 环境变量验证和初始化
const config = validateEnv();

// 初始化日志系统
setLogFile();
cleanupOldLogs(30); // 保留 30 天

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = config.PORT;

// 应用中间件
const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400, // 24 小时
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(requestId);
app.use(requestLogger);

// 初始化数据库
initializeDatabase();
runMigrations();

// 静态文件服务（聊天页面）
app.use(express.static('public'));

// 聊天页面路由
app.get('/chat', (req: Request, res: Response) => {
  res.sendFile('index.html', { root: 'public' });
});

// 数据中心页面路由
app.get('/viz', (req: Request, res: Response) => {
  res.sendFile('viz.html', { root: 'public' });
});

// 日历日记页面路由
app.get('/calendar', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile('calendar.html', { root: 'public' });
});

// API 路由
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/chat/api', chatRoutes);
app.use('/feishu', feishuRoutes);
app.use('/api/viz', visualizationRoutes);
app.use('/api/calendar', calendarRoutes);

// 初始化服务
const aiService = new AIService();
const sessionService = new SessionService();
const feishuMessageService = new FeishuMessageService();
const schedulerService = new SchedulerService();
const wsService = new WebSocketService();
const dataExportService = new DataExportService();

// 验证 AI 配置
const aiConfigCheck = validateAiConfig(config);
if (!aiConfigCheck.valid) {
  logger.warn('[Server] AI 配置不完整', { error: aiConfigCheck.error });
}

// 测试接口 - 测试 AI 连接
app.post('/test-ai', async (req: Request, res: Response) => {
  const { message } = req.body || {};
  try {
    const response = await aiService.quickReply(message || '你好');
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 数据导出 API
app.get('/api/export/user/:userId', async (req: Request, res: Response) => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const { format } = req.query as { format?: string };

  try {
    const data = await dataExportService.exportUserData(userId);

    if (format === 'file') {
      const filePath = `data/exports/export_${userId}_${Date.now()}.json`;
      dataExportService.exportToFile(userId, filePath);
      res.json({ success: true, filePath });
    } else {
      res.json({ success: true, data });
    }
  } catch (error) {
    logger.error('[Server] 导出失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Token 使用统计 API
app.get('/api/token-usage', async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const userIdParam = query.userId;
  const daysParam = query.days;

  try {
    const stats = aiService.getTokenUsage(
      userIdParam || undefined,
      daysParam && !isNaN(parseInt(daysParam)) ? parseInt(daysParam) : undefined
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('[Server] 获取 Token 统计失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 处理用户消息
 */
async function handleUserMessage(
  userId: string,
  openId: string,
  content: string,
  messageId: string
) {
  const session = await sessionService.getOrCreate(userId);
  const userServices = new UserService(userId);

  // 检查是否是命令
  if (content.startsWith('/')) {
    await handleCommand(userId, openId, content, userServices, session);
    return;
  }

  // 检查是否在回答认知挑战
  const pendingChallenge = await userServices.challenges.getPendingChallenge();
  if (pendingChallenge || session.hasPendingChallenge) {
    session.hasPendingChallenge = true;
    await sessionService.update(userId, { hasPendingChallenge: true });

    if (pendingChallenge) {
      try {
        const portrait = await userServices.portrait.load();
        const result = await userServices.challenges.evaluateAnswer(
          pendingChallenge.id,
          content,
          portrait
        );

        // 更新能力分数
        if (result.ability_adjustment !== 0 && pendingChallenge.relatedAbility) {
          const p = await userServices.portrait.load();
          const dim = pendingChallenge.relatedAbility as keyof typeof p.abilities;
          if (p.abilities[dim] !== undefined) {
            p.abilities[dim] += result.ability_adjustment;
            p.abilities[dim] = Math.max(1, Math.min(10, p.abilities[dim]));
            await userServices.portrait.save(p);
          }
        }

        session.hasPendingChallenge = false;
        await sessionService.update(userId, { hasPendingChallenge: false });

        await feishuMessageService.sendTextMessage(
          openId,
          `🧠 认知挑战评估\n\n${result.evaluation}\n\n得分：${result.score}/10\n洞察：${result.insight}`
        );
        return;
      } catch (error) {
        logger.error('[Challenge] 评估失败', error);
      }
    }
  }

  // 检查是否在回答决策复盘
  const pendingDecisions = await userServices.decisions.checkPendingDecisions();
  if (pendingDecisions.length > 0 || session.hasPendingDecisionReview) {
    if (pendingDecisions.length > 0 && !session.hasPendingDecisionReview) {
      session.hasPendingDecisionReview = true;
      session.pendingDecisionId = pendingDecisions[0].id;
      await sessionService.update(userId, {
        hasPendingDecisionReview: true,
        pendingDecisionId: pendingDecisions[0].id,
      });

      const d = pendingDecisions[0];
      const verifyDate = d.verifyDate
        ? new Date(d.verifyDate).toLocaleDateString('zh-CN')
        : '之前';
      await feishuMessageService.sendTextMessage(
        openId,
        `⏰ 决策复盘提醒\n\n${verifyDate} 前你做了一个决策：\n话题：${d.topic}\n你的选择：${d.chosen}\n预期结果：${d.expectedOutcome}\n\n实际结果怎么样？直接告诉我。`
      );
    }

    if (session.hasPendingDecisionReview && session.pendingDecisionId) {
      try {
        const portrait = await userServices.portrait.load();
        const feedback = await userServices.decisions.closeDecisionLoop(
          session.pendingDecisionId,
          content,
          portrait,
          userServices.assets,
          userServices.memories
        );

        session.hasPendingDecisionReview = false;
        session.pendingDecisionId = null;
        await sessionService.update(userId, {
          hasPendingDecisionReview: false,
          pendingDecisionId: null,
        });

        await feishuMessageService.sendTextMessage(
          openId,
          `📊 决策复盘完成\n\n${feedback}`
        );
        return;
      } catch (error) {
        logger.error('[Decision] 闭环失败', error);
      }
    }
  }

  // 检查是否触发画像初始化
  const portrait = await userServices.portrait.load();
  if (!portrait.industry) {
    const { questions } = await userServices.portrait.initializeWithQuestions();
    if (questions.length > 0) {
      await sessionService.update(userId, { currentFocus: 'initializing_portrait' });

      await feishuMessageService.sendTextMessage(
        openId,
        '👋 你好，我是你的 AI 人生合伙人。\n\n在开始之前，我想先了解你一些基本情况，这样我的建议才能更贴合你的实际。\n\n我们开始吧：'
      );
      await feishuMessageService.sendTextMessage(openId, questions[0]);
      return;
    }
  }

  // 获取上下文
  const portraitSummary = await userServices.portrait.getSummary();
  const goalSummary = await userServices.goals.getSummary();
  const memorySummary = await userServices.memories.getSummary();
  const assetsSummary = await userServices.assets.getSummary();

  // 检索相关记忆和资产
  const keywords = extractKeywords(content);
  const relatedMemories = await userServices.memories.search(keywords);
  const relatedAssets = await userServices.assets.search(keywords);

  // 添加消息到历史
  await sessionService.addMessage(userId, 'user', content);

  // 检查是否紧急决策模式
  if (content.includes('急') || content.includes('紧急')) {
    const response = await aiService.quickDecision(content);
    await feishuMessageService.sendTextMessage(openId, response);
    await sessionService.addMessage(userId, 'assistant', response);
    return;
  }

  // 检查是否决策分析模式
  const decisionKeywords = ['要不要', '该不该', '帮我分析', '纠结', '选择'];
  const isDecisionMode = decisionKeywords.some(k => content.includes(k));

  if (isDecisionMode) {
    const response = await aiService.decisionAnalysis(content, portraitSummary);
    await feishuMessageService.sendTextMessage(openId, response);
    await sessionService.addMessage(userId, 'assistant', response);
    return;
  }

  // 日常对话模式
  const systemPrompt = generateSystemPrompt({
    currentFocus: session.currentFocus || undefined,
  });

  // 注入记忆和资产
  const memoriesText = userServices.memories.formatForPrompt(relatedMemories);
  const assetsText = userServices.assets.formatForPrompt(relatedAssets);
  const extraContext = [memoriesText, assetsText].filter(Boolean).join('\n\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt}\n\n用户画像：${portraitSummary}\n目标状态：${goalSummary}\n${extraContext ? extraContext + '\n' : ''}`,
    },
    ...session.conversationHistory.slice(-10).map((h) => ({
      role: h.role,
      content: h.content,
    })),
  ];

  const response = await aiService.chat(messages, { maxTokens: 200 });

  await feishuMessageService.sendTextMessage(openId, response.content);
  await sessionService.addMessage(userId, 'assistant', response.content);

  // 异步记录对话到历史表（用于日历显示）
  const today = new Date().toISOString().split('T')[0];
  const convRepo = new ConversationHistoryRepository();
  convRepo.add(userId, 'user', content).catch(err => logger.warn('记录对话失败', err));
  convRepo.add(userId, 'assistant', response.content).catch(err => logger.warn('记录对话失败', err));

  // AI 驱动的任务完成自动检测
  const taskRepo = new DailyTaskRepository();
  const todayTasks = await taskRepo.findByDate(userId, today);
  const pendingTasks = todayTasks.filter(t => t.is_completed === 0).map(t => ({
    id: t.id,
    description: t.description,
  }));

  if (pendingTasks.length > 0) {
    // 异步 AI 分析，不阻塞响应
    detectTaskCompletionAI(userId, content, pendingTasks, taskRepo, aiService, logger).catch(err => {
      logger.warn('[Server] AI 任务完成检测失败', { userId, error: err.message });
    });
  }

  // 异步分析对话并更新画像（每 5 次对话分析一次）
  const fullHistory = session.conversationHistory;
  if (fullHistory.length % 5 === 0) {
    userServices.evolution.analyzeAndUpdatePortrait(userId, fullHistory).then(result => {
      if (result.portraitUpdates.length > 0 || result.newMemories.length > 0) {
        logger.info('[Server] 画像进化分析完成', {
          userId,
          updates: result.portraitUpdates.length,
          newMemories: result.newMemories.length,
        });
      }
    }).catch(err => {
      logger.warn('[Server] 画像进化分析失败', { userId, error: err.message });
    });
  }
}

/**
 * 提取关键词
 */
function extractKeywords(text: string, limit: number = 10): string[] {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  const all = [...chineseChars, ...englishWords];
  const freq = new Map<string, number>();
  all.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([word]) => word);
}

/**
 * AI 驱动的任务完成检测
 * 分析用户消息，判断是否完成了某个任务
 */
async function detectTaskCompletionAI(
  userId: string,
  userMessage: string,
  pendingTasks: Array<{ id: string; description: string }>,
  taskRepo: DailyTaskRepository,
  aiService: AIService,
  logger: any
): Promise<void> {
  const tasksText = pendingTasks.map(t => `${t.id}. ${t.description}`).join('\n');

  const prompt = `请分析用户的消息是否表示完成了以下任务中的任何一个：

【待完成任务列表】
${tasksText}

【用户消息】
${userMessage}

请判断用户是否完成了某个任务，返回 JSON 格式：
{
  "completed": true/false,
  "task_id": "任务 ID（如果完成了任务）",
  "confidence": 0.0-1.0（置信度）,
  "reason": "判断理由"
}

只返回 JSON，不要其他内容。如果用户消息与任务完成无关，返回 {"completed": false}`;

  try {
    const response = await aiService.chat([
      { role: 'user', content: prompt },
    ], {
      maxTokens: 200,
      temperature: 0.1, // 低温保证输出格式稳定
    });

    // 解析 AI 响应
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.debug('[TaskDetection] AI 响应格式异常', { userId, response: response.content });
      return;
    }

    const result = JSON.parse(jsonMatch[0]);

    if (result.completed && result.task_id && result.confidence > 0.6) {
      const matchedTask = pendingTasks.find(t => t.id === result.task_id);
      if (matchedTask) {
        await taskRepo.markAsCompleted(result.task_id);
        logger.info('[Server] AI 自动标记任务完成', {
          userId,
          taskId: result.task_id,
          description: matchedTask.description,
          confidence: result.confidence,
          reason: result.reason,
        });
      }
    } else {
      logger.debug('[TaskDetection] 未检测到任务完成', {
        userId,
        completed: result.completed,
        confidence: result.confidence,
      });
    }
  } catch (error) {
    logger.warn('[TaskDetection] 分析失败', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 处理命令
 */
async function handleCommand(
  userId: string,
  openId: string,
  command: string,
  userServices: UserService,
  session: any
) {
  const cmd = command.toLowerCase().trim();
  const cmdRaw = command.trim();

  if (cmd === '/help') {
    await feishuMessageService.sendTextMessage(
      openId,
      `📖 命令列表：

【目标管理】
/goals - 查看目标树
/tasks - 查看今日任务
/add-task <内容> - 添加今日任务

【决策系统】
/decisions - 查看决策历史

【复盘系统】
/review - 开始每日复盘

【能力资产】
/assets - 查看能力资产

【认知挑战】
/challenge - 查看挑战进度
/challenge-now - 立即生成挑战

【系统】
/portrait - 查看用户画像
/memories - 查看长期记忆
/reset - 重置会话

快捷用语：
"紧急" - 紧急决策模式
"复盘" - 开始每日复盘`
    );
  } else if (cmd === '/goals') {
    const summary = await userServices.goals.getSummary();
    await feishuMessageService.sendTextMessage(openId, `📊 目标状态：\n\n${summary}`);
  } else if (cmd === '/tasks') {
    const tasks = await userServices.goals.getTodayTasks();
    if (tasks.length === 0) {
      await feishuMessageService.sendTextMessage(openId, '📝 今日暂无任务');
    } else {
      const text =
        '📝 今日任务：\n' +
        tasks
          .map(
            (t, i) => `${t.isCompleted ? '✅' : '⬜'} ${i + 1}. ${t.description}`
          )
          .join('\n');
      await feishuMessageService.sendTextMessage(openId, text);
    }
  } else if (cmdRaw.startsWith('/add-task ')) {
    const taskContent = command.substring('/add-task '.length);
    const today = new Date().toISOString().split('T')[0];
    await userServices.goals.createTask({ description: taskContent, scheduled_date: today });
    await feishuMessageService.sendTextMessage(
      openId,
      `✅ 已添加任务：${taskContent}`
    );
  } else if (cmd === '/portrait') {
    const p = await userServices.portrait.load();
    const radar = await userServices.portrait.getAbilityRadar();
    const text =
      `👤 用户画像：\n\n行业：${p.industry || '未设置'}\n` +
      `决策风格：${p.decisionStyle}\n` +
      `能力雷达：${JSON.stringify(radar, null, 2)}`;
    await feishuMessageService.sendTextMessage(openId, text);
  } else if (cmd === '/memories') {
    const memories = await userServices.memories.loadAll();
    if (memories.length === 0) {
      await feishuMessageService.sendTextMessage(openId, '💭 暂无长期记忆');
    } else {
      const text =
        `💭 长期记忆（${memories.length}条）：\n` +
        memories
          .slice(-10)
          .map((m) => `- [${m.type}] ${m.content}`)
          .join('\n');
      await feishuMessageService.sendTextMessage(openId, text);
    }
  } else if (cmd === '/assets') {
    const summary = await userServices.assets.getSummary();
    await feishuMessageService.sendTextMessage(openId, `💎 能力资产：${summary}`);
  } else if (cmd === '/challenge') {
    const summary = await userServices.challenges.getSummary();
    await feishuMessageService.sendTextMessage(
      openId,
      `🧠 ${summary}`
    );
  } else if (cmd === '/challenge-now') {
    try {
      const portrait = await userServices.portrait.load();
      const goals = [await userServices.goals.getSummary()];
      const recentTopics = session.conversationHistory
        .map((h: any) => h.content)
        .slice(-5);
      const recentChallenges = await userServices.challenges.getAll();
      await userServices.challenges.create({
        question: '这是一个认知挑战问题',
        option_a: '选项 A',
        option_b: '选项 B',
      });
      await feishuMessageService.sendTextMessage(
        openId,
        `🧠 认知挑战\n\n这是一个认知挑战问题\n\n请认真思考后回复。`
      );
    } catch (error) {
      await feishuMessageService.sendTextMessage(
        openId,
        '生成挑战失败，请稍后再试。'
      );
    }
  } else if (cmd === '/decisions') {
    const summary = await userServices.decisions.getSummary();
    await feishuMessageService.sendTextMessage(
      openId,
      `📊 ${summary}`
    );
  } else if (cmd === '/reset') {
    await sessionService.clear(userId);
    await feishuMessageService.sendTextMessage(openId, '✅ 会话已重置');
  } else if (cmdRaw.includes('复盘')) {
    await feishuMessageService.sendTextMessage(
      openId,
      `📝 每日复盘

1. 今天最重要的事完成了吗？
2. 卡在哪了？
3. 明天第一件事做什么？

直接回复就行，每个问题一句话。`
    );
  } else {
    await feishuMessageService.sendTextMessage(
      openId,
      `未知命令：${command}\n\n输入 /help 查看帮助`
    );
  }
}

/**
 * 飞书事件处理器
 */
app.post('/feishu/event', async (req: Request, res: Response) => {
  const event = req.body;

  // 处理 URL 验证
  if (event.type === 'url_verification') {
    res.send({ challenge: event.challenge });
    return;
  }

  // 处理接收到的消息
  if (event.type === 'im.message.receive_v1') {
    const parsed = feishuMessageService.parseReceivedMessage(event);
    if (!parsed) {
      res.status(400).send('解析消息失败');
      return;
    }

    // 忽略机器人自己的消息
    if (parsed.openId.startsWith('ou_')) {
      res.status(200).send('OK');
      return;
    }

    // 只处理文本消息
    if (parsed.messageType === 'text' && parsed.content.trim()) {
      // 异步处理，不阻塞响应
      handleUserMessage(parsed.openId, parsed.openId, parsed.content, parsed.messageId).catch(
        (err) => logger.error('处理消息失败', err)
      );
    }

    res.status(200).send('OK');
    return;
  }

  res.status(200).send('OK');
});

// 启动服务器
server.listen(PORT, () => {
  logger.info('[Server] 服务启动信息', {
    port: PORT,
    model: aiService.getModelInfo(),
    health: `GET http://localhost:${PORT}/health`,
    testAi: `POST http://localhost:${PORT}/test-ai`,
    chat: `http://localhost:${PORT}/chat`,
  });

  console.log(`🤖 AI 人生合伙人服务已启动，端口：${PORT}`);
  console.log(`📡 模型：${aiService.getModelInfo()}`);
  console.log(`🏥 健康检查：GET http://localhost:${PORT}/health`);
  console.log(`🧪 测试接口：POST http://localhost:${PORT}/test-ai`);
  console.log(`🖥️ 聊天界面：http://localhost:${PORT}/chat`);

  // 启动定时任务
  schedulerService.start();

  // 初始化 WebSocket（可选）
  // wsService.init(server);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('[Server] 收到 SIGTERM 信号，正在关闭...');
  schedulerService.stop();
  wsService.shutdown();
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[Server] 收到 SIGINT 信号，正在关闭...');
  schedulerService.stop();
  wsService.shutdown();
  closeDatabase();
  process.exit(0);
});

export default app;
