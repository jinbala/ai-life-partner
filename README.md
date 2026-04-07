# AI 人生合伙人

> 一个用第一性原理驱动的、能跟你一起进化的外置大脑

## 系统定位

- **不是**聊天机器人，**不是**工具，是你的**合伙人**
- 会挑战你、质疑你、拉住你、逼你成长
- 终极目标：你自己越来越强，最终不再需要它

---

## ✨ 核心功能

### 对话系统
- 🖥️ **Web 聊天界面** - 浏览器实时对话
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
- 📊 **成长报告** - 月度/季度/半年度体检
- 🔄 **画像进化** - AI 自动分析对话，提取用户信息并更新画像（每 5 次对话）
- 📈 **能力成长曲线** - 追踪能力分数变化轨迹
- 💾 **自动记忆创建** - 从对话中提取重要事实创建长期记忆

### 自动化功能
- ☀️ **早安推送** - 每日 8:00 发送任务和目标
- 🔔 **复盘提醒** - 每晚 21:00 提醒复盘
- 📅 **日历日记** - 每日 23:00 自动生成当日总结
- 🧹 **对话清理** - 每周日凌晨 2:00 清理 90 天前对话
- ✅ **任务检测** - AI 自动识别用户是否完成任务

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# AI 模型配置（推荐 aipaibox.com 中转）
AI_MODEL_PROVIDER=custom
CUSTOM_API_BASE_URL=https://api.aipaibox.com/v1
CUSTOM_API_MODEL=claude-sonnet-4-6
CUSTOM_API_KEY=sk-xxx

# 服务器配置
PORT=3000
```

**支持的模型提供商**：
- `custom` - 自定义 OpenAI 兼容接口（推荐）
- `deepseek` - DeepSeek（性价比高）
- `claude` - Anthropic Claude
- `openai` - OpenAI GPT
- `moonshot` - 月之暗面 Kimi
- `qwen` - 通义千问
- `zhipu` - 智谱 GLM
- `ollama` - 本地 Ollama

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

---

## 📁 项目结构

```
ai-life-partner/
├── src/
│   ├── api/                    # API 层
│   │   ├── routes/             # 路由控制器
│   │   │   ├── chat.ts         # 聊天接口
│   │   │   ├── feishu.ts       # 飞书 webhook
│   │   │   ├── health.ts       # 健康检查
│   │   │   ├── calendar.ts     # 日历日记 API
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
│   │   │   ├── portraitEvolutionService.ts  # 画像进化
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
│   │   │   └── schedulerService.ts  # Cron 任务
│   │   └── export/             # 数据导出
│   │
│   ├── database/               # 数据库层
│   │   ├── index.ts            # 数据库连接
│   │   ├── migrations.ts       # 数据库迁移
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
│   │       ├── tokenUsageRepository.ts
│   │       └── conversationHistoryRepository.ts
│   │
│   ├── integrations/           # 第三方集成
│   │   └── feishu/             # 飞书机器人
│   │       └── messageService.ts
│   │
│   ├── context/                # 上下文管理
│   │   └── sessionManager.ts   # 会话管理
│   │
│   ├── utils/                  # 工具函数
│   │   ├── logger.ts           # 日志系统
│   │   ├── validators.ts       # 数据验证
│   │   └── errors.ts           # 错误处理
│   │
│   ├── types/                  # 类型定义
│   │   ├── portrait.ts
│   │   └── goal.ts
│   │
│   └── server.ts               # 主入口
│
├── public/                     # 静态文件
│   ├── index.html              # Web 聊天界面
│   ├── calendar.html           # 日历日记页面
│   └── viz.html                # 数据可视化页面
│
├── data/                       # 数据存储
│   └── app.db                  # SQLite 数据库
│
└── package.json
```

---

## 💻 使用方式

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
/reset         - 重置会话
```

### 快捷用语

- `紧急` / `急` - 紧急决策模式（3 个关键问题）
- `纠结` / `要不要` / `该不该` / `帮我分析` - 决策分析模式（6 步框架）
- `复盘` - 开始每日复盘

---

## 🗄️ 数据库

项目使用 **SQLite** 数据库，数据存储在 `data/app.db`。

