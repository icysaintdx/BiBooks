# BiBooks 服务器版部署指南

## 架构说明

BiBooks 现在有两种部署形态：

| 形态 | 适用场景 | 数据库 | 模型 |
|------|---------|--------|------|
| **桌面版** (Electron) | 个人/小工作室单机使用 | SQLite 文件 | 内置 Ollama 便携版 |
| **服务器版** (Node.js) | 多人协同、企业团队 | SQLite 或 PostgreSQL | Ollama 容器 |

## 服务器版文件结构

```
BiBooks/
├── server/                    # 独立 Node.js 服务器
│   ├── package.json           # 依赖
│   ├── index.cjs              # 入口
│   ├── apiServer.cjs          # API 服务（从 Electron 剥离）
│   ├── db.cjs                 # 数据库适配层（SQLite/PostgreSQL 统一接口）
│   ├── logger.cjs             # 日志
│   ├── migrate-sqlite-to-postgres.cjs  # 迁移脚本
│   └── services/              # 业务服务（逐步从 Electron 迁移）
├── Dockerfile                 # 多阶段构建
├── docker-compose.yml         # 一键部署
├── nginx.conf                 # 反向代理
├── .env.example               # 环境变量模板
└── .dockerignore
```

## 快速启动（SQLite 单机模式）

无需 Docker，直接运行：

```bash
cd BiBooks/server
npm install
node index.cjs
```

启动后访问 `http://localhost:9800/api/v1/health`

## Docker Compose 部署

### 1. 准备环境

```bash
cp .env.example .env
# 编辑 .env，修改密码等
```

### 2. 启动

```bash
docker compose up -d
```

这会启动 4 个容器：
- `bibooks-app` — 应用服务器（端口 9800）
- `bibooks-ollama` — Ollama 本地模型（端口 11434）
- `bibooks-postgres` — PostgreSQL 数据库
- `bibooks-nginx` — 反向代理（端口 80）

### 3. 验证

```bash
curl http://localhost:9800/api/v1/health
```

### 4. 只使用云端 API（不需要本地模型）

编辑 `.env`：
```yaml
# 注释掉 ollama 服务
# docker compose stop ollama
```

### 5. 有 GPU 的服务器

取消 `docker-compose.yml` 中 ollama 的 `deploy` 注释：
```yaml
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

## SQLite → PostgreSQL 迁移

```bash
# 方式 1: 使用默认路径
cd BiBooks/server
node migrate-sqlite-to-postgres.cjs

# 方式 2: 指定路径
node migrate-sqlite-to-postgres.cjs ./data/bibooks.db postgresql://user:pass@host:5432/db
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 健康检查 |
| GET | `/api/v1/status` | 服务状态 |
| GET | `/api/v1/config` | 获取配置 |
| POST | `/api/v1/ai/chat` | AI 对话（走 Ollama） |
| POST | `/api/v1/ai/complete` | AI 补全 |
| GET | `/api/v1/ollama/status` | Ollama 状态 |
| POST | `/api/v1/ollama/pull` | 拉取模型 |
| GET | `/api/v1/ollama/tags` | 已安装的模型 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| MODE | 数据库模式: sqlite/postgres | sqlite |
| PORT | API 端口 | 9800 |
| DB_HOST | PostgreSQL 主机 | localhost |
| DB_NAME | 数据库名 | bibooks |
| DB_USER | 数据库用户 | bibooks |
| DB_PASSWORD | 数据库密码 | bibooks |
| API_KEY | API 访问密钥 | 空（公开） |
| OLLAMA_BASE_URL | Ollama 地址 | http://127.0.0.1:11434 |

## 下一步

当前服务器版已完成：
- ✅ API Server 剥离（独立运行）
- ✅ 数据库适配层（SQLite/PostgreSQL 统一接口）
- ✅ Docker 部署配置
- ✅ Ollama 集成
- ✅ 迁移脚本

待后续补充：
- ⬜ 将 Electron 的 services/ 逐步迁移到 server/
- ⬜ WebSocket 协同编辑网络版
- ⬜ 前端适配（生产环境指向服务器 API 地址）
- ⬜ 桌面版内置 Ollama 便携版
- ⬜ 本地小模型引导页
