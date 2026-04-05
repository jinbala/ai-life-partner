# MySQL 配置说明

## 前提条件
你的电脑需要已安装 MySQL 8.0+

## 方案 1：使用本地 MySQL（开发环境）

### 1. 创建数据库
```sql
CREATE DATABASE ai_life_partner CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. 配置环境变量
复制 `.env.mysql` 到 `.env` 并修改：
```bash
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=ai_life_partner
```

### 3. 安装依赖
```bash
npm install
```

### 4. 运行
```bash
npm run build
npm start
```

## 方案 2：使用 SQLite（推荐，生产环境）

SQLite 数据存储在 `data/app.db`，简单可靠，无需额外配置。

### Docker 部署
```bash
# 使用 SQLite 的 Docker 部署
docker-compose up -d
```

数据持久化到 `./data` 目录。

## 注意事项

- MySQL 迁移需要修改所有 repository 为异步操作（工作量大）
- SQLite 支持每日数百万次读写，足够个人使用
- Docker 部署会自动处理数据持久化
