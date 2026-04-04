import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { AIService, ChatMessage } from './core/aiService';
import { PortraitManager } from './core/portraitManager';
import { GoalManager } from './core/goalManager';
import { FeishuMessageService, FeishuSchedulerService } from './feishu/messageService';
import { InputValidator, generateSystemPrompt } from './core/aiPersona';
import { MemoryManager } from './core/memoryManager';
import { AbilityAssetManager } from './core/abilityAssetManager';
import { AutoReviewManager } from './core/autoReviewManager';
import { CognitionChallengeManager } from './core/cognitionChallenge';
import { DecisionFeedbackManager } from './core/decisionFeedback';
import { SilentAnalysisManager } from './core/silentAnalysisManager';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 飞书事件验证中间件
function verifyFeishuSignature(req: express.Request, res: express.Response, next: express.NextFunction) {
  const signature = req.headers['x-feishu-signature'] as string;
  const timestamp = req.headers['x-feishu-timestamp'] as string;
  const nonce = req.headers['x-feishu-nonce'] as string;
  const body = JSON.stringify(req.body);

  // 如果缺少签名头，跳过验证（兼容模式）
  if (!signature || !timestamp || !nonce) {
    next();
    return;
  }

  const verificationToken = process.env.FEISHU_VERIFICATION_TOKEN;
  if (!verificationToken) {
    next();
    return;
  }

  // 构建待签名字符串
  const stringToSign = timestamp + nonce + verificationToken + body;
  const computedSignature = crypto.createHash('sha256').update(stringToSign).digest('hex');

  if (computedSignature !== signature) {
    console.error('飞书签名验证失败');
    res.status(401).send('签名验证失败');
    return;
  }

  next();
}

app.use(express.json(), verifyFeishuSignature);

// 静态文件服务（聊天页面）
app.use(express.static('public'));

// 聊天页面路由
app.get('/chat', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// 初始化服务
const aiService = new AIService();
const messageService = new FeishuMessageService();
const schedulerService = new FeishuSchedulerService();

// 存储用户会话状态
interface UserSession {
  portraitManager: PortraitManager;
  goalManager: GoalManager;
  memoryManager: MemoryManager;
  assetsManager: AbilityAssetManager;
  autoReviewManager: AutoReviewManager;
  challengeManager: CognitionChallengeManager;
  decisionManager: DecisionFeedbackManager;
  silentAnalysis: SilentAnalysisManager;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  isInitializingPortrait: boolean;
  portraitQuestionsQueue: string[];
  currentFocus?: string;
  hasPendingChallenge: boolean;
  hasPendingDecisionReview: boolean;
  pendingDecisionId?: string;
}

const userSessions = new Map<string, UserSession>();

// 用户注册表（用于定时推送）
interface UserInfo {
  openId: string;
  registeredAt: string;
  morningPushEnabled: boolean;
  reviewReminderEnabled: boolean;
}

const userRegistry = new Map<string, UserInfo>();

/**
 * 保存用户注册表
 */
function saveUserRegistry() {
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dataDir, 'user-registry.json'),
    JSON.stringify(Array.from(userRegistry.entries()), null, 2)
  );
}

/**
 * 加载用户注册表
 */
function loadUserRegistry() {
  const fs = require('fs');
  const path = require('path');
  const dataPath = path.join(__dirname, '..', '..', 'data', 'user-registry.json');
  if (fs.existsSync(dataPath)) {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    data.forEach(([key, value]: [string, UserInfo]) => {
      userRegistry.set(key, value);
    });
  }
}

/**
 * 注册用户（用于定时推送）
 */
function registerUser(openId: string) {
  if (!userRegistry.has(openId)) {
    userRegistry.set(openId, {
      openId,
      registeredAt: new Date().toISOString(),
      morningPushEnabled: true,
      reviewReminderEnabled: true,
    });
    saveUserRegistry();
    console.log(`新用户注册：${openId}`);
  }
}

/**
 * 获取或创建用户会话
 */
