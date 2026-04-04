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
AI_MODEL_PROVIDER=custom
CUSTOM_API_BASE_URL=https://api.aipaibox.com/v1
CUSTOM_API_MODEL=claude-sonnet-4-6
CUSTOM_API_KEY=sk-xxxxxxxxxxxxxxxx

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

## 数据库备份

项目使用 SQLite 数据库，数据存储在 `data/app.db`。

### 定期备份

```bash
# 创建备份脚本 /opt/ai-life-partner/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/ai-life-partner/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
cp /opt/ai-life-partner/data/app.db $BACKUP_DIR/app_$DATE.db

# 保留最近 30 天的备份
find $BACKUP_DIR -name "app_*.db" -mtime +30 -delete
echo "Backup completed: app_$DATE.db"

# 添加定时任务（每天凌晨 2 点备份）
crontab -e
0 2 * * * /opt/ai-life-partner/backup.sh
```

### 恢复数据

```bash
# 停止服务
pm2 stop ai-life-partner

# 恢复数据库
cp /opt/ai-life-partner/backups/app_20260404_120000.db /opt/ai-life-partner/data/app.db

# 重启服务
pm2 start ai-life-partner
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

**3. API 调用失败**
- 检查 `.env` 中 API 密钥是否正确
- 检查服务器网络连接
- 查看 API 额度是否充足

**4. 数据库错误**
- 检查 `data/` 目录权限：`chmod 755 data`
- 确保目录存在
- 如表结构损坏，可删除 `data/app.db` 重启服务会自动重建

**5. 定时推送未执行**
- 检查服务是否持续运行：`pm2 status`
- 查看日志中是否有 "发送早上推送" 的记录
- 查询数据库中用户设置

## 监控和告警

### 健康检查端点

```bash
# 定期检查服务状态
curl -f http://localhost:3000/health || echo "Service is down!"
```

### 使用 PM2 监控

```bash
# 查看服务状态
pm2 status

# 查看详细指标
pm2 monit

# 设置重启策略
pm2 start dist/server.js --name ai-life-partner --restart-delay=30000 --max-restarts=5
```

## 安全建议

1. **不要提交敏感信息**
   - `.env` 文件已在 `.gitignore` 中
   - 使用环境变量管理敏感配置

2. **启用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 使用 Let's Encrypt 免费证书

3. **限制 API 访问**
   - 配置 API Key 认证中间件
   - 设置速率限制防止滥用

4. **定期更新依赖**
   ```bash
   npm audit
   npm update
   ```

## 性能优化

1. **启用数据库 WAL 模式**（已默认启用）
2. **配置连接池**（如使用 PostgreSQL）
3. **添加 Redis 缓存**（可选）
4. **使用 CDN 加速静态资源**

## 后续优化

- [ ] 配置向量数据库用于长期记忆检索
- [ ] 使用飞书多维表格做可视化看板
- [ ] 添加监控告警（Prometheus + Grafana）
- [ ] 实现用户数据导出功能
- [ ] 添加多用户隔离和权限管理

## 完成清单

### Phase 1 - 核心层
- [x] AI 人格（第一性原理 + 输入校验）
- [x] 进化式用户画像
- [x] 目标管理 + 早推送
- [x] 飞书机器人基础框架
- [x] 事件签名验证
- [x] 用户数据库（SQLite）
- [x] 部署文档
- [x] Web 聊天界面

### Phase 2 - 生长层
- [x] 决策引擎（6 步框架）
- [x] 紧急决策快速通道
- [x] 复盘系统（日/周/月）
- [x] 能力资产库
- [x] 预期 - 结果闭环
- [x] 长期记忆系统

### Phase 3 - 进化层（规划中）
- [ ] 预警系统
- [ ] 认知挑战（周二/周五）
- [ ] 元认知训练
- [ ] 环境变量提醒
- [ ] 战略止损线
- [ ] 体检报告（月/季/半年）
