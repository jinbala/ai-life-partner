# AI 人生合伙人 - Docker 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装构建工具（用于编译 better-sqlite3）
RUN apk add --no-cache python3 make g++

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npm run build

# 暴露端口
EXPOSE 3000

# 创建数据目录
RUN mkdir -p /app/data

# 启动命令
CMD ["node", "dist/server.js"]
