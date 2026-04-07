# AI 大脑 - 架构设计文档

## 项目概述

**定位**：用第一性原理驱动的进化式人生助手**核心价值**：不是聊天机器人，是用户的外置大脑/人生合伙人**设计原则**：

- 回归本质：任何问题先问"最底层的逻辑是什么"
- 拒绝惯性：不接受"别人都这么做"作为理由
- 行动导向：每次回复都指向具体行动
- 进化目标：让用户越来越强，最终不再需要你

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 飞书机器人   │  │  Web 聊天界面 │  │  WebSocket 客户端  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Express Server + Middleware (Auth/Logging/RequestID)   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ UserService │  │SessionService│  │  AIService         │ │
│  │             │  │             │  │  (LLM 抽象层)      │ │
│  │ - Portrait  │  │ - 会话管理   │  │  - 多提供商支持     │ │
│  │ - Goals     │  │ - 持久化     │  │  - 温度控制 0.1     │ │
│  │ - Memories  │  │ - 上下文追踪 │  │  - 防幻觉校验       │ │
│  │ - Assets    │  └─────────────┘  └─────────────────────┘ │
│  │ - Decisions │                                             │
│  │ - Challenges│  ┌─────────────┐  ┌─────────────────────┐ │
│  │ - Reviews   │  │SchedulerSvc │  │  WebSocketService  │ │
│  └─────────────┘  │ - Cron 定时  │  │  - 实时通信         │ │
│                   │ - 早 8 点推送   │  │  - 心跳检测         │ │
│                   │ - 晚 9 点复盘   │  │  - 广播/单播        │ │
│                   └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Repository Layer                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  SQLite Database (better-sqlite3)                      ││
│  │                                                         ││
│  │  ┌──────────────────────────────────────────────────┐  ││
│  │  │ Repositories:                                    │  ││
│  │  │ - UserRepository    - PortraitRepository        │  ││
│  │  │ - GoalRepository    - DailyTaskRepository       │  ││
│  │  │ - MemoryRepository  - AbilityAssetRepository    │  ││
│  │  │ - DecisionRepository- ChallengeRepository       │  ││
│  │  │ - ReviewRepository  - SessionRepository         │  ││
│  │  └──────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  SQLite DB  │  │  日志系统    │  │   配置验证 (Zod)    │ │
│  │  (单文件)   │  │ - 文件轮转   │  │   - 启动时校验      │ │
│  │             │  │ - 30 天保留   │  │   - 类型安全        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心模块设计

### 1. Service 层职责划分

```typescript
// UserService - 综合服务入口
class UserService {
  portrait: PortraitService;      // 用户画像管理
  goals: GoalService;             // 目标/任务管理
  memories: MemoryService;        // 长期记忆
  assets: AbilityAssetService;    // 能力资产
  decisions: DecisionFeedbackService;  // 决策反馈
  challenges: CognitionChallengeService; // 认知挑战
  reviews: ReviewService;         // 复盘管理
}

// SessionService - 会话状态管理
class SessionService {
  getOrCreate(userId: string): SessionData;
  addMessage(userId: string, role: 'user'|'assistant', content: string): void;
  update(userId: string, fields: Partial<SessionData>): void;
  // 会话持久化到 SQLite，重启不丢失
}

// AIService - LLM 抽象层
class AIService {
  chat(messages: ChatMessage[], options: { temperature: 0.1 }): Promise<AIResponse>;
  quickReply(message: string): Promise<string>;           // 日常对话
  decisionAnalysis(topic: string): Promise<string>;       // 决策分析
  quickDecision(situation: string): Promise<string>;      // 紧急决策
  // 支持 8 种模型提供商，统一接口
}
```

### 2. Repository 模式

