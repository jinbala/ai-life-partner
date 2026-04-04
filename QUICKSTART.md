# 快速开始

## 第一步：安装依赖

```bash
npm install
```

## 第二步：配置环境变量

1. 复制 `.env.example` 到 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，配置 AI API 密钥：
   ```bash
   # AI 模型配置（推荐使用 aipaibox.com 中转）
   AI_MODEL_PROVIDER=custom
   CUSTOM_API_BASE_URL=https://api.aipaibox.com/v1
   CUSTOM_API_MODEL=claude-sonnet-4-6
   CUSTOM_API_KEY=sk-xxx
   
   # 服务器配置
   PORT=3000
   ```

   **支持的模型提供商**：
   - `custom` - 自定义 OpenAI 兼容接口（推荐 aipaibox.com）
   - `deepseek` - DeepSeek
   - `openai` - OpenAI
   - `claude` - Anthropic Claude
   - `moonshot` - 月之暗面 Kimi
   - `qwen` - 通义千问
   - `zhipu` - 智谱 GLM
   - `ollama` - 本地 Ollama

3. （可选）配置飞书机器人：
   - 访问 https://open.feishu.cn/
   - 创建自建应用获取 App ID 和 App Secret
   - 填入 `.env` 文件

## 第三步：启动服务

```bash
# 开发模式（推荐）
npm run dev

# 或构建后运行
npm run build
npm start
```

## 第四步：测试

### Web 聊天界面

打开浏览器访问：**http://localhost:3000/chat**

### 健康检查

```bash
curl http://localhost:3000/health
```

预期响应：
```json
{"status":"ok","model":"Custom - claude-sonnet-4-6","timestamp":"..."}
```

### 测试 AI 对话

```bash
curl -X POST http://localhost:3000/test-ai \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，请介绍一下你自己"}'
```

## 第五步：开始使用

### 首次使用

第一次对话时，AI 会引导你填写基本信息：
- 行业/职业
- 收入结构
- 技能和资源
- 决策风格

### 常用命令

```
/help          - 显示帮助
/goals         - 查看目标状态
/tasks         - 查看今日任务
/add-task xxx  - 添加今日任务
/portrait      - 查看用户画像
/memories      - 查看长期记忆
/assets        - 查看能力资产
/challenge-now - 立即生成认知挑战
/review        - 开始每日复盘
```

### 快捷用语

- `紧急` - 紧急决策模式
- `纠结` / `要不要` - 决策分析模式
- `复盘` - 开始每日复盘

## 下一步

- 查看 [README.md](./README.md) 了解完整功能
- 查看 [DEPLOY.md](./DEPLOY.md) 了解飞书配置和部署指南
- 查看 [DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md) 了解数据库结构

## 常见问题

### 1. 端口被占用

错误：`EADDRINUSE: address already in use :::3000`

解决：
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000

# 杀死进程（Windows）
taskkill /PID <PID> /F

# 或修改 .env 中的 PORT
PORT=3001
```

### 2. API 密钥无效

错误：`401 Unauthorized`

解决：
- 检查 `.env` 中的 API 密钥是否正确
- 确认模型名称是否支持
- 检查 API 额度是否充足

### 3. 数据库错误

错误：`no such table: users`

解决：
- 删除 `data/app.db` 文件
- 重启服务，系统会自动创建表结构

### 4. TypeScript 编译错误

```bash
# 运行类型检查
npm run typecheck

# 清理并重新构建
npm run clean
npm run build
```

## 数据持久化

项目使用 SQLite 数据库，数据存储在 `data/app.db` 文件。

**重要提示**：
- 不要删除 `data/` 目录
- 定期备份 `data/app.db` 文件
- 数据库文件已忽略在 `.gitignore` 中，不会被提交

## 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建
npm run build

# 启动
npm start

# 类型检查
npm run typecheck

# 测试
npm test
```
