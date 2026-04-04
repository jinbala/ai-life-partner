# AI 人生合伙人

> 一个用第一性原理驱动的、能跟你一起进化的外置大脑

## 系统定位

- **不是**聊天机器人，**不是**工具，是你的**合伙人**
- 会挑战你、质疑你、拉住你、逼你成长
- 终极目标：你自己越来越强，最终不再需要它

## 快速开始

### 1. 环境准备

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

需要配置：
- `FEISHU_APP_ID` - 飞书应用 ID
- `FEISHU_APP_SECRET` - 飞书应用密钥
- `DEEPSEEK_API_KEY` - DeepSeek API 密钥

### 3. 本地开发

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 功能模块

### Phase 1 - 核心层

- ✅ AI 人格（第一性原理 + 输入校验）
- ✅ 进化式用户画像
- ✅ 目标管理 + 早推送
- 🔄 飞书机器人基础框架

### Phase 2 - 生长层（后续开发）

- 决策引擎（6 步框架）
- 紧急决策快速通道
- 复盘系统（日/周）
- 能力资产库
- 预期 - 结果闭环

### Phase 3 - 进化层（后续开发）

- 预警系统
- 认知挑战（周二/周五）
- 元认知训练
- 环境变量提醒
- 战略止损
- 体检报告（月/季/半年）

## 使用方式

### 飞书命令

```
/help          - 显示帮助
/goals         - 查看目标树
/tasks         - 查看今日任务
/add-task xxx  - 添加今日任务
/portrait      - 查看当前画像
/reset         - 重置会话
复盘            - 开始每日复盘
```

### 快捷用语

- `紧急` / `急` - 紧急决策模式
- `纠结` / `要不要` / `该不该` - 决策分析模式
- 日常对话 - 自动引导复盘

## 项目结构

```
ai-life-partner/
├── src/
│   ├── core/           # 核心业务逻辑
│   │   ├── aiPersona.ts      # AI 人格设定
│   │   ├── aiService.ts      # DeepSeek AI 服务
│   │   ├── portraitManager.ts # 用户画像管理
│   │   └── goalManager.ts    # 目标管理
│   ├── feishu/         # 飞书集成
│   │   └── messageService.ts
│   ├── types/          # TypeScript 类型定义
│   │   ├── portrait.ts
│   │   ├── goal.ts
│   │   └── decision.ts
│   └── server.ts       # 主入口
├── config/             # 配置文件
├── data/               # 本地数据存储
├── logs/               # 日志目录
└── scripts/            # 辅助脚本
```

## 开发计划

### 当前阶段：Phase 1

1. ✅ 项目基础结构
2. ✅ AI 人格和输入校验模块
3. ✅ 用户画像模块
4. ✅ 目标管理模块
5. 🔄 飞书机器人基础框架
6. 🔄 早上推送功能

### 下一步

完成飞书机器人配置和部署后，进入 Phase 2 开发。

## 技术栈

- **运行时**: Node.js
- **语言**: TypeScript
- **AI**: 支持多种大模型（OpenAI / DeepSeek / Claude / Kimi / 通义千问 / 智谱 / Ollama）
- **渠道**: 飞书机器人
- **存储**: 本地 JSON 文件
- **部署**: 腾讯云服务器

## 支持的 AI 模型

| 提供商 | 配置名 | 说明 |
|--------|--------|------|
| OpenAI | `openai` | GPT-4o / GPT-4o-mini |
| DeepSeek | `deepseek` | DeepSeek Chat |
| Claude | `claude` | Claude 3.5/4 Sonnet |
| 月之暗面 | `moonshot` | Kimi |
| 通义千问 | `qwen` | Qwen Plus |
| 智谱 AI | `zhipu` | GLM-4 |
| Ollama | `ollama` | 本地部署模型 |
| 自定义 | `custom` | 任意 OpenAI 兼容接口 |

配置示例（`.env` 文件）：
```bash
# 使用 DeepSeek
AI_MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx

# 或使用 OpenAI
AI_MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-xxx

# 或使用本地 Ollama
AI_MODEL_PROVIDER=ollama
```

## 许可证

ISC
