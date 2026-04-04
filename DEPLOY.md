# AI 人生合伙人 - 部署指南

## 飞书开放平台配置

### 步骤 1：创建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 登录企业后台（个人版可创建「测试企业」）
3. 点击「创建应用」
4. 选择「自建应用」
5. 填写应用名称：「AI 人生合伙人」

### 步骤 2：获取凭证

应用创建后，在「凭证与基础信息」页面获取：
- `App ID`
- `App Secret`

将这两个值填入 `.env` 文件。

### 步骤 3：配置事件订阅

1. 进入「事件订阅」菜单
2. 开启「启用自动推送」
3. 填写请求 URL：
   - 本地测试：使用 ngrok 生成的临时域名（见下方「本地测试」）
   - 生产环境：`https://你的域名/feishu/event`
4. 设置**验证 Token**（自定义一个字符串，用于签名验证）
5. 设置**加密 Key**（可选，用于消息加密）
6. 订阅以下事件：
   - 接收消息 v1.0 (`im.message.receive_v1`)
   - 需勾选「发送」权限

> **安全提示**：验证 Token 是用于签名验证的关键信息，请妥善保管，不要提交到代码仓库。

### 步骤 4：配置机器人

1. 进入「机器人」菜单
2. 点击「添加机器人」
3. 填写机器人名称和头像
4. 能力设置：
   - ✅ 接收并回复用户消息
   - ✅ 支持单聊
   - ✅ 支持关键词回复（可选）

### 步骤 5：发布应用

1. 进入「版本管理与发布」
2. 创建新版本
3. 提交审核（如果需要）
4. 发布后可在飞书中搜索并使用

## 本地测试

### 使用 Ngrok 暴露本地服务

```bash
# 安装 ngrok（如未安装）
npm install -g ngrok

# 启动本地服务
npm run dev

# 在另一个终端启动 ngrok
ngrok http 3000

# 将生成的 https://xxx.ngrok.io 配置到飞书事件订阅 URL
# 完整 URL: https://xxx.ngrok.io/feishu/event
```

### 测试消息接收

1. 在飞书中找到你的机器人
2. 发送消息：`你好`
3. 首次使用会引导填写画像
4. 查看本地日志确认处理流程

### 配置环境变量（本地）

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 飞书应用配置
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=your_custom_token  # 自定义的验证 Token
FEISHU_ENCRYPTION_KEY=  # 可选

# AI 模型配置
AI_MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# 服务器配置
PORT=3000
NODE_ENV=development
```

## 腾讯云服务器部署

### 前置准备

1. **购买服务器**：腾讯云轻量应用服务器或 CVM
2. **配置域名**：将域名解析到服务器 IP
3. **开放端口**：在防火墙/安全组中开放 80 (HTTP) 和 443 (HTTPS)

### 1. 服务器准备

```bash
# 安装 Node.js (如未安装)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node -v
npm -v
```

### 2. 上传代码

```bash
# 方式 1：使用 git
git clone <你的仓库> /opt/ai-life-partner
cd /opt/ai-life-partner

# 方式 2：使用 scp
scp -r ./ai-life-partner root@你的服务器 IP:/opt/
```

### 3. 安装依赖

```bash
cd /opt/ai-life-partner
npm install
npm run build
```

### 4. 配置环境变量

```bash
cp .env.example .env
vim .env  # 填写实际配置
```

### 5. 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/server.js --name ai-life-partner

# 设置开机自启
pm2 startup
pm2 save
```

### 6. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /feishu/event {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

重启 Nginx：
```bash
sudo nginx -t  # 测试配置
sudo systemctl reload nginx
```

### 7. 配置 HTTPS（推荐）

```bash
# 使用 Let's Encrypt
sudo yum install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 8. 生产环境配置

生产环境需要配置日志轮转：

```bash
# 安装 logrotate
sudo yum install logrotate

# 配置 /etc/logrotate.d/ai-life-partner
/opt/ai-life-partner/logs/*.log {
    daily
    rotate 30
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
}
```

## 本地测试

### 使用 Ngrok 暴露本地服务

```bash
# 安装 ngrok
npm install -g ngrok

# 启动 ngrok
ngrok http 3000

# 将生成的 https://xxx.ngrok.io 配置到飞书事件订阅 URL
```

### 测试消息接收

1. 在飞书中找到你的机器人
2. 发送消息：`你好`
3. 机器人应该回复（首次使用会引导填写画像）

## 故障排查

### 日志查看

```bash
# PM2 日志
pm2 logs ai-life-partner

# 查看应用日志
tail -f logs/app.log
```

### 常见问题

**1. 飞书收不到回复**
- 检查事件订阅 URL 是否正确（必须是 `https://`）
- 检查服务器防火墙是否开放端口
- 查看日志是否有报错
- 验证 `FEISHU_VERIFICATION_TOKEN` 是否与飞书后台一致

**2. 签名验证失败**
- 确保 `.env` 中配置了 `FEISHU_VERIFICATION_TOKEN`
- 确保飞书后台的验证 Token 与之相同
- 检查服务器时间是否准确（时区问题可能导致签名失效）

**3. DeepSeek API 调用失败**
- 检查 `.env` 中 `DEEPSEEK_API_KEY` 是否正确
- 检查服务器网络连接
- 查看 API 额度是否充足

**4. 文件写入失败**
- 检查 `data/` 目录权限：`chmod 755 data`
- 确保目录存在：`mkdir -p data logs`

**5. 定时推送未执行**
- 检查服务是否持续运行：`pm2 status`
- 查看日志中是否有 "发送早上推送" 的记录
- 确认用户已被注册：查看 `data/user-registry.json`

## 备份与恢复

### 数据备份

```bash
# 备份用户数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 上传到对象存储或下载本地
```

### 数据恢复

```bash
tar -xzf backup-20260403.tar.gz -C /opt/ai-life-partner/
```

## 后续优化

- [ ] 配置向量数据库（ChromaDB）用于长期记忆
- [ ] 使用飞书多维表格做可视化看板
- [ ] 添加监控告警（Prometheus + Grafana）
- [ ] 数据库迁移（从 JSON 文件到 PostgreSQL）
- [ ] 实现用户数据导出功能
- [ ] 添加多用户隔离和权限管理

## Phase 1 完成清单

- [x] AI 人格（第一性原理 + 输入校验）
- [x] 进化式用户画像
- [x] 目标管理 + 早推送
- [x] 飞书机器人基础框架
- [x] 事件签名验证
- [x] 用户注册表（定时推送支持）
- [x] 部署文档
