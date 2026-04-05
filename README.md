# AI 人生合伙人

> 一个用第一性原理驱动的、能跟你一起进化的外置大脑

## 系统定位

- **不是**聊天机器人，**不是**工具，是你的**合伙人**
- 会挑战你、质疑你、拉住你、逼你成长
- 终极目标：你自己越来越强，最终不再需要它

## ✨ 核心功能

### 对话系统
- 🖥️ **Web 聊天界面** - 浏览器直接对话，实时通信
- 📱 **飞书机器人** - 在飞书中随时沟通
- 🔌 **多模型支持** - Claude/GPT/DeepSeek/Kimi/Qwen 等

### 个人成长系统
- 🎯 **目标管理** - 北极星目标 → 年度 → 月度 → 周 → 日常任务
- 🧠 **决策分析** - 6 步决策框架 + 紧急决策模式
- 📝 **复盘系统** - 每日/每周/每月复盘
- 💎 **能力资产** - 框架/教训/SOP/洞察/资源积累
- 🔄 **决策闭环** - 预期 vs 实际结果追踪

### 智能进化系统
- 👤 **用户画像** - 自动学习和更新你的行为模式
- 🧠 **认知挑战** - 针对弱点生成两难问题
- ⚠️ **预警系统** - 检测偏离目标的行为
- 📊 **成长报告** - 月度/季度/半年度体检

### 定时推送
- ☀️ **早安推送** - 每日 8:00 发送任务和目标
- 🔔 **复盘提醒** - 提醒进行每日复盘

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 配置 API 密钥：

```bash
# AI 模型配置
AI_MODEL_PROVIDER=custom
CUSTOM_API_BASE_URL=https://api.aipaibox.com/v1
CUSTOM_API_MODEL=claude-sonnet-4-6
CUSTOM_API_KEY=sk-xxx

# 飞书应用配置（可选）
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_VERIFICATION_TOKEN=

# 服务器配置
PORT=3000
```

### 3. 启动服务

```bash
# 开发模式（推荐）
npm run dev

# 或构建后运行
npm run build
npm start
```

### 4. 访问聊天界面

打开浏览器访问：**http://localhost:3000/chat**

### 5. 健康检查

```bash
curl http://localhost:3000/health
```

## 项目结构

```
ai-life-partner/
├── src/
│   ├── api/                    # API 层
│   │   ├── routes/             # 路由控制器
│   │   │   ├── chat.ts         # 聊天接口
│   │   │   ├── feishu.ts       # 飞书 webhook
│   │   │   ├── health.ts       # 健康检查
│   │   │   └── visualization.ts # 数据可视化
│   │   └── middleware/         # Express 中间件
│   │       ├── auth.ts         # API 认证 + JWT
│   │       └── logging.ts      # 请求日志
│   │
│   ├── services/               # 业务服务层
│   │   ├── ai/                 # AI 服务
│   │   │   ├── aiService.ts    # 多模型调用
│   │   │   └── aiPersona.ts    # AI 人设提示词
│   │   ├── user/               # 用户服务
│   │   │   ├── portraitService.ts  # 用户画像
│   │   │   └── goalService.ts      # 目标管理
│   │   ├── memory/             # 记忆服务
│   │   │   └── memoryService.ts    # 长期记忆
│   │   ├── assets/             # 资产服务
│   │   │   └── abilityAssetService.ts # 能力资产
│   │   ├── decision/           # 决策服务
│   │   │   └── decisionFeedbackService.ts # 决策闭环
│   │   ├── growth/             # 成长服务
│   │   │   ├── cognitionChallengeService.ts  # 认知挑战
│   │   │   └── reviewService.ts  # 复盘系统
│   │   ├── scheduler/          # 定时任务
│   │   │   └── schedulerService.ts
│   │   └── export/             # 数据导出
│   │       └── dataExportService.ts
│   │
│   ├── database/               # 数据库层
│   │   ├── IDatabase.ts        # 数据库接口定义
│   │   ├── DatabaseFactory.ts  # 数据库工厂
│   │   ├── BaseRepository.ts   # Repository 基类
│   │   ├── index.ts            # 数据库连接
│   │   ├── migrations.ts       # 数据库迁移
│   │   ├── adapters/           # 数据库适配器
│   │   │   ├── SQLiteAdapter.ts
│   │   │   └── MySQLAdapter.ts
│   │   └── repositories/       # 数据仓库
│   │       ├── userRepository.ts
│   │       ├── portraitRepository.ts
│   │       ├── goalRepository.ts
│   │       ├── dailyTaskRepository.ts
│   │       ├── memoryRepository.ts
│   │       ├── abilityAssetRepository.ts
│   │       ├── decisionRepository.ts
│   │       ├── challengeRepository.ts
│   │       ├── reviewRepository.ts
│   │       ├── sessionRepository.ts
│   │       └── tokenUsageRepository.ts
│   │
│   ├── context/                # 上下文管理
│   │   └── sessionManager.ts   # 会话管理
│   │
│   ├── integrations/           # 第三方集成
│   │   └── feishu/             # 飞书机器人
│   │       └── messageService.ts
│   │
│   ├── constants/              # 常量配置
│   │   └── index.ts            # 系统提示词、配置常量
│   │
│   ├── utils/                  # 工具函数
│   │   ├── logger.ts           # 日志系统
│   │   ├── validators.ts       # 数据验证
│   │   └── errors.ts           # 错误处理
│   │
│   ├── types/                  # 类型定义
│   │   ├── portrait.ts
│   │   ├── goal.ts
│   │   └── index.ts
│   │
│   └── server.ts               # 主入口
│
├── data/                       # 数据存储
│   ├── app.db                  # SQLite 数据库
│   └── ...                     # 其他数据文件
│
├── public/                     # 静态文件
│   └── index.html              # Web 聊天界面
│
├── tests/                      # 测试
│   ├── unit/                   # 单元测试
│   └── integration/            # 集成测试
│
└── package.json
```

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.9
- **框架**: Express 4.x
- **数据库**: SQLite / MySQL 8.0+ (可切换)
- **AI**: 多模型支持（OpenAI / DeepSeek / Claude / Kimi / Qwen / ZhiPU / Ollama）
- **渠道**: 飞书机器人 + Web 聊天界面
- **部署**: 支持本地开发/云服务器/Docker

