# AI 模型配置指南

## 支持的模型提供商

本项目支持多种大语言模型 API，你可以根据需求和成本选择合适的模型。

### 配置方法

在 `.env` 文件中设置：

```bash
# 1. 选择模型提供商
AI_MODEL_PROVIDER=deepseek

# 2. 填写对应 API 密钥
DEEPSEEK_API_KEY=sk-xxxxx
```

---

## 各模型配置说明

### 1. DeepSeek (推荐)

```bash
AI_MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

- **官网**: https://platform.deepseek.com/
- **价格**: 约 ¥0.1-1 / 百万 tokens
- **特点**: 性价比高，中文能力强

---

### 2. OpenAI

```bash
AI_MODEL_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

- **官网**: https://platform.openai.com/
- **模型**: gpt-4o-mini (默认), gpt-4o
- **价格**: $0.15-15 / 百万 tokens
- **特点**: 能力最强，价格较高

---

### 3. Claude (Anthropic)

```bash
AI_MODEL_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

- **官网**: https://console.anthropic.com/
- **模型**: claude-sonnet-4-20250514 (默认)
- **价格**: $0.3-15 / 百万 tokens
- **特点**: 长文本处理强，逻辑推理优秀

---

### 4. 月之暗面 (Kimi)

```bash
AI_MODEL_PROVIDER=moonshot
MOONSHOT_API_KEY=xxxxxxxxxxxxxxxx
```

- **官网**: https://platform.moonshot.cn/
- **模型**: moonshot-v1-8k
- **特点**: 超长上下文，中文友好

---

### 5. 通义千问 (阿里云)

```bash
AI_MODEL_PROVIDER=qwen
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
```

- **官网**: https://dashscope.console.aliyun.com/
- **模型**: qwen-plus (默认)
- **特点**: 阿里出品，中文能力强

---

### 6. 智谱 AI

```bash
AI_MODEL_PROVIDER=zhipu
ZHIPU_API_KEY=xxxxxxxxxxxxxxxx
```

- **官网**: https://open.bigmodel.cn/
- **模型**: glm-4
- **特点**: 国产模型，性价比高

---

### 7. Ollama (本地部署)

```bash
AI_MODEL_PROVIDER=ollama
```

- **官网**: https://ollama.com/
- **模型**: llama3 (默认，可自定义)
- **特点**: 免费，本地运行，无需 API 密钥
- **安装**: 
  ```bash
  # 下载安装 Ollama
  # 然后拉取模型
  ollama pull llama3
  ```

---

### 8. 自定义 (OpenAI 兼容接口)

```bash
AI_MODEL_PROVIDER=custom
CUSTOM_API_BASE_URL=https://your-api.com/v1
CUSTOM_API_KEY=xxxxxxxxxxxxxxxx
CUSTOM_API_MODEL=your-model-name
```

- 适用于任何 OpenAI 兼容的 API 接口
- 如：Azure OpenAI, LocalAI, LM Studio 等

---

## 模型推荐

| 使用场景 | 推荐模型 | 理由 |
|----------|----------|------|
| 日常使用 | DeepSeek | 性价比最高 |
| 复杂决策 | Claude / GPT-4o | 推理能力强 |
| 本地测试 | Ollama | 免费离线 |
| 中文场景 | Kimi / 通义千问 | 中文优化 |

---

## 切换模型

修改 `.env` 文件中的 `AI_MODEL_PROVIDER` 后重启服务即可：

```bash
# 从 DeepSeek 切换到 OpenAI
AI_MODEL_PROVIDER=openai
```

无需修改代码。

---

## 测试连接

启动服务后，可以发送消息测试：

```
/help
```

如果 API 配置正确，机器人会正常回复。
