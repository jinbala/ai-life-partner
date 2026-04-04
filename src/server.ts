import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { AIService, ChatMessage } from './core/aiService';
import { PortraitManager } from './core/portraitManager';
import { GoalManager } from './core/goalManager';
import { FeishuMessageService, FeishuSchedulerService } from './feishu/messageService';
import { InputValidator, generateSystemPrompt } from './core/aiPersona';

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
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  isInitializingPortrait: boolean;
  portraitQuestionsQueue: string[];
  currentFocus?: string;
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
    userSessions.set(userId, {
      portraitManager: new PortraitManager(userId),
      goalManager: new GoalManager(userId),
      conversationHistory: [],
      isInitializingPortrait: false,
      portraitQuestionsQueue: [],
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
  const { goalManager, portraitManager } = session;

  // 检查是否是命令
  if (content.startsWith('/')) {
    await handleCommand(userId, openId, content);
    return;
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

  // 构建对话历史
  session.conversationHistory.push({ role: 'user', content });
  if (session.conversationHistory.length > 10) {
    session.conversationHistory.shift();
  }

  // 检查是否紧急决策模式
  if (content.includes('急') || content.includes('紧急')) {
    const response = await aiService.quickDecision(content);
    await messageService.sendTextMessage(openId, response);
    return;
  }

  // 检查是否决策分析模式
  const decisionKeywords = ['要不要', '该不该', '帮我分析', '纠结', '选择'];
  const isDecisionMode = decisionKeywords.some(k => content.includes(k));

  if (isDecisionMode) {
    const response = await aiService.decisionAnalysis(content, portraitSummary);
    await messageService.sendTextMessage(openId, response);
    return;
  }

  // 日常对话模式
  const systemPrompt = generateSystemPrompt({
    currentFocus: session.currentFocus,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: `${systemPrompt}\n\n用户画像：${portraitSummary}\n目标状态：${goalSummary}` },
    ...session.conversationHistory.map(h => ({ role: h.role, content: h.content }) as ChatMessage),
  ];

  const response = await aiService.chat(messages, { maxTokens: 200 });

  await messageService.sendTextMessage(openId, response.content);
  session.conversationHistory.push({ role: 'assistant', content: response.content });
}

/**
 * 处理命令
 */
async function handleCommand(userId: string, openId: string, command: string) {
  const session = getUserSession(userId);
  const { goalManager, portraitManager } = session;

  const cmd = command.toLowerCase().trim();

  if (cmd === '/help') {
    await messageService.sendTextMessage(
      openId,
      `📖 命令列表：

/help - 显示帮助
/goals - 查看目标树
/tasks - 查看今日任务
/add-task <内容> - 添加今日任务
/portrait - 查看当前画像
/reset - 重置会话
/morning-push on|off - 控制早上推送
/review-reminder on|off - 控制复盘提醒

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
  } else if (cmd === '/reset') {
    session.conversationHistory = [];
    session.currentFocus = undefined;
    await messageService.sendTextMessage(openId, '✅ 会话已重置');
  } else if (cmd.includes('复盘')) {
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
