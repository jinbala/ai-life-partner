# Docker 部署指南

## 快速开始

### 1. 构建并启动
```bash
# 构建并启动容器
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 2. 访问服务
- 聊天页面：http://localhost:3000/chat
- 数据中心：http://localhost:3000/viz
- 健康检查：http://localhost:3000/health

## 数据持久化

数据存储在 `./data` 目录，包括：
- SQLite 数据库（`data/app.db`）
- 用户决策记录
- 导出数据

## 配置修改

1. 编辑 `.env.docker` 文件修改配置
2. 重启容器：`docker-compose restart`

## 常用命令

```bash
# 查看容器状态
docker-compose ps

# 进入容器
docker-compose exec ai-life-partner sh

# 重建容器（修改代码后）
docker-compose up -d --build

# 查看数据目录
docker-compose exec ai-life-partner ls -la /app/data
```

## 注意事项

1. **首次启动**：数据库会自动初始化
2. **端口占用**：确保 3000 端口未被占用
3. **数据安全**：定期备份 `data` 目录
