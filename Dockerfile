# ========== 多阶段构建 ==========
# 阶段 1: 构建前端 React
FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY client/package.json client/package-lock.json* ./
RUN npm ci

COPY client/ .
RUN npm run build

# 阶段 2: 服务器运行时
FROM node:20-alpine AS server

# 安装 Ollama（可选，通过 curl 拉取二进制）
RUN apk add --no-cache curl tini

# 创建应用目录
RUN mkdir -p /app/server /app/data /app/logs /app/ollama-models

WORKDIR /app

# 复制服务器文件
COPY server/ ./server/
COPY client/dist ./dist/

# 安装服务器依赖
WORKDIR /app/server
RUN npm install --production better-sqlite3 pg cors express ws

# 暴露端口
EXPOSE 9800

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9800/api/v1/health || exit 1

# 使用 tini 作为 init 进程
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.cjs"]