```typescript
// 统一接口设计
interface Repository<T> {
  findById(id: string): T | null;
  findByUser(userId: string): T[];
  create(input: CreateInput): T;
  update(id: string, fields: Partial<T>): void;
  delete(id: string): boolean;
}

// 示例：GoalRepository
class GoalRepository {
  create(input: CreateGoalInput): Goal {
    const id = `goal_${Date.now()}_${random(6)}`;
    this.db.prepare(`INSERT INTO goals (...) VALUES (...)`).run(...);
    return this.findById(id)!;
  }

  findByUser(userId: string): Goal[] {
    return this.db.prepare(
      'SELECT * FROM goals WHERE user_id = ? ORDER BY level, created_at DESC'
    ).all(userId) as Goal[];
  }
}
```

### 3. 会话持久化设计

```typescript
// Session 数据结构
interface SessionData {
  id: string;
  userId: string;
  conversationHistory: Array<{ role: string; content: string }>;  // 最近 10 条
  currentFocus: string | null;          // 当前焦点（防漂移）
  hasPendingChallenge: boolean;         // 有待回答的挑战
  hasPendingDecisionReview: boolean;    // 有待复盘的决策
  pendingDecisionId: string | null;     // 待复盘决策 ID
}

// SQLite 表结构
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_history TEXT,           -- JSON 字符串
  current_focus TEXT,
  has_pending_challenge INTEGER DEFAULT 0,
  has_pending_decision_review INTEGER DEFAULT 0,
  pending_decision_id TEXT,
  last_active_at TEXT,
  created_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4. AI 防幻觉机制

```typescript
// 1. 输入校验器
class InputValidator {
  static validate(input: string, context: Context): ValidationResult {
    // 区分事实与观点
    const factIndicators = ['据说', '听说', '可能', '我觉得'];
    if (input.includes(factIndicator)) {
      questions.push('你说的这个是事实还是你的感受？');
    }

    // 检查信息完整度
    if (isDecision && !hasRiskInfo) {
      questions.push('这个决策的风险是什么？');
    }

    return { isValid, questions };
  }
}

// 2. System Prompt 约束
const systemPrompt = `
你是 AI 人生合伙人，用第一性原理驱动。
- 不接受"别人都这么做"作为理由
- 任何问题先回归本质
- 每次回复都指向具体行动
- 回复长度：日常对话<200 字，决策分析<500 字
`;

// 3. 低温保证一致性
aiService.chat(messages, { temperature: 0.1 });  // 低随机性
```

### 5. 定时任务设计

```typescript
class SchedulerService {
  private morningPushJob: ScheduledTask;      // 早 8:00
  private reviewReminderJob: ScheduledTask;   // 晚 9:00
  private dailySummaryJob: ScheduledTask;     // 晚 11:00
  private conversationCleanupJob: ScheduledTask; // 每周日 2:00

