# 快速开始

## 第一步：配置 API 密钥

1. 复制 `.env.example` 到 `.env`：
   ```bash
   cp .env.example .env
   ```

2. 获取 DeepSeek API 密钥：
   - 访问 https://platform.deepseek.com/
   - 注册/登录账号
   - 在 API Keys 页面创建新的密钥
   - 填入 `.env` 文件的 `DEEPSEEK_API_KEY`

3. （可选）配置飞书机器人：
   - 访问 https://open.feishu.cn/
   - 创建自建应用
   - 获取 App ID 和 App Secret
   - 填入 `.env` 文件

## 第二步：启动服务

```bash
# 开发模式
npm run dev

# 或构建后运行
npm run build
npm start
```

## 第三步：测试

如果没有配置飞书，可以直接运行服务测试 AI 对话功能。

## 下一步

查看 [DEPLOY.md](./DEPLOY.md) 了解完整的飞书配置和部署指南。