function getUserSession(userId: string): UserSession {
  if (!userSessions.has(userId)) {
    const portraitManager = new PortraitManager(userId);
    const goalManager = new GoalManager(userId);
    const memoryManager = new MemoryManager(userId);
    const assetsManager = new AbilityAssetManager(userId);
    const autoReviewManager = new AutoReviewManager(userId);
    const challengeManager = new CognitionChallengeManager(userId);
    const decisionManager = new DecisionFeedbackManager(userId);
    const silentAnalysis = new SilentAnalysisManager(
      userId,
      portraitManager,
      goalManager,
      memoryManager,
      assetsManager,
      autoReviewManager
    );

    userSessions.set(userId, {
      portraitManager,
      goalManager,
      memoryManager,
      assetsManager,
      autoReviewManager,
      challengeManager,
      decisionManager,
      silentAnalysis,
      conversationHistory: [],
      isInitializingPortrait: false,
      portraitQuestionsQueue: [],
      hasPendingChallenge: false,
      hasPendingDecisionReview: false,
    });
  }
  return userSessions.get(userId)!;
}
async function handleUserMessage(
  userId: string,
  openId: string,
  content: string,
  messageId: string
) {
  // 注册用户（用于定时推送）
  registerUser(openId);

  const session = getUserSession(userId);
  const { goalManager, portraitManager, memoryManager, assetsManager, challengeManager, decisionManager, silentAnalysis } = session;

  // 检查是否是命令
  if (content.startsWith('/')) {
    await handleCommand(userId, openId, content);
    return;
  }

  // 优先级 1：回答认知挑战
  const pendingChallenge = challengeManager.getPendingChallenge();
  if (pendingChallenge && !session.hasPendingChallenge) {
    session.hasPendingChallenge = true;
  }
  if (session.hasPendingChallenge && pendingChallenge) {
    // 用户正在回答挑战
    try {
      const portrait = portraitManager.load();
      const result = await challengeManager.evaluateAnswer(pendingChallenge.id, content, portrait);

      // 更新能力分数
      if (result.ability_adjustment !== 0) {
        const p = portraitManager.load();
        const dim = pendingChallenge.related_ability as keyof typeof p.abilities;
        if (p.abilities[dim] !== undefined) {
          p.abilities[dim] += result.ability_adjustment;
          p.abilities[dim] = Math.max(1, Math.min(10, p.abilities[dim]));
          portraitManager.save(p);
        }
      }

      session.hasPendingChallenge = false;
      await messageService.sendTextMessage(openId, `🧠 认知挑战评估\n\n${result.evaluation}\n\n得分：${result.score}/10\n洞察：${result.insight}`);

      // 异步静默分析
      silentAnalysis.analyze(content).catch(e => console.error('[SilentAnalysis] 失败:', e));
      return;
    } catch (error) {
      console.error('[Challenge] 评估失败:', error);
    }
  }

  // 优先级 2：回答决策复盘
  const pendingDecisions = decisionManager.checkPendingDecisions();
  if (pendingDecisions.length > 0 && !session.hasPendingDecisionReview) {
    session.hasPendingDecisionReview = true;
    session.pendingDecisionId = pendingDecisions[0].id;
    // 发送提醒
    const d = pendingDecisions[0];
    const verifyDate = d.verify_date ? new Date(d.verify_date).toLocaleDateString('zh-CN') : '之前';
    await messageService.sendTextMessage(
      openId,
      `⏰ 决策复盘提醒\n\n${verifyDate} 前你做了一个决策：\n话题：${d.topic}\n你的选择：${d.chosen}\n预期结果：${d.expected_outcome}\n\n实际结果怎么样？直接告诉我。`
    );
  }
  if (session.hasPendingDecisionReview && session.pendingDecisionId) {
    try {
      const feedback = await decisionManager.closeDecisionLoop(
        session.pendingDecisionId,
        content,
        portraitManager,
        assetsManager,
        memoryManager
      );
      session.hasPendingDecisionReview = false;
      session.pendingDecisionId = undefined;
      await messageService.sendTextMessage(openId, `📊 决策复盘完成\n\n${feedback}`);

      // 异步静默分析
      silentAnalysis.analyze(content).catch(e => console.error('[SilentAnalysis] 失败:', e));
      return;
    } catch (error) {
      console.error('[Decision] 闭环失败:', error);
    }
  }

  // 检查是否在画像初始化流程中
  if (session.isInitializingPortrait && session.portraitQuestionsQueue.length > 0) {
    const currentQuestion = session.portraitQuestionsQueue[0];
    portraitManager.updateFromAnswer(currentQuestion, content);
    session.portraitQuestionsQueue.shift();

    if (session.portraitQuestionsQueue.length === 0) {
      session.isInitializingPortrait = false;
      await messageService.sendTextMessage(
        openId,
        '✅ 基本信息收集完成！现在我可以开始当你的合伙人了。\n\n随时跟我说你的想法、纠结、或者需要分析的事。'
      );
    } else {
      // 继续问下一个问题
      await messageService.sendTextMessage(
        openId,
        session.portraitQuestionsQueue[0]
      );
    }
    return;
  }

  // 检查是否触发画像初始化
  const portrait = portraitManager.load();
  if (!portrait.basics.industry) {
    session.isInitializingPortrait = true;
    const { questions } = await portraitManager.initializeWithQuestions();
    session.portraitQuestionsQueue = questions;

    await messageService.sendTextMessage(
      openId,
      '👋 你好，我是你的 AI 人生合伙人。\n\n在开始之前，我想先了解你一些基本情况，这样我的建议才能更贴合你的实际。\n\n我们开始吧：'
    );
    await messageService.sendTextMessage(openId, questions[0]);
    return;
  }

  // 获取用户上下文
  const portraitSummary = portraitManager.getSummary();
  const goalSummary = goalManager.getSummary();
  const memorySummary = memoryManager.getSummary();
  const assetsSummary = assetsManager.getSummary();

  // 检索相关记忆和资产
  const keywords = extractKeywords(content);
  const relatedMemories = memoryManager.search(keywords);
  const relatedAssets = assetsManager.search(keywords);

  // 构建对话历史
  session.conversationHistory.push({ role: 'user', content });
  if (session.conversationHistory.length > 10) {
    session.conversationHistory.shift();
  }

  // 检查是否紧急决策模式
  if (content.includes('急') || content.includes('紧急')) {
    const response = await aiService.quickDecision(content);
    await messageService.sendTextMessage(openId, response);
    // 异步静默分析
    silentAnalysis.analyze(content).catch(e => console.error('[SilentAnalysis] 失败:', e));
    return;
  }

  // 检查是否决策分析模式
  const decisionKeywords = ['要不要', '该不该', '帮我分析', '纠结', '选择'];
  const isDecisionMode = decisionKeywords.some(k => content.includes(k));

  if (isDecisionMode) {
    const response = await aiService.decisionAnalysis(content, portraitSummary);
    await messageService.sendTextMessage(openId, response);
    // 异步静默分析
    silentAnalysis.analyze(content).catch(e => console.error('[SilentAnalysis] 失败:', e));
    return;
  }

  // 日常对话模式
  const systemPrompt = generateSystemPrompt({
    currentFocus: session.currentFocus,
  });

  // 注入记忆和资产
  const memoriesText = memoryManager.formatForPrompt(relatedMemories);
  const assetsText = assetsManager.formatForPrompt(relatedAssets);
  const extraContext = [memoriesText, assetsText].filter(Boolean).join('\n\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: `${systemPrompt}\n\n用户画像：${portraitSummary}\n目标状态：${goalSummary}\n${extraContext ? extraContext + '\n' : ''}` },
    ...session.conversationHistory.map(h => ({ role: h.role, content: h.content }) as ChatMessage),
  ];

  const response = await aiService.chat(messages, { maxTokens: 200 });

  await messageService.sendTextMessage(openId, response.content);
  session.conversationHistory.push({ role: 'assistant', content: response.content });

  // 异步静默分析（不阻塞回复）
  silentAnalysis.analyze(content).catch(e => console.error('[SilentAnalysis] 失败:', e));
}