  start(): void {
    // 每天早上 8:00 发送推送
    this.morningPushJob = cron.schedule('0 8 * * *', () => {
      this.sendMorningPush();
    }, { timezone: 'Asia/Shanghai' });

    // 每天晚上 9:00 发送复盘提醒
    this.reviewReminderJob = cron.schedule('0 21 * * *', () => {
      this.sendReviewReminder();
    }, { timezone: 'Asia/Shanghai' });

    // 每天晚上 11:00 自动生成每日总结
    this.dailySummaryJob = cron.schedule('0 23 * * *', () => {
      this.generateDailySummary();
    }, { timezone: 'Asia/Shanghai' });

    // 每周日凌晨 2:00 清理 90 天前对话
    this.conversationCleanupJob = cron.schedule('0 2 * * 0', () => {
      this.cleanupOldConversations();
    }, { timezone: 'Asia/Shanghai' });
  }
}
```

**每日自动总结流程**：
1. 获取当日对话历史（ConversationHistoryRepository）
2. 获取当日完成任务（DailyTaskRepository）
3. 调用 AI 生成 200-300 字总结
4. 自动创建日记条目（ReviewRepository）
5. 用户可在日历中编辑或删除

**对话清理策略**：
- 保留 90 天内的详细对话
- 自动删除过期记录防止数据库膨胀
- 按用户分别清理

---

## 数据库设计

### 核心表结构

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  open_id TEXT UNIQUE NOT NULL,
  morning_push_enabled INTEGER DEFAULT 1,
  review_reminder_enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 用户画像表
CREATE TABLE user_portraits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  industry TEXT,
  income_structure TEXT,      -- JSON
  resources TEXT,             -- JSON
  decision_style TEXT DEFAULT 'intuitive',
  stuck_points TEXT,          -- JSON
  procrastination_triggers TEXT,  -- JSON
  abilities TEXT,             -- JSON
  growth_track TEXT,          -- JSON
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 目标表（树状结构）
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  level TEXT NOT NULL,        -- north_star/annual/monthly/weekly
  parent_id TEXT,             -- 父目标 ID
  description TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  success_signals TEXT,
  danger_signals TEXT,
  stop_loss_line TEXT,
  is_completed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_id) REFERENCES goals(id)
);

-- 决策记录表
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  essence TEXT,
  options TEXT,               -- JSON
  chosen TEXT NOT NULL,
  reason TEXT,
  expected_outcome TEXT,
  actual_outcome TEXT,
  deviation TEXT,
  lesson_learned TEXT,
  status TEXT DEFAULT 'pending',  -- pending/completed/reviewed
  verify_date TEXT,
  reminded INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')
);

-- 认知挑战表
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  related_ability TEXT,
  difficulty TEXT DEFAULT 'medium',
  user_answer TEXT,
  score INTEGER,
  evaluation TEXT,
  ability_adjustment INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')
);

-- 会话表（新增）
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_history TEXT,  -- JSON，最近 10 条
  current_focus TEXT,
  has_pending_challenge INTEGER DEFAULT 0,
  has_pending_decision_review INTEGER DEFAULT 0,
  pending_decision_id TEXT,
  last_active_at TEXT,
  created_at TEXT DEFAULT (datetime('now')
);
```

---

## 关键流程

### 1. 用户消息处理流程

```
用户消息
  │
  ▼
┌─────────────────────┐
│ 1. 检查是否为命令    │ ───► 执行命令处理器
└─────────────────────┘
  │ 否
  ▼
┌─────────────────────┐
│ 2. 检查挑战状态      │ ───► 评估答案 → 更新能力 → 返回
└─────────────────────┘
  │ 否
  ▼
┌─────────────────────┐
│ 3. 检查决策复盘      │ ───► 完成闭环 → 保存教训 → 返回
└─────────────────────┘
  │ 否
  ▼
┌─────────────────────┐
│ 4. 检查画像初始化    │ ───► 收集信息 → 更新画像 → 返回
└─────────────────────┘
  │ 否
  ▼
┌─────────────────────┐
│ 5. 检索相关记忆/资产 │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 6. 判断模式          │
│ - 紧急决策 (包含"急") │
│ - 决策分析 (包含"要不要")│
│ - 日常对话           │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 7. 调用 AI 服务       │
│ - System Prompt      │
│ - 用户画像           │
│ - 目标状态           │
│ - 相关记忆/资产       │
│ - 对话历史 (最近 10 条) │
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 8. 发送回复 + 保存历史│
└─────────────────────┘
  │
  ▼
┌─────────────────────┐
│ 9. 异步静默分析      │
│ - 记录新记忆         │
│ - 提取能力资产       │
│ - 更新用户画像       │
└─────────────────────┘
```

### 2. 认知挑战流程

```
触发条件：
- 检测到用户固有思维模式
- 用户主动要求/challenge-now
  │
  ▼
生成挑战问题（AI 生成）
  │
  ▼
保存到 challenges 表（status=pending）
  │
  ▼
发送给用户（飞书/Web）
  │
  ▼
等待用户回答
  │
  ▼
evaluateAnswer()
  │
  ├──► 计算分数（0-10）
  ├──► 生成评估反馈
  ├──► 更新能力分数
  ├──► 更新挑战状态（status=evaluated）
  └──► 保存教训到 assets
  │
  ▼
发送评估结果给用户
```