### 核心表

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `user_portraits` | 用户画像 |
| `goals` | 目标表（树状结构） |
| `daily_tasks` | 日常任务 |
| `memories` | 长期记忆（6 种类型） |
| `ability_assets` | 能力资产（5 种类型） |
| `decisions` | 决策记录 |
| `challenges` | 认知挑战 |
| `reviews` | 复盘记录/日记 |
| `sessions` | 会话管理 |
| `conversation_history` | 对话历史 |
| `token_usage` | Token 使用统计 |

---

## 📊 核心特性详解

### 1. 第一性原理决策

使用 6 步决策框架：
1. **本质问题**（第一性原理）
2. **信息盘点**（已知 + 缺失 + 通用知识标注）
3. **选项分析**（代价/收益/可逆性/长期影响）
4. **初级建议 + 引导思考**
5. **执行计划 + 预期结果**
6. **止损线**（什么情况说明选错了 + 备选方案）

### 2. 进化式用户画像

自动学习用户的：
- 行业和收入结构
- 技能和资源
- 决策风格
- 能力雷达（商业判断/执行力/认知力/风控/学习力）
- 成长轨迹

**画像进化服务**：
- 每 5 次对话自动分析用户信息
- 提取：行业、资源、卡点、拖延触发因素、决策风格
- 自动创建长期记忆条目
- 根据决策结果动态调整能力分数
- 成长轨迹 API：`GET /api/viz/growth-summary?days=30`

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

### 7. 日历日记

- 每日 23:00 自动生成当日总结（对话 + 任务 + 洞察）
- 用户可编辑或删除自动生成的日记
- 支持查看历史日期的任务完成情况和对话历史

---

## 🛠️ 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 启动
npm start

# 类型检查
npm run typecheck

# 清理
npm run clean
```

---

## 📦 Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问：
- 聊天页面：http://localhost:3000/chat
- 数据中心：http://localhost:3000/viz
- 健康检查：http://localhost:3000/health

---

## 🚀 部署指南

### 云服务器部署

1. **安装 Node.js**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

2. **上传代码**
```bash
git clone <你的仓库> /opt/ai-life-partner
cd /opt/ai-life-partner
npm install
npm run build
```

3. **配置环境变量**
```bash
cp .env.example .env
vim .env  # 填写实际配置
```

4. **使用 PM2 管理**
```bash
npm install -g pm2
pm2 start dist/server.js --name ai-life-partner
pm2 startup
pm2 save
```

5. **配置 Nginx 反向代理**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

详见：[DEPLOY.md](DEPLOY.md)

---

## 🔒 安全建议

1. **不要提交敏感信息**
   - `.env` 文件已在 `.gitignore` 中
   - 使用环境变量管理敏感配置

2. **启用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 使用 Let's Encrypt 免费证书

3. **定期备份数据**
   ```bash
   # 每天凌晨 2 点备份
   0 2 * * * cp /opt/ai-life-partner/data/app.db /opt/ai-life-partner/backups/app_$(date +\%Y\%m\%d).db
   ```

4. **定期更新依赖**
   ```bash
   npm audit
   npm update
   ```

---

## 📈 开发路线图

### ✅ Phase 1 - 核心层（已完成）
- [x] AI 人格（第一性原理 + 输入校验）
- [x] 进化式用户画像
- [x] 目标管理 + 早推送
- [x] 飞书机器人基础框架
- [x] Web 聊天界面
- [x] 数据库集成

### ✅ Phase 2 - 生长层（已完成）
- [x] 决策引擎（6 步框架）
- [x] 紧急决策快速通道
- [x] 复盘系统（日/周/月）
- [x] 能力资产库
- [x] 预期 - 结果闭环
- [x] 长期记忆系统
- [x] 日历日记
- [x] 每日自动总结
- [x] 对话自动清理
- [x] AI 任务完成检测

### ⏳ Phase 3 - 进化层（规划中）
- [ ] 预警系统
- [ ] 认知挑战（周二/周五）
- [ ] 元认知训练
- [ ] 环境变量提醒
- [ ] 战略止损线
- [ ] 体检报告（月/季/半年）

---

## 🧰 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.9
- **框架**: Express 4.x
- **数据库**: SQLite / MySQL 8.0+ (可切换)
- **AI**: 多模型支持（OpenAI / DeepSeek / Claude / Kimi / Qwen / ZhiPU / Ollama）
- **渠道**: 飞书机器人 + Web 聊天界面
- **部署**: 支持本地开发/云服务器/Docker

---

## 📝 许可证

ISC

---

**最后更新**: 2026-04-07