/**
 * 提取关键词（简化版中文分词）
 */
function extractKeywords(text: string, limit: number = 10): string[] {
  // 中文：按字符分割，过滤掉标点
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  // 英文：按空格分割
  const englishWords = text.match(/[a-zA-Z]+/g) || [];

  // 合并并去重
  const all = [...chineseChars, ...englishWords];
  const freq = new Map<string, number>();
  all.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));

  // 按频率排序
  const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, limit).map(([word]) => word);
}

/**
 * 处理命令
 */
async function handleCommand(userId: string, openId: string, command: string) {
  const session = getUserSession(userId);
  const { goalManager, portraitManager, memoryManager, assetsManager, challengeManager, decisionManager } = session;

  const cmd = command.toLowerCase().trim();
  const cmdRaw = command.trim(); // 保留原始大小写用于参数解析

  if (cmd === '/help') {
    await messageService.sendTextMessage(
      openId,
      `📖 命令列表：

【目标管理】
/goals - 查看目标树
/tasks - 查看今日任务
/add-task <内容> - 添加今日任务

【决策系统】
/decisions - 查看决策历史
/decision <id> - 查看决策详情

【复盘系统】
/review - 开始每日复盘
/reviews - 查看复盘历史

【能力资产】
/assets - 查看能力资产
/add-asset <类型> <内容> - 手动保存资产
类型：教训/框架/流程/洞察/资源

【认知挑战】
/challenge - 查看挑战进度
/challenge-now - 立即生成挑战

【系统】
/portrait - 查看用户画像
/memories - 查看长期记忆
/stats - 查看统计数据
/reset - 重置会话
/morning-push on|off - 控制早上推送

快捷用语：
"紧急" - 紧急决策模式
"复盘" - 开始每日复盘`
    );
  } else if (cmd === '/goals') {
    const summary = goalManager.getSummary();
    await messageService.sendTextMessage(openId, `📊 目标状态：\n\n${summary}`);
  } else if (cmd === '/tasks') {
    const tasks = goalManager.getTodayTasks();
    if (tasks.length === 0) {
      await messageService.sendTextMessage(openId, '📝 今日暂无任务');
    } else {
      const text = '📝 今日任务：\n' + tasks
        .map((t, i) => `${t.isCompleted ? '✅' : '⬜'} ${i + 1}. ${t.description}`)
        .join('\n');
      await messageService.sendTextMessage(openId, text);
    }
  } else if (cmd.startsWith('/add-task ')) {
    const taskContent = command.substring('/add-task '.length);
    const today = new Date().toISOString().split('T')[0];
    goalManager.addDailyTask(taskContent, today);
    await messageService.sendTextMessage(openId, `✅ 已添加任务：${taskContent}`);
  } else if (cmd === '/portrait') {
    const portrait = portraitManager.load();
    const text = `👤 用户画像：\n\n行业：${portrait.basics.industry || '未设置'}\n` +
      `决策风格：${portrait.behaviorPatterns.decisionStyle}\n` +
      `能力雷达：${JSON.stringify(portraitManager.getAbilityRadar(), null, 2)}`;
    await messageService.sendTextMessage(openId, text);
  } else if (cmd === '/memories') {
    const memories = memoryManager.loadAll();
    if (memories.length === 0) {
      await messageService.sendTextMessage(openId, '💭 暂无长期记忆');
    } else {
      const text = `💭 长期记忆（${memories.length}条）：\n` +
        memories.slice(-10).map(m => `- [${m.type}] ${m.content} (${m.recall_count}次)`).join('\n');
      await messageService.sendTextMessage(openId, text);
    }
  } else if (cmd === '/assets') {
    const assets = assetsManager.load();
    const total = Object.values(assets).flat().length;
    if (total === 0) {
      await messageService.sendTextMessage(openId, '💎 暂无能力资产');
    } else {
      const text = `💎 能力资产（${total}条）：\n` +
        `框架：${assets.frameworks.length} | ` +
        `教训：${assets.lessons.length} | ` +
        `流程：${assets.sops.length} | ` +
        `洞察：${assets.insights.length} | ` +
        `资源：${assets.resources.length}`;
      await messageService.sendTextMessage(openId, text);
    }
  } else if (cmdRaw.startsWith('/add-asset ')) {
    const args = command.substring('/add-asset '.length).split(' ');
    const type = args[0];
    const content = args.slice(1).join(' ');
    if (!content) {
      await messageService.sendTextMessage(openId, '用法：/add-asset <类型> <内容>\n类型：教训/框架/流程/洞察/资源');
      return;
    }
    const asset = assetsManager.manualSave(type, content);
    await messageService.sendTextMessage(openId, `✅ 已保存到 [${type}]：${asset.title}`);
  } else if (cmd === '/challenge') {
    await messageService.sendTextMessage(openId, `🧠 ${challengeManager.getSummary()}`);
  } else if (cmd === '/challenge-now') {
    try {
      const portrait = portraitManager.load();
      const goals = [goalManager.getSummary()];
      const recentTopics = session.conversationHistory.map(h => h.content).slice(-5);
      const recentChallenges = challengeManager.load();
      const challenge = await challengeManager.generateChallenge(portrait, goals, recentTopics, recentChallenges);
      await messageService.sendTextMessage(openId, `🧠 认知挑战\n\n${challenge.question}\n\n请认真思考后回复。`);
    } catch (error) {
      await messageService.sendTextMessage(openId, '生成挑战失败，请稍后再试。');
    }
  } else if (cmd === '/decisions') {
    await messageService.sendTextMessage(openId, `📊 ${decisionManager.getSummary()}`);
  } else if (cmd === '/reset') {
    session.conversationHistory = [];
    session.currentFocus = undefined;
    await messageService.sendTextMessage(openId, '✅ 会话已重置');
  } else if (cmdRaw.includes('复盘')) {
    await messageService.sendTextMessage(
      openId,
      `📝 每日复盘

1. 今天最重要的事完成了吗？
2. 卡在哪了？
3. 明天第一件事做什么？

直接回复就行，每个问题一句话。`
    );
  } else if (cmd.startsWith('/morning-push ')) {
    const action = command.substring('/morning-push '.length).trim().toLowerCase();
    const userInfo = userRegistry.get(userId);
    if (userInfo) {
      userInfo.morningPushEnabled = (action === 'on' || action === 'true' || action === '开启');
      saveUserRegistry();
      await messageService.sendTextMessage(openId, `✅ 早上推送已${userInfo.morningPushEnabled ? '开启' : '关闭'}`);
    }
  } else if (cmd.startsWith('/review-reminder ')) {
    const action = command.substring('/review-reminder '.length).trim().toLowerCase();
    const userInfo = userRegistry.get(userId);
    if (userInfo) {
      userInfo.reviewReminderEnabled = (action === 'on' || action === 'true' || action === '开启');
      saveUserRegistry();
      await messageService.sendTextMessage(openId, `✅ 复盘提醒已${userInfo.reviewReminderEnabled ? '开启' : '关闭'}`);
    }
  }
}

