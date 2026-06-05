# BiBooks API 接口说明

**最后更新**: 2026-06-06 04:30
**API 版本**: v1
**默认端口**: 9800

---

## 概述

BiBooks 提供 REST API 接口，支持外部系统集成调用。API 服务器默认监听 9800 端口，可通过设置页面启动/停止。

## 认证方式

API 支持可选的密钥认证。如已设置 API 密钥，请求头需包含以下任一方式：

- **X-API-Key 头**: `X-API-Key: your-api-key`
- **Authorization Bearer**: `Authorization: Bearer your-api-key`

如未设置密钥，则无需认证。

## 通用响应格式

所有接口返回 JSON 格式，包含以下字段：

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": "错误信息"
}
```

---

## API 端点

### 健康检查

#### `GET /api/v1/health`

检查 API 服务器是否正常运行。

**响应示例**:
```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2026-06-06T04:30:00.000Z"
}
```

### 服务器状态

#### `GET /api/v1/status`

获取服务器详细状态信息。

**响应示例**:
```json
{
  "success": true,
  "version": "1.0.0",
  "uptime": 3600,
  "memory": { ... },
  "isRunning": true
}
```

### 配置

#### `GET /api/v1/config`

获取当前客户端配置。

**响应示例**:
```json
{
  "success": true,
  "config": { ... }
}
```

---

### 招标分析

#### `POST /api/v1/analysis/bid`

启动招标文件分析任务。

**请求体**:
```json
{
  "fileContent": "招标文件内容..."
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "分析任务已启动",
  "taskId": "task-123"
}
```

#### `GET /api/v1/analysis/bid/status`

获取招标分析状态。

**响应示例**:
```json
{
  "success": true,
  "state": { ... }
}
```

---

### 技术方案

#### `POST /api/v1/technical-plan/outline`

生成目录大纲。

**请求体**:
```json
{
  "requirements": "技术要求...",
  "industry": "IT/信息化"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "目录生成任务已启动",
  "taskId": "task-456"
}
```

#### `POST /api/v1/technical-plan/content`

生成技术方案内容。

**请求体**:
```json
{
  "outlineId": "outline-123",
  "options": { ... }
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "内容生成任务已启动",
  "taskId": "task-789"
}
```

#### `GET /api/v1/technical-plan/state`

获取技术方案当前状态。

**响应示例**:
```json
{
  "success": true,
  "state": { ... }
}
```

---

### 知识库

#### `GET /api/v1/knowledge-base/list`

获取知识库文档列表。

**响应示例**:
```json
{
  "success": true,
  "index": { ... }
}
```

#### `GET /api/v1/knowledge-base/search?query=关键词`

搜索知识库。

**查询参数**:
- `query`: 搜索关键词（必填）

**响应示例**:
```json
{
  "success": true,
  "results": []
}
```

---

### 私有知识库

#### `GET /api/v1/private-kb/categories`

获取私有知识库分类列表。

**响应示例**:
```json
{
  "success": true,
  "categories": { ... }
}
```

#### `GET /api/v1/private-kb/items?category=company&keyword=科技`

获取私有知识库条目列表。

**查询参数**:
- `category`: 分类过滤（可选）
- `keyword`: 关键词过滤（可选）

**响应示例**:
```json
{
  "success": true,
  "items": [ ... ]
}
```

#### `POST /api/v1/private-kb/items`

创建私有知识库条目。

**请求体**:
```json
{
  "category": "company",
  "title": "公司简介",
  "data": { ... },
  "tags": ["科技", "创新"]
}
```

**响应示例**:
```json
{
  "success": true,
  "item": { ... }
}
```

#### `GET /api/v1/private-kb/search?query=关键词&category=company&limit=10`

搜索私有知识库。

**查询参数**:
- `query`: 搜索关键词（必填）
- `category`: 分类过滤（可选）
- `limit`: 返回数量限制，默认 10（可选）

**响应示例**:
```json
{
  "success": true,
  "items": [ ... ]
}
```

#### `GET /api/v1/private-kb/recommendations?industry=IT&keywords=云计算,大数据&limit=5`

获取行业推荐内容。

**查询参数**:
- `industry`: 行业代码（必填）
- `keywords`: 关键词列表，逗号分隔（可选）
- `limit`: 返回数量限制，默认 5（可选）

**响应示例**:
```json
{
  "success": true,
  "items": [ ... ]
}
```

---

### AI 服务

#### `POST /api/v1/ai/chat`

AI 对话接口。

**请求体**:
```json
{
  "messages": [
    { "role": "system", "content": "你是一个专业的投标助手" },
    { "role": "user", "content": "请帮我分析这个招标文件..." }
  ],
  "options": {
    "model": "gpt-3.5-turbo",
    "temperature": 0.7
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "response": "AI 回复内容..."
}
```

#### `POST /api/v1/ai/complete`

AI 文本补全接口。

**请求体**:
```json
{
  "prompt": "请为以下技术要求生成方案大纲：...",
  "options": {
    "model": "gpt-3.5-turbo",
    "max_tokens": 2000
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "response": "补全内容..."
}
```

---

## 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 200 | 请求成功 |
| 401 | 未授权（API 密钥无效） |
| 404 | 路由不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### curl 示例

```bash
# 健康检查
curl http://localhost:9800/api/v1/health

# 带密钥的请求
curl -H "X-API-Key: your-api-key" http://localhost:9800/api/v1/status

# 启动招标分析
curl -X POST http://localhost:9800/api/v1/analysis/bid \
  -H "Content-Type: application/json" \
  -d '{"fileContent": "招标文件内容..."}'

# AI 对话
curl -X POST http://localhost:9800/api/v1/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "你好"}]}'
```

### JavaScript 示例

```javascript
// 健康检查
const response = await fetch('http://localhost:9800/api/v1/health');
const data = await response.json();

// 带密钥的请求
const response = await fetch('http://localhost:9800/api/v1/status', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});

// AI 对话
const response = await fetch('http://localhost:9800/api/v1/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: '你好' }]
  })
});
```

---

## 注意事项

1. API 服务器默认不启动，需在设置页面手动启动
2. 建议在内网环境使用，如需公网访问请做好安全防护
3. 所有 AI 相关接口会自动进行报价脱敏处理
4. 任务类接口（招标分析、目录生成、内容生成）为异步执行，通过 taskId 追踪进度