### 3. 决策闭环流程

```
创建决策
  │
  ▼
保存到 decisions 表（status=pending）
  │
  ▼
到达 verify_date
  │
  ▼
checkPendingDecisions()
  │
  ▼
发送复盘提醒
  │
  ▼
用户提供实际结果
  │
  ▼
closeDecisionLoop()
  │
  ├──► 计算偏差（预期 vs 实际）
  ├──► 提取经验教训
  ├──► 保存到 ability_assets（type=lesson）
  ├──► 更新画像（recordDecision）
  └──► 更新决策状态（status=reviewed）
  │
  ▼
发送复盘完成消息
```

---

## 文件结构

```
src/
├── api/                        # API 层
│   ├── middleware/             # 中间件
│   │   ├── auth.ts            # API Key/Session 认证
│   │   ├── logging.ts         # 请求日志
│   │   └── index.ts
│   └── routes/                 # 路由
│       ├── health.ts          # 健康检查
│       ├── chat.ts            # Web 聊天 API
│       ├── feishu.ts          # 飞书回调
│       └── index.ts
│
├── config/                     # 配置验证（新增）
│   ├── env.ts                 # Zod 环境变量验证
│   └── index.ts
│
├── database/                   # 数据库层
│   ├── index.ts               # 连接管理
│   ├── migrations.ts          # 版本迁移
│   └── repositories/          # Repository 层
│       ├── userRepository.ts
│       ├── portraitRepository.ts
│       ├── goalRepository.ts
│       ├── dailyTaskRepository.ts
│       ├── memoryRepository.ts
│       ├── abilityAssetRepository.ts
│       ├── decisionRepository.ts
│       ├── challengeRepository.ts
│       ├── reviewRepository.ts
│       ├── sessionRepository.ts
│       └── index.ts
│
├── services/                   # Service 层
│   ├── ai/                     # AI 服务
│   │   ├── aiService.ts       # LLM 调用
│   │   ├── aiPersona.ts       # 人格设定
│   │   └── index.ts
│   ├── user/                   # 用户服务
│   │   ├── userService.ts     # 综合服务
│   │   ├── portraitService.ts
│   │   ├── goalService.ts
│   │   └── index.ts
│   ├── memory/                 # 记忆服务
│   │   ├── memoryService.ts
│   │   └── index.ts
│   ├── assets/                 # 资产服务
│   │   ├── abilityAssetService.ts
│   │   └── index.ts
│   ├── growth/                 # 成长服务
│   │   ├── cognitionChallengeService.ts
│   │   ├── reviewService.ts
│   │   └── index.ts
│   ├── decision/               # 决策服务
│   │   ├── decisionFeedbackService.ts
│   │   └── index.ts
│   ├── scheduler/              # 定时任务（新增）
│   │   ├── schedulerService.ts
│   │   └── index.ts
│   ├── session/                # 会话管理（新增）
│   │   ├── sessionService.ts
│   │   └── index.ts
│   └── websocket/              # WebSocket（新增）
│       ├── websocketService.ts
│       └── index.ts
│
├── integrations/               # 第三方集成
│   └── feishu/                 # 飞书
│       ├── messageService.ts
│       └── index.ts
│
├── context/                    # 上下文管理
│   └── sessionManager.ts      # 内存会话（兼容旧版）
│
├── utils/                      # 工具
│   ├── logger.ts              # 日志系统
│   └── errors.ts              # 错误处理
│
├── types/                      # 类型定义
│   ├── portrait.ts
│   ├── goal.ts
│   └── index.ts
│
├── constants/                  # 常量配置
│   └── index.ts
│
├── server.ts                   # 主入口
└── server-old.ts               # 旧版入口（备份）
```