/**
 * 飞书事件处理器
 */
app.post('/feishu/event', express.json(), async (req, res) => {
  const event = req.body;

  // 处理 URL 验证
  if (event.type === 'url_verification') {
    res.send({ challenge: event.challenge });
    return;
  }

  // 处理接收到的消息
  if (event.type === 'im.message.receive_v1') {
    const parsed = messageService.parseReceivedMessage(event);
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
      handleUserMessage(parsed.openId, parsed.openId, parsed.content, parsed.messageId)
        .catch(err => console.error('处理消息失败:', err));
    }

    res.status(200).send('OK');
    return;
  }

  res.status(200).send('OK');
});

/**
 * 定时任务 - 早上推送（每天 8:00）
 */
function scheduleMorningPush() {
  const now = new Date();
  const nextPush = new Date(now);
  nextPush.setHours(8, 0, 0, 0);

  // 如果今天 8 点已过，设置为明天 8 点
  if (nextPush <= now) {
    nextPush.setDate(nextPush.getDate() + 1);
  }

  const delay = nextPush.getTime() - now.getTime();

  setTimeout(() => {
    sendMorningPushToAll();
    // 安排下一次的推送（24 小时后）
    setInterval(sendMorningPushToAll, 24 * 60 * 60 * 1000);
  }, delay);
}

