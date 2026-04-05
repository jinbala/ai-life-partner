# API 文档

AI 人生合伙人项目 API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3000`
- **内容类型**: `application/json`

---

## 健康检查

### GET `/health`

检查服务健康状态

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-05T12:00:00.000Z"
}
```

---

## 聊天相关 API

### POST `/chat/api/message`

发送聊天消息

**请求体**:
```json
{
  "userId": "user_123",
  "content": "你好"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "response": "你好！有什么可以帮你？",
    "sessionId": "session_xxx"
  }
}
```

### GET `/chat/api/session/:userId`

获取用户会话历史

**响应示例**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session_xxx",
    "conversationHistory": [
      { "role": "user", "content": "你好" },
      { "role": "assistant", "content": "你好！有什么可以帮你？" }
    ],
    "currentFocus": "创业分析"
  }
}
```

---

## 数据导出 API

### GET `/api/export/user/:userId`

导出用户所有数据

**路径参数**:
- `userId` - 用户 ID

**查询参数**:
- `format` - 可选，`file` 表示导出为文件，默认返回 JSON

**响应示例**:
```json
{
  "success": true,
  "data": {
    "exported_at": "2026-04-05T12:00:00.000Z",
    "user": { ... },
    "portraits": [...],
    "goals": [...],
    "tasks": [...],
    "memories": [...],
    "abilities": [...],
    "decisions": [...],
    "challenges": [...],
    "reviews": [...],
    "token_usage_summary": {
      "total_requests": 100,
      "total_tokens": 50000,
      "estimated_cost": 0.5
    }
  }
}
```

---

## Token 使用统计 API

### GET `/api/token-usage`

获取 AI Token 使用统计

**查询参数**:
- `userId` - 可选，过滤特定用户
- `days` - 可选，统计最近 N 天的数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": {
      "total_requests": 100,
      "total_prompt_tokens": 20000,
      "total_completion_tokens": 10000,
      "total_tokens": 30000,
      "estimated_cost": 0.35
    },
    "byProvider": [
      {
        "provider": "DeepSeek",
        "total_requests": 80,
        "total_tokens": 24000,
        "estimated_cost": 0.28
      }
    ],
    "recent": [
      {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "prompt_tokens": 150,
        "completion_tokens": 50,
        "total_tokens": 200,
        "cost": 0.0007,
        "created_at": "2026-04-05T11:00:00.000Z"
      }
    ]
  }
}
```

---

## 测试 API

### POST `/test-ai`

测试 AI 服务连接

**请求体**:
```json
{
  "message": "你好"
}
```

**响应示例**:
```json
{
  "success": true,
  "response": "你好！我是你的 AI 人生合伙人，有什么可以帮你？"
}
```

---

## 飞书集成 API

### POST `/feishu/event`

接收飞书事件（URL 验证、消息接收）

**请求体** (URL 验证):
```json
{
  "type": "url_verification",
  "challenge": "xxx"
}
```

**请求体** (消息接收):
```json
{
  "type": "im.message.receive_v1",
  "event": {
    "message": {
      "chat_id": "xxx",
      "content": "你好",
      "message_type": "text"
    },
    "sender": {
      "sender_id": {
        "open_id": "xxx"
      }
    }
  }
}
```

---

## 命令系统

用户可以在聊天中发送以下命令：

| 命令 | 说明 |
|------|------|
| `/help` | 查看帮助 |
| `/goals` | 查看目标状态 |
| `/tasks` | 查看今日任务 |
| `/add-task <内容>` | 添加今日任务 |
| `/portrait` | 查看用户画像 |
| `/memories` | 查看长期记忆 |
| `/assets` | 查看能力资产 |
| `/challenge` | 查看认知挑战 |
| `/challenge-now` | 立即生成挑战 |
| `/decisions` | 查看决策历史 |
| `/reset` | 重置会话 |

---

## 错误响应

所有 API 错误统一返回格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### 常见错误码

| 错误 | 说明 |
|------|------|
| `USER_NOT_FOUND_ERROR` | 用户不存在 |
| `SESSION_NOT_FOUND_ERROR` | 会话不存在 |
| `AI_SERVICE_ERROR` | AI 服务错误 |
| `DATABASE_ERROR` | 数据库错误 |
| `VALIDATION_ERROR` | 参数验证失败 |

---

## 模型配置

支持的 AI 模型提供商：

| 提供商 | 模型 | 说明 |
|--------|------|------|
| DeepSeek | deepseek-chat | 默认配置 |
| OpenAI | gpt-4o-mini | 需要 OPENAI_API_KEY |
| Claude | claude-sonnet-4-20250514 | 需要 ANTHROPIC_API_KEY |
| Moonshot | moonshot-v1-8k | 需要 MOONSHOT_API_KEY |
| Qwen | qwen-plus | 需要 DASHSCOPE_API_KEY |
| ZhiPU | glm-4 | 需要 ZHIPU_API_KEY |
| Ollama | llama3 | 本地部署 |

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | 3000 |
| `AI_MODEL_PROVIDER` | AI 提供商 | deepseek |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | - |
| `MOONSHOT_API_KEY` | Moonshot API 密钥 | - |
| `DASHSCOPE_API_KEY` | 通义千问 API 密钥 | - |
| `ZHIPU_API_KEY` | 智谱 AI API 密钥 | - |
