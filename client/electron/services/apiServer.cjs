/**
 * API 服务化模块
 * 提供 REST API 接口，支持外部系统集成
 */

const http = require('node:http');
const { logInfo, logError, logWarn } = require('../utils/logger.cjs');

// API 版本
const API_VERSION = 'v1';

// 默认端口
const DEFAULT_PORT = 9800;

// API 密钥（生产环境应从配置读取）
let apiKey = '';

/**
 * 创建 API 服务器
 */
function createApiServer({ port = DEFAULT_PORT, configStore, technicalPlanStore, knowledgeBaseService, privateKnowledgeBaseService, taskService, aiService }) {
  let server = null;
  let isRunning = false;

  /**
   * 解析请求体
   */
  async function parseBody(req) {
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

  /**
   * 发送 JSON 响应
   */
  function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    });
    res.end(JSON.stringify(data));
  }

  /**
   * 发送错误响应
   */
  function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { success: false, error: message });
  }

  /**
   * 验证 API 密钥
   */
  function validateApiKey(req) {
    if (!apiKey) return true; // 未设置密钥则跳过验证

    const headerKey = req.headers['x-api-key'] || '';
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : headerKey;

    return token === apiKey;
  }

  /**
   * 路由匹配
   */
  function matchRoute(method, pathname) {
    const routes = {
      // 健康检查
      'GET /api/v1/health': 'health',
      'GET /api/v1/status': 'status',

      // 配置
      'GET /api/v1/config': 'getConfig',

      // 招标分析
      'POST /api/v1/analysis/bid': 'startBidAnalysis',
      'GET /api/v1/analysis/bid/status': 'getBidAnalysisStatus',

      // 技术方案
      'POST /api/v1/technical-plan/outline': 'generateOutline',
      'POST /api/v1/technical-plan/content': 'generateContent',
      'GET /api/v1/technical-plan/state': 'getTechnicalPlanState',

      // 知识库
      'GET /api/v1/knowledge-base/list': 'listKnowledgeBase',
      'GET /api/v1/knowledge-base/search': 'searchKnowledgeBase',

      // 私有知识库
      'GET /api/v1/private-kb/categories': 'getPrivateKBCategories',
      'GET /api/v1/private-kb/items': 'listPrivateKBItems',
      'POST /api/v1/private-kb/items': 'createPrivateKBItem',
      'GET /api/v1/private-kb/search': 'searchPrivateKB',
      'GET /api/v1/private-kb/recommendations': 'getPrivateKBRecommendations',

      // AI 服务
      'POST /api/v1/ai/chat': 'aiChat',
      'POST /api/v1/ai/complete': 'aiComplete',
    };

    const key = `${method} ${pathname}`;
    return routes[key] || null;
  }

  /**
   * 处理请求
   */
  async function handleRequest(req, res) {
    // 处理 CORS 预检请求
    if (req.method === 'OPTIONS') {
      sendJson(res, 200, {});
      return;
    }

    // 解析 URL
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // 验证 API 密钥
    if (!validateApiKey(req)) {
      sendError(res, 401, '未授权：无效的 API 密钥');
      return;
    }

    // 匹配路由
    const handler = matchRoute(req.method, pathname);

    if (!handler) {
      sendError(res, 404, `未找到路由: ${req.method} ${pathname}`);
      return;
    }

    try {
      // 执行处理器
      const result = await executeHandler(handler, req, url);
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      logError(`[api] 处理请求失败: ${handler}`, error);
      sendError(res, 500, error.message || '服务器内部错误');
    }
  }

  /**
   * 执行处理器
   */
  async function executeHandler(handler, req, url) {
    const body = req.method !== 'GET' ? await parseBody(req) : {};
    const params = Object.fromEntries(url.searchParams);

    switch (handler) {
      case 'health':
        return { status: 'ok', timestamp: new Date().toISOString() };

      case 'status':
        return {
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          isRunning: true,
        };

      case 'getConfig':
        return { config: configStore?.load() || {} };

      case 'startBidAnalysis': {
        if (!body.fileContent) {
          throw new Error('缺少参数: fileContent');
        }
        // 异步启动分析任务
        const result = await taskService?.startBidAnalysis(body);
        return { message: '分析任务已启动', taskId: result?.task_id };
      }

      case 'getBidAnalysisStatus': {
        const state = technicalPlanStore?.loadTechnicalPlan();
        return { state };
      }

      case 'generateOutline': {
        const result = await taskService?.startOutlineGeneration(body);
        return { message: '目录生成任务已启动', taskId: result?.task_id };
      }

      case 'generateContent': {
        const result = await taskService?.startContentGeneration(body);
        return { message: '内容生成任务已启动', taskId: result?.task_id };
      }

      case 'getTechnicalPlanState': {
        const state = technicalPlanStore?.loadTechnicalPlan();
        return { state };
      }

      case 'listKnowledgeBase': {
        const index = knowledgeBaseService?.list();
        return { index };
      }

      case 'searchKnowledgeBase': {
        if (!params.query) {
          throw new Error('缺少参数: query');
        }
        // 知识库搜索逻辑
        return { results: [] };
      }

      case 'getPrivateKBCategories': {
        const categories = privateKnowledgeBaseService?.getCategories();
        return { categories };
      }

      case 'listPrivateKBItems': {
        const items = privateKnowledgeBaseService?.listItems(params.category, params.keyword);
        return { items };
      }

      case 'createPrivateKBItem': {
        if (!body.category || !body.title || !body.data) {
          throw new Error('缺少参数: category, title, data');
        }
        const item = privateKnowledgeBaseService?.createItem(body.category, body.title, body.data, body.tags);
        return { item };
      }

      case 'searchPrivateKB': {
        if (!params.query) {
          throw new Error('缺少参数: query');
        }
        const items = privateKnowledgeBaseService?.searchItems(params.query, params.category, parseInt(params.limit) || 10);
        return { items };
      }

      case 'getPrivateKBRecommendations': {
        if (!params.industry) {
          throw new Error('缺少参数: industry');
        }
        const keywords = params.keywords ? params.keywords.split(',') : [];
        const items = privateKnowledgeBaseService?.getRecommendations(params.industry, keywords, parseInt(params.limit) || 5);
        return { items };
      }

      case 'aiChat': {
        if (!body.messages) {
          throw new Error('缺少参数: messages');
        }
        const response = await aiService?.chat(body.messages, body.options);
        return { response };
      }

      case 'aiComplete': {
        if (!body.prompt) {
          throw new Error('缺少参数: prompt');
        }
        const response = await aiService?.complete(body.prompt, body.options);
        return { response };
      }

      default:
        throw new Error(`未实现的处理器: ${handler}`);
    }
  }

  /**
   * 启动服务器
   */
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
      logInfo(`[api] 健康检查: http://localhost:${port}/api/v1/health`);
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

  /**
   * 停止服务器
   */
  function stop() {
    if (server) {
      server.close(() => {
        isRunning = false;
        logInfo('[api] API 服务器已停止');
      });
    }
  }

  /**
   * 获取服务器状态
   */
  function getStatus() {
    return {
      isRunning,
      port,
      apiKey: apiKey ? '已设置' : '未设置',
    };
  }

  /**
   * 设置 API 密钥
   */
  function setApiKey(key) {
    apiKey = key;
    logInfo('[api] API 密钥已更新');
  }

  return {
    start,
    stop,
    getStatus,
    setApiKey,
  };
}

module.exports = {
  createApiServer,
  API_VERSION,
  DEFAULT_PORT,
};