/**
 * 向所有启用早上推送的用户发送消息
 */
async function sendMorningPushToAll() {
  console.log('开始发送早上推送...');

  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  for (const [userId, userInfo] of userRegistry.entries()) {
    if (!userInfo.morningPushEnabled) continue;

    try {
      const session = getUserSession(userId);
      const goalSummary = session.goalManager.getSummary();
      const tasks = session.goalManager.getTodayTasks();

      let content = `☀️ 早上好！${dateStr}\n\n`;

      if (tasks.length > 0) {
        content += `📋 今日任务：\n`;
        tasks.forEach((t, i) => {
          content += `${t.isCompleted ? '✅' : '⬜'} ${i + 1}. ${t.description}\n`;
        });
        content += '\n';
      }

      content += `💬 当前目标：${goalSummary || '暂无明确目标'}\n\n`;
      content += `今天有什么重要计划？随时跟我聊聊。`;

      await messageService.sendTextMessage(userInfo.openId, content);
      console.log(`早上推送已发送给 ${userId}`);
    } catch (error) {
      console.error(`发送早上推送失败 (${userId}):`, error);
    }
  }
}

// 启动服务器前添加一个简单的健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: aiService.getModelInfo() });
});

// 测试接口 - 用于测试 AI 连接
app.post('/test-ai', async (req, res) => {
  const { message } = req.body || {};
  try {
    const response = await aiService.quickReply(message || '你好');
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🤖 AI 人生合伙人服务已启动，端口：${PORT}`);
  console.log(`📡 模型：${aiService.getModelInfo()}`);
  console.log(`🏥 健康检查：GET http://localhost:${PORT}/health`);
  console.log(`🧪 测试接口：POST http://localhost:${PORT}/test-ai`);

  // 加载用户注册表
  loadUserRegistry();
  console.log(`👥 已加载 ${userRegistry.size} 个注册用户`);

  // 启动定时任务
  scheduleMorningPush();
});

export default app;