## 数据库

项目支持 **SQLite** 和 **MySQL** 双数据库，可通过环境变量切换：

### SQLite 模式（默认）

无需额外配置，数据存储在 `data/app.db`：

```bash
# .env 文件中不配置 DB_* 变量即使用 SQLite
NODE_ENV=development
```

### MySQL 模式

在 `.env` 中添加以下配置：

```bash
# 数据库配置
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_life_partner
```

### MySQL 一键配置（Windows）

以管理员身份运行 PowerShell 执行：

```powershell
.\scripts\setup-mysql.ps1
```

### Docker 方式运行 MySQL

```bash
docker run -d --name mysql-ai-life \
  -e MYSQL_ROOT_PASSWORD=root123456 \
  -e MYSQL_DATABASE=ai_life_partner \
  -p 3306:3306 \
  mysql:8.0
```

详见：[README.MySQL.md](README.MySQL.md)

## 使用方式

### Web 聊天

访问 http://localhost:3000/chat 直接使用浏览器对话。

### 飞书命令

```
/help          - 显示帮助
/goals         - 查看目标树
/tasks         - 查看今日任务
/add-task xxx  - 添加今日任务
/portrait      - 查看用户画像
/memories      - 查看长期记忆
/assets        - 查看能力资产
/decisions     - 查看决策历史
/challenge     - 查看认知挑战
/challenge-now - 立即生成挑战
/review        - 开始每日复盘
/morning-push on|off - 控制早上推送
/reset         - 重置会话
```

### 快捷用语

- `紧急` / `急` - 紧急决策模式
- `纠结` / `要不要` / `该不该` / `帮我分析` - 决策分析模式
- `复盘` - 开始每日复盘

## 开发命令

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 启动
npm start

# 类型检查
npm run typecheck

# 测试
npm test
npm run test:unit
npm run test:integration

# 清理
npm run clean
```

## 核心特性详解

### 1. 第一性原理决策

使用 6 步决策框架：
1. 本质问题（第一性原理）
2. 信息盘点（已知 + 缺失 + 通用知识标注）
3. 选项分析（代价/收益/可逆性/长期影响）
4. 初级建议 + 引导思考
5. 执行计划 + 预期结果
6. 止损线（什么情况说明选错了 + 备选方案）

### 2. 进化式用户画像

自动学习用户的：
- 行业和收入结构
- 技能和资源
- 决策风格
- 能力雷达（商业判断/执行力/认知力/风控/学习力）
- 成长轨迹

### 3. 长期记忆系统

6 种记忆类型：
- **fact** - 重要事实
- **lesson** - 经验教训
- **preference** - 用户偏好
- **event** - 关键事件
- **decision** - 重要决策
- **relationship** - 关系信息

### 4. 能力资产库

5 种资产类型：
- **framework** - 思考框架
- **lesson** - 经验教训
- **sop** - 标准流程
- **insight** - 洞察
- **resource** - 资源推荐

### 5. 认知挑战

针对用户最弱的能力维度，生成两难场景问题：
- 每周二/五自动生成
- 也可手动请求 `/challenge-now`
- 回答后 AI 评估并调整能力分数

### 6. 决策闭环

记录每个决策的预期结果，到期自动提醒复盘：
- 实际结果 vs 预期结果
- 偏差分析
- 经验提取为资产

### 7. 数据库架构

采用 Repository 模式，支持 SQLite/MySQL 双数据库：
- **IDatabase** - 统一数据库接口
- **DatabaseFactory** - 工厂模式创建适配器
- **BaseRepository** - 通用 CRUD 基类
- **SQLiteAdapter/MySQLAdapter** - 数据库适配器
- **getNowSql()** - 动态兼容时间函数

## 配置文件

详见：[MODEL_CONFIG.md](MODEL_CONFIG.md)

## 部署指南

详见：[DEPLOY.md](DEPLOY.md)

## 快速开始指南

详见：[QUICKSTART.md](QUICKSTART.md)

## 重构报告

详见：[REFACTORING_SUMMARY.md](REFACTORING_SUMMARY.md)

## 数据库优化

详见：[DATABASE_OPTIMIZATION.md](DATABASE_OPTIMIZATION.md)

## 开发路线图

### ✅ Phase 1 - 核心层（已完成）
- AI 人格和输入校验
- 进化式用户画像
- 目标管理和早推
- 飞书机器人框架
- Web 聊天界面
- 数据库集成

### 🔄 Phase 2 - 生长层（进行中）
- 决策引擎（6 步框架）✅
- 紧急决策快速通道 ✅
- 复盘系统（日/周/月）✅
- 能力资产库 ✅
- 预期 - 结果闭环 ✅
- 长期记忆系统 ✅

### ⏳ Phase 3 - 进化层（规划中）
- 预警系统
- 认知挑战（周二/周五）
- 元认知训练
- 环境变量提醒
- 战略止损线
- 体检报告（月/季/半年）

## 许可证

ISC

---

**最后更新**: 2026-04-05