---

## 关键设计决策

### 1. 为什么选择 SQLite？

**考虑过的方案：**

- PostgreSQL（需要独立部署）
- MongoDB（过度复杂）
- JSON 文件（原方案，并发差）

**选择 SQLite 的原因：**

- 零配置部署，单文件
- 支持事务和 ACID
- 足够个人项目使用
- better-sqlite3 同步 API 简化代码
- WAL 模式支持中等并发

### 2. 为什么使用 Repository 模式？

**好处：**

- 业务逻辑与数据访问解耦
- 便于单元测试（Mock Repository）
- 未来可以轻松切换 ORM（如 Prisma）
- 统一的数据访问接口

### 3. 为什么温度设置为 0.1？

**考量：**

- 低温度保证输出一致性（防幻觉）
- 高温度会增加随机性，不适合决策建议
- 测试表明 0.1 在保持创造性的同时最稳定

### 4. 为什么限制对话历史为 10 条？

**考量：**

- Token 成本控制
- 最近上下文最相关
- 避免旧信息干扰
- 未来可扩展为摘要机制

### 5. 为什么异步处理静默分析？

**原因：**

- 不阻塞用户回复（低延迟）
- 静默分析不影响主流程
- 失败不影响用户体验
- 可以重试

---

## 性能优化

### 1. 数据库索引

```sql
CREATE INDEX idx_memories_user ON memories(user_id, type);
CREATE INDEX idx_goals_user ON goals(user_id, level);
CREATE INDEX idx_tasks_user ON daily_tasks(user_id, scheduled_date);
CREATE INDEX idx_assets_user ON ability_assets(user_id, type);
CREATE INDEX idx_decisions_user ON decisions(user_id, status);
CREATE INDEX idx_challenges_user ON challenges(user_id, status);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### 2. 缓存策略

```typescript
// Service 层内存缓存
class PortraitService {
  private cache: PortraitSummary | null = null;

  load(): PortraitSummary {
    if (this.cache) return this.cache;  // 命中缓存
    const record = this.repository.findOrCreate(this.userId);
    this.cache = this.parse(record);
    return this.cache;
  }

  save(portrait: PortraitSummary): void {
    this.repository.update(this.userId, portrait);
    this.cache = portrait;  // 更新缓存
  }
}
```

### 3. WAL 模式

```typescript
db.pragma('journal_mode = WAL');  // Write-Ahead Logging
// 好处：读写不阻塞，支持中等并发
```

---

## 监控与日志

### 日志级别

```typescript
logger.debug('调试信息', { detail });
logger.info('[Server] 服务已启动', { port: 3000 });
logger.warn('[AI] API 密钥未配置');
logger.error('[Database] 连接失败', error);
```

### 日志轮转

```typescript
// 每日凌晨自动轮转
function rotateLogFile() {
  const dateStr = new Date().toISOString().split('T')[0];
  if (dateStr !== currentDateString) {
    // 归档：app.log → app.2026-04-04.log
    fs.renameSync(logFilePath, archivedPath);
  }
}

// 清理 30 天前日志
function cleanupOldLogs(daysToKeep = 30) {
  // 删除过期日志文件
}
```

---

## 安全设计

### 1. API 认证

```typescript
// API Key 认证
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

// Session 认证
function requireSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.headers['x-session-id'];
  const session = sessionService.getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  next();
}
```

### 2. 速率限制

```typescript
function rateLimit(options?: { windowMs: number; maxRequests: number }) {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = options?.windowMs || 60000;
    const maxRequests = options?.maxRequests || 100;

    // 清理过期记录
    const ipRequests = requests.get(ip) || [];
    const validRequests = ipRequests.filter(t => now - t < windowMs);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    validRequests.push(now);
    requests.set(ip, validRequests);
    next();
  };
}
```

---

## 测试策略

### 单元测试

```typescript
// Repository 层测试
describe('GoalRepository', () => {
  let repo: GoalRepository;

  beforeEach(() => {
    repo = new GoalRepository();
  });

  test('should create goal', () => {
    const goal = repo.create({
      user_id: 'test-user',
      level: 'weekly',
      description: 'Test goal'
    });
    expect(goal.id).toBeDefined();
  });
});

