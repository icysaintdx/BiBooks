/**
 * BiBooks 服务器入口
 * 独立 Node.js 服务，支持 SQLite 单机模式和 PostgreSQL 多用户模式
 * 环境变量：
 *   MODE=sqlite|postgres（默认 sqlite）
 *   PORT=9800
 *   DB_HOST=postgres
 *   DB_PORT=5432
 *   DB_NAME=bibooks
 *   DB_USER=bibooks
 *   DB_PASSWORD=bibooks
 *   API_KEY=your-key（可选）
 *   OLLAMA_BASE_URL=http://ollama:11434（可选）
 */

const { createApiServer } = require('./apiServer.cjs');
const { createDatabaseAdapter } = require('./db.cjs');
const path = require('node:path');
const fs = require('node:fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const val = line.slice(idx + 1).trim();
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();

// 数据库配置
const dbConfig = {
  mode: process.env.MODE || 'sqlite',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bibooks.db'),
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'bibooks',
  user: process.env.DB_USER || 'bibooks',
  password: process.env.DB_PASSWORD || 'bibooks',
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'bibooks'}:${process.env.DB_PASSWORD || 'bibooks'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'bibooks'}`,
};

const port = parseInt(process.env.PORT) || 9800;
const apiKey = process.env.API_KEY || '';

console.log(`[server] 启动模式: ${dbConfig.mode}`);
console.log(`[server] 端口: ${port}`);
console.log(`[server] API Key: ${apiKey ? '已设置' : '未设置（公开访问）'}`);

// 创建数据库适配器
const db = createDatabaseAdapter(dbConfig);

// 创建 API 服务器
const apiServer = createApiServer({
  db,
  port,
  apiKey,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
  config: {
    get: (key) => process.env[key] || null,
    set: (key, val) => { process.env[key] = val; },
    load: () => ({
      mode: dbConfig.mode,
      api_key: apiKey,
      ollama_base_url: process.env.OLLAMA_BASE_URL,
      text_model_provider: process.env.TEXT_MODEL_PROVIDER || 'custom',
      text_model_name: process.env.TEXT_MODEL_NAME || 'qwen2.5:7b',
      text_model_base_url: process.env.TEXT_MODEL_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
      image_model_provider: process.env.IMAGE_MODEL_PROVIDER || '',
      text_model_api_key: process.env.TEXT_MODEL_API_KEY || '',
    }),
  },
});

// 启动
apiServer.start();

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('[server] 收到关闭信号，正在停止...');
  apiServer.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[server] 收到终止信号，正在停止...');
  apiServer.stop();
  await db.close();
  process.exit(0);
});

console.log(`[server] API 服务已启动: http://localhost:${port}`);
console.log(`[server] 健康检查: http://localhost:${port}/api/v1/health`);

module.exports = { db, apiServer };
