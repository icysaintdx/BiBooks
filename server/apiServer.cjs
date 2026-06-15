/**
 * 服务器版 API 服务
 * 从 Electron 主进程的 apiServer.cjs 剥离，支持独立运行
 * 数据源通过 db 适配器注入，兼容 SQLite 和 PostgreSQL
 */

const http = require('node:http');
const cors = require('cors');
const { logInfo, logError, logWarn } = require('./logger.cjs');

const API_VERSION = 'v1';
const DEFAULT_PORT = 9800;

function createApiServer({ db, port = DEFAULT_PORT, apiKey = '', ollamaBaseUrl = '', config }) {
  let server = null;
  let isRunning = false;

  function parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(new Error('无效的 JSON 格式'));
        }
      });
      req.on('error', reject);
    });
  }

  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    });
    res.end(JSON.stringify(data));
  }

  function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { success: false, error: message });
  }

  function validateApiKey(req) {
    if (!apiKey) return true;
    const headerKey = req.headers['x-api-key'] || '';
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : headerKey;
    return token === apiKey;
  }

  function matchRoute(method, pathname) {
    const routes = {
      'GET /api/v1/health': 'health',
      'GET /api/v1/status': 'status',
      'GET /api/v1/config': 'getConfig',
      'POST /api/v1/analysis/bid': 'startBidAnalysis',
      'GET /api/v1/analysis/bid/status': 'getBidAnalysisStatus',
      'POST /api/v1/technical-plan/outline': 'generateOutline',
      'POST /api/v1/technical-plan/content': 'generateContent',
      'GET /api/v1/technical-plan/state': 'getTechnicalPlanState',
      'GET /api/v1/knowledge-base/list': 'listKnowledgeBase',
      'GET /api/v1/knowledge-base/search': 'searchKnowledgeBase',
      'GET /api/v1/private-kb/categories': 'getPrivateKBCategories',
      'GET /api/v1/private-kb/items': 'listPrivateKBItems',
      'POST /api/v1/private-kb/items': 'createPrivateKBItem',
      'GET /api/v1/private-kb/search': 'searchPrivateKB',
      'GET /api/v1/private-kb/recommendations': 'getPrivateKBRecommendations',
      'POST /api/v1/ai/chat': 'aiChat',
      'POST /api/v1/ai/complete': 'aiComplete',
      'GET /api/v1/ollama/status': 'ollamaStatus',
      'POST /api/v1/ollama/pull': 'ollamaPull',
      'GET /api/v1/ollama/tags': 'ollamaTags',
    };
    const key = `${method} ${pathname}`;
    return routes[key] || null;
  }

  async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
      sendJson(res, 200, {});
      return;
    }

    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    if (!validateApiKey(req)) {
      sendError(res, 401, '未授权：无效的 API 密钥');
      return;
    }

    const handler = matchRoute(req.method, pathname);
    if (!handler) {
      sendError(res, 404, `未找到路由: ${req.method} ${pathname}`);
      return;
    }

    try {
      const result = await executeHandler(handler, req, url);
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      logError(`[api] 处理请求失败: ${handler}`, error);
      sendError(res, 500, error.message || '服务器内部错误');
    }
  }

  async function executeHandler(handler, req, url) {
    const body = req.method !== 'GET' ? await parseBody(req) : {};
    const params = Object.fromEntries(url.searchParams);

    switch (handler) {
      case 'health':
        return { status: 'ok', timestamp: new Date().toISOString(), mode: db.isPostgres ? 'postgres' : 'sqlite' };

      case 'status':
        return {
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          isRunning: true,
          mode: db.isPostgres ? 'postgres' : 'sqlite',
          ollama: ollamaBaseUrl ? `${ollamaBaseUrl}/api/tags` : '未配置',
        };

      case 'getConfig':
        return { config: config?.load?.() || {} };

      case 'startBidAnalysis': {
        if (!body.fileContent) throw new Error('缺少参数: fileContent');
        return { message: '分析任务已启动（服务器版待接入 taskService）', status: 'queued' };
      }

      case 'getBidAnalysisStatus': {
        const rows = await db.all('SELECT * FROM technical_plan_meta WHERE id = 1');
        return { state: rows[0] || null };
      }

      case 'generateOutline': {
        return { message: '目录生成任务已启动（服务器版待接入 taskService）', status: 'queued' };
      }

      case 'generateContent': {
        return { message: '内容生成任务已启动（服务器版待接入 taskService）', status: 'queued' };
      }

      case 'getTechnicalPlanState': {
        const rows = await db.all('SELECT * FROM technical_plan_meta WHERE id = 1');
        return { state: rows[0] || null };
      }

      case 'listKnowledgeBase': {
        const rows = await db.all('SELECT * FROM knowledge_folders ORDER BY sort_order');
        return { index: rows || [] };
      }

      case 'searchKnowledgeBase': {
        if (!params.query) throw new Error('缺少参数: query');
        return { results: [] };
      }

      case 'getPrivateKBCategories': {
        const rows = await db.all('SELECT DISTINCT category FROM private_kb_items GROUP BY category ORDER BY category');
        return { categories: rows?.map(r => r.category) || [] };
      }

      case 'listPrivateKBItems': {
        let sql = 'SELECT * FROM private_kb_items';
        const conditions = [];
        const p = [];
        if (params.category) { conditions.push('category = $' + (p.length + 1)); p.push(params.category); }
        if (params.keyword) { conditions.push('title LIKE $' + (p.length + 1)); p.push('%' + params.keyword + '%'); }
        if (conditions.length) { sql += ' WHERE ' + conditions.join(' AND '); }
        sql += ' ORDER BY created_at DESC LIMIT 50';
        const items = await db.all(sql, p);
        return { items: items || [] };
      }

      case 'createPrivateKBItem': {
        if (!body.category || !body.title || !body.data) throw new Error('缺少参数: category, title, data');
        return { item: { id: Date.now().toString(), ...body } };
      }

      case 'searchPrivateKB': {
        if (!params.query) throw new Error('缺少参数: query');
        return { items: [] };
      }

      case 'getPrivateKBRecommendations': {
        if (!params.industry) throw new Error('缺少参数: industry');
        return { items: [] };
      }

      case 'aiChat': {
        if (!body.messages) throw new Error('缺少参数: messages');
        const baseUrl = ollamaBaseUrl || 'http://127.0.0.1:11434';
        const modelName = body.model || config?.load?.()?.text_model_name || 'qwen2.5:7b';
        const resp = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, messages: body.messages, stream: false }),
        });
        if (!resp.ok) throw new Error(`Ollama 请求失败: ${resp.status}`);
        const data = await resp.json();
        return { response: data.message?.content || '' };
      }

      case 'aiComplete': {
        if (!body.prompt) throw new Error('缺少参数: prompt');
        const baseUrl = ollamaBaseUrl || 'http://127.0.0.1:11434';
        const modelName = body.model || config?.load?.()?.text_model_name || 'qwen2.5:7b';
        const resp = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, prompt: body.prompt, stream: false }),
        });
        if (!resp.ok) throw new Error(`Ollama 请求失败: ${resp.status}`);
        const data = await resp.json();
        return { response: data.response || '' };
      }

      case 'ollamaStatus': {
        try {
          const baseUrl = ollamaBaseUrl || 'http://127.0.0.1:11434';
          const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
          const data = await resp.json();
          return { connected: true, models: data.models || [], baseUrl };
        } catch {
          return { connected: false, baseUrl, error: '无法连接到 Ollama' };
        }
      }

      case 'ollamaPull': {
        if (!body.model) throw new Error('缺少参数: model');
        const baseUrl = ollamaBaseUrl || 'http://127.0.0.1:11434';
        const resp = await fetch(`${baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: body.model, stream: false }),
        });
        if (!resp.ok) throw new Error(`拉取模型失败: ${resp.status}`);
        const data = await resp.json();
        return { pulled: true, model: body.model, status: data.status };
      }

      case 'ollamaTags': {
        try {
          const baseUrl = ollamaBaseUrl || 'http://127.0.0.1:11434';
          const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
          const data = await resp.json();
          return { models: data.models || [] };
        } catch {
          return { models: [], error: '无法连接 Ollama' };
        }
      }

      default:
        throw new Error(`未实现的处理器: ${handler}`);
    }
  }

  function start() {
    if (isRunning) {
      logWarn('[api] 服务器已在运行');
      return;
    }

    server = http.createServer(handleRequest);
    server.listen(port, () => {
      isRunning = true;
      logInfo(`[api] API 服务器已启动: http://localhost:${port}`);
      logInfo(`[api] API 版本: ${API_VERSION}`);
      logInfo(`[api] 运行模式: ${db.isPostgres ? 'PostgreSQL' : 'SQLite'}`);
      if (ollamaBaseUrl) logInfo(`[api] Ollama: ${ollamaBaseUrl}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logError(`[api] 端口 ${port} 已被占用`);
      } else {
        logError('[api] 服务器启动失败', error);
      }
      isRunning = false;
    });
  }

  function stop() {
    if (server) {
      server.close(() => {
        isRunning = false;
        logInfo('[api] API 服务器已停止');
      });
    }
  }

  function getStatus() {
    return { isRunning, port, apiKey: apiKey ? '已设置' : '未设置' };
  }

  return { start, stop, getStatus };
}

module.exports = { createApiServer, API_VERSION, DEFAULT_PORT };