// Service 层测试（Mock Repository）
describe('GoalService', () => {
  let service: GoalService;
  let mockRepo: MockGoalRepository;

  beforeEach(() => {
    mockRepo = new MockGoalRepository();
    service = new GoalService(mockRepo);
  });

  test('should get summary', async () => {
    const summary = await service.getSummary();
    expect(summary).toContain('目标');
  });
});
```

### 集成测试

```typescript
// API 端点测试
describe('POST /chat/message', () => {
  test('should return AI response', async () => {
    const response = await request(app)
      .post('/chat/message')
      .send({ sessionId: 'test', message: '你好' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.response).toBeDefined();
  });
});
```

---

## 扩展点设计

### 1. 多模态支持

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text' | 'image'; text?: string; image_url?: string }>;
}
```

### 2. 向量数据库集成

```typescript
// 未来扩展：长期记忆向量检索
class VectorMemoryService {
  async search(query: string, userId: string, limit: number = 5) {
    const embedding = await this.embed(query);
    const results = await this.vectorDB.search(embedding, userId, limit);
    return results;
  }
}
```

### 3. WebSocket 实时推送

```typescript
// 未来扩展：实时推送认知挑战
wsService.sendToUser(userId, {
  type: 'challenge',
  payload: { question: '新的认知挑战...' }
});
```

---

## 部署架构

```
┌─────────────────────────────────────────────┐
│              Single Server                  │
│  ┌───────────────────────────────────────┐  │
│  │  PM2 / Systemd (Process Manager)     │  │
│  │  ┌─────────────────────────────────┐ │  │
│  │  │  Node.js Process (server.ts)   │ │  │
│  │  │  ┌─────────┐  ┌─────────────┐  │ │  │
│  │  │  │ Express │  │  Services   │  │ │  │
│  │  │  └─────────┘  └─────────────┘  │ │  │
│  │  └─────────────────────────────────┘ │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  SQLite Database (data/app.db)       │  │
│  │  - WAL Mode                            │  │
│  │  - Daily Backup (cron)                 │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  Logs (logs/)                        │  │
│  │  - app.log (current)                  │  │
│  │  - app.YYYY-MM-DD.log (archived)      │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │
         │ HTTPS
         ▼
┌─────────────────┐
│  Nginx Reverse │
│     Proxy      │
└─────────────────┘
         ▲
         │
    ┌────┴────┐
    │  Users  │
    └─────────┘
```

---

## 版本历史


| 版本 | 日期       | 变更                                            |
| ---- | ---------- | ----------------------------------------------- |
| v1.0 | 2026-03-01 | 初始版本，JSON 文件存储                         |
| v2.0 | 2026-03-15 | 重构为模块化架构                                |
| v3.0 | 2026-04-04 | SQLite 迁移 + Service 层 + 定时任务 + WebSocket |
| v4.0 | 2026-04-07 | 日历日记 + 每日自动总结 + AI 任务检测 + 对话清理 |

---

## 贡献指南

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/jinbala/ai-life-partner.git
cd ai-life-partner

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

### 代码规范

- TypeScript 严格模式
- 所有公共方法必须有 JSDoc
- Repository 方法命名：`findXxx`, `create`, `update`, `delete`
- Service 方法命名：动词开头（`getSummary`, `addMessage`）
- 错误处理：使用 AppError 类，不要直接 throw Error

### 提交规范

```
feat: 添加新功能
fix: 修复 bug
refactor: 重构（不影响功能）
docs: 文档更新
test: 添加测试
chore: 构建/工具链变更
```
