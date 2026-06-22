/**
 * 私有知识库服务
 * 企业专属标书知识库，支持存储企业简介、团队信息、案例库、过往中标方案等
 */

const fs = require('node:fs');
const path = require('node:path');
const { dialog } = require('electron');
const { logInfo, logError } = require('../utils/logger.cjs');
const { parseDocumentWithConfig } = require('./fileService.cjs');

// 知识库分类定义
const KNOWLEDGE_CATEGORIES = {
  company: {
    id: 'company',
    name: '企业简介',
    description: '公司基本信息、资质、优势',
    icon: '🏢',
    fields: [
      { id: 'name', name: '公司名称', type: 'text', required: true },
      { id: 'established', name: '成立时间', type: 'date' },
      { id: 'registered_capital', name: '注册资本', type: 'text' },
      { id: 'address', name: '公司地址', type: 'text' },
      { id: 'description', name: '公司简介', type: 'textarea' },
      { id: 'advantages', name: '核心优势', type: 'textarea' },
      { id: 'certifications', name: '资质证书', type: 'textarea' },
      { id: 'contact', name: '联系方式', type: 'text' },
    ],
  },
  team: {
    id: 'team',
    name: '团队信息',
    description: '核心团队成员、技术骨干',
    icon: '👥',
    fields: [
      { id: 'name', name: '姓名', type: 'text', required: true },
      { id: 'position', name: '职位', type: 'text', required: true },
      { id: 'title', name: '职称', type: 'text' },
      { id: 'experience', name: '工作年限', type: 'number' },
      { id: 'expertise', name: '专业领域', type: 'text' },
      { id: 'achievements', name: '主要成就', type: 'textarea' },
      { id: 'certificates', name: '资质证书', type: 'textarea' },
      { id: 'education', name: '学历', type: 'text' },
    ],
  },
  cases: {
    id: 'cases',
    name: '案例库',
    description: '过往项目案例、成功经验',
    icon: '📋',
    fields: [
      { id: 'project_name', name: '项目名称', type: 'text', required: true },
      { id: 'client', name: '客户名称', type: 'text' },
      { id: 'industry', name: '所属行业', type: 'select', options: ['IT/信息化', '建筑工程', '医疗健康', '教育服务', '制造业', '物流运输', '咨询服务', '其他'] },
      { id: 'contract_amount', name: '合同金额', type: 'text' },
      { id: 'start_date', name: '开始时间', type: 'date' },
      { id: 'end_date', name: '结束时间', type: 'date' },
      { id: 'description', name: '项目描述', type: 'textarea' },
      { id: 'highlights', name: '项目亮点', type: 'textarea' },
      { id: 'feedback', name: '客户评价', type: 'textarea' },
    ],
  },
  winning_bids: {
    id: 'winning_bids',
    name: '中标方案',
    description: '过往中标的技术方案',
    icon: '🏆',
    fields: [
      { id: 'project_name', name: '项目名称', type: 'text', required: true },
      { id: 'bid_number', name: '招标编号', type: 'text' },
      { id: 'client', name: '招标单位', type: 'text' },
      { id: 'industry', name: '所属行业', type: 'select', options: ['IT/信息化', '建筑工程', '医疗健康', '教育服务', '制造业', '物流运输', '咨询服务', '其他'] },
      { id: 'bid_amount', name: '中标金额', type: 'text' },
      { id: 'bid_date', name: '中标时间', type: 'date' },
      { id: 'competitors', name: '竞争对手', type: 'text' },
      { id: 'winning_points', name: '中标要点', type: 'textarea' },
      { id: 'tech_highlights', name: '技术亮点', type: 'textarea' },
      { id: 'content_summary', name: '方案摘要', type: 'textarea' },
    ],
  },
  templates: {
    id: 'templates',
    name: '方案模板',
    description: '可复用的技术方案模板',
    icon: '📄',
    fields: [
      { id: 'name', name: '模板名称', type: 'text', required: true },
      { id: 'category', name: '适用类别', type: 'select', options: ['技术方案', '商务方案', '实施方案', '服务方案', '其他'] },
      { id: 'industry', name: '适用行业', type: 'select', options: ['IT/信息化', '建筑工程', '医疗健康', '教育服务', '制造业', '物流运输', '咨询服务', '通用'] },
      { id: 'description', name: '模板说明', type: 'textarea' },
      { id: 'content', name: '模板内容', type: 'textarea' },
      { id: 'tags', name: '标签', type: 'text' },
    ],
  },
  reusable_blocks: {
    id: 'reusable_blocks',
    name: '可复用内容',
    description: '通用内容块，如公司简介、售后承诺等',
    icon: '🧩',
    fields: [
      { id: 'title', name: '内容标题', type: 'text', required: true },
      { id: 'category', name: '内容类别', type: 'select', options: ['公司简介', '团队介绍', '技术能力', '服务体系', '质量保证', '售后承诺', '安全措施', '其他'] },
      { id: 'content', name: '内容', type: 'textarea', required: true },
      { id: 'tags', name: '标签', type: 'text' },
      { id: 'usage_count', name: '使用次数', type: 'number' },
    ],
  },
};

/**
 * 创建私有知识库服务
 */
function createPrivateKnowledgeBaseService({ db, app, aiService, configStore }) {
  // 初始化数据库表
  initializeDatabase(db);

  /**
   * 初始化数据库
   */
  function initializeDatabase(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS private_knowledge_items (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        data_json TEXT NOT NULL,
        tags TEXT,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_private_knowledge_category
        ON private_knowledge_items(category);

      CREATE INDEX IF NOT EXISTS idx_private_knowledge_title
        ON private_knowledge_items(title);
    `);
  }

  /**
   * 获取当前时间
   */
  function now() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  /**
   * 创建知识项
   */
  function createItem(category, title, data, tags = []) {
    const id = `pkb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowStr = now();

    const stmt = db.prepare(`
      INSERT INTO private_knowledge_items (id, category, title, data_json, tags, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(id, category, title, JSON.stringify(data), JSON.stringify(tags), nowStr, nowStr);

    logInfo('[private-kb] 创建知识项', { id, category, title });

    return { id, category, title, data, tags, usage_count: 0, created_at: nowStr, updated_at: nowStr };
  }

  /**
   * 更新知识项
   */
  function updateItem(id, updates) {
    const item = getItem(id);
    if (!item) {
      throw new Error(`知识项不存在: ${id}`);
    }

    const nowStr = now();
    const stmt = db.prepare(`
      UPDATE private_knowledge_items
      SET title = ?, data_json = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `);

    const newTitle = updates.title || item.title;
    const newData = { ...item.data, ...updates.data };
    const newTags = updates.tags || item.tags;

    stmt.run(newTitle, JSON.stringify(newData), JSON.stringify(newTags), nowStr, id);

    logInfo('[private-kb] 更新知识项', { id });

    return { ...item, title: newTitle, data: newData, tags: newTags, updated_at: nowStr };
  }

  /**
   * 删除知识项
   */
  function deleteItem(id) {
    const stmt = db.prepare('DELETE FROM private_knowledge_items WHERE id = ?');
    const result = stmt.run(id);

    logInfo('[private-kb] 删除知识项', { id, changes: result.changes });

    return result.changes > 0;
  }

  /**
   * 获取单个知识项
   */
  function getItem(id) {
    const row = db.prepare('SELECT * FROM private_knowledge_items WHERE id = ?').get(id);
    if (!row) return null;

    return {
      id: row.id,
      category: row.category,
      title: row.title,
      data: JSON.parse(row.data_json),
      tags: JSON.parse(row.tags || '[]'),
      usage_count: row.usage_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * 列出知识项
   */
  function listItems(category = null, keyword = null) {
    let sql = 'SELECT * FROM private_knowledge_items WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (keyword) {
      sql += ' AND (title LIKE ? OR data_json LIKE ? OR tags LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    sql += ' ORDER BY usage_count DESC, updated_at DESC';

    const rows = db.prepare(sql).all(...params);

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      data: JSON.parse(row.data_json),
      tags: JSON.parse(row.tags || '[]'),
      usage_count: row.usage_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * 增加使用次数
   */
  function incrementUsage(id) {
    db.prepare('UPDATE private_knowledge_items SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }

  /**
   * 按类别统计
   */
  function getStatistics() {
    const rows = db.prepare(`
      SELECT category, COUNT(*) as count, SUM(usage_count) as total_usage
      FROM private_knowledge_items
      GROUP BY category
    `).all();

    const stats = {};
    for (const row of rows) {
      stats[row.category] = {
        count: row.count,
        total_usage: row.total_usage || 0,
      };
    }

    return stats;
  }

  /**
   * 搜索知识项（支持模糊匹配）
   */
  function searchItems(query, category = null, limit = 10) {
    const items = listItems(category, query);
    return items.slice(0, limit);
  }

  /**
   * 获取推荐内容（基于行业和关键词）
   */
  function getRecommendations(industry, keywords = [], limit = 5) {
    // 先搜索匹配的知识项
    const results = [];

    // 搜索案例
    const cases = listItems('cases');
    for (const caseItem of cases) {
      if (caseItem.data.industry === industry || keywords.some((k) => JSON.stringify(caseItem).includes(k))) {
        results.push({ ...caseItem, relevance: caseItem.data.industry === industry ? 2 : 1 });
      }
    }

    // 搜索中标方案
    const winningBids = listItems('winning_bids');
    for (const bid of winningBids) {
      if (bid.data.industry === industry || keywords.some((k) => JSON.stringify(bid).includes(k))) {
        results.push({ ...bid, relevance: bid.data.industry === industry ? 2 : 1 });
      }
    }

    // 搜索可复用内容
    const blocks = listItems('reusable_blocks');
    for (const block of blocks) {
      if (keywords.some((k) => JSON.stringify(block).includes(k))) {
        results.push({ ...block, relevance: 1 });
      }
    }

    // 按相关性和使用次数排序
    results.sort((a, b) => {
      if (a.relevance !== b.relevance) return b.relevance - a.relevance;
      return b.usage_count - a.usage_count;
    });

    return results.slice(0, limit).map(({ relevance, ...item }) => item);
  }

  /**
   * 批量导入知识项
   */
  function importItems(items) {
    const results = { success: 0, failed: 0, errors: [] };

    for (const item of items) {
      try {
        if (!item.category || !item.title || !item.data) {
          throw new Error('缺少必填字段: category, title, data');
        }

        if (!KNOWLEDGE_CATEGORIES[item.category]) {
          throw new Error(`无效的类别: ${item.category}`);
        }

        createItem(item.category, item.title, item.data, item.tags);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ item, error: error.message });
      }
    }

    logInfo('[private-kb] 批量导入完成', results);

    return results;
  }

  /**
   * 导出所有知识项
   */
  function exportItems(category = null) {
    return listItems(category);
  }

  const SCAN_SUPPORTED_EXTENSIONS = new Set(['.doc', '.docx', '.wps', '.pdf', '.md', '.markdown', '.txt', '.ppt', '.pptx', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp']);

  function scanDirRecursive(dirPath, maxFiles = 500) {
    const results = [];
    function walk(dir) {
      if (results.length >= maxFiles) return;
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (results.length >= maxFiles) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else if (entry.isFile() && SCAN_SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          results.push(fullPath);
        }
      }
    }
    walk(dirPath);
    return results;
  }

  async function scanAndImportDirectory(webContents) {
    if (!app || !aiService || !configStore) {
      throw new Error('目录扫描功能需要 app、aiService 和 configStore 依赖');
    }

    const result = await dialog.showOpenDialog({ title: '选择要批量导入到企业知识库的目录', properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return { canceled: true };

    const dirPath = result.filePaths[0];
    const allFiles = scanDirRecursive(dirPath);
    const config = configStore.load();
    const categoryList = Object.keys(KNOWLEDGE_CATEGORIES).join('、');

    let successCount = 0;
    let failedCount = 0;
    const CONCURRENCY = 3;
    const queue = [...allFiles];
    let activeCount = 0;

    const processOneFile = async (filePath) => {
      const fileName = path.basename(filePath);
      try {
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('private-kb:event', { type: 'scan-progress', filePath, fileName, total: allFiles.length, done: successCount + failedCount });
        }
        const rawMarkdown = await parseDocumentWithConfig(app, filePath, config, { preserveImages: false });
        const markdown = String(rawMarkdown || '').trim();
        if (!markdown) throw new Error('文件解析后为空');

        const prompt = `你是企业知识库助手。请分析以下内容（来源文件：${fileName}），判断它属于哪种企业信息类型（可选值：${categoryList}），提取结构化信息。\n\n文件内容：\n${markdown.slice(0, 4000)}\n\n仅返回 JSON，格式：{ "category": "可选值之一", "title": "简短标题", "summary": "内容摘要（100字以内）", "tags": ["标签1","标签2"] }`;
        const aiResponse = await aiService.chat({ messages: [{ role: 'user', content: prompt }], temperature: 0.3 });
        let parsed;
        try {
          const jsonMatch = String(aiResponse || '').match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          parsed = null;
        }

        const category = (parsed?.category && KNOWLEDGE_CATEGORIES[parsed.category]) ? parsed.category : 'reusable_blocks';
        const title = String(parsed?.title || fileName).trim().slice(0, 100) || fileName;
        const summary = String(parsed?.summary || '').trim().slice(0, 300);
        const tags = Array.isArray(parsed?.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean) : [];
        createItem(category, title, { description: markdown.slice(0, 8000), summary, source_file: fileName }, tags);
        successCount++;
      } catch (err) {
        logError('[private-kb] 扫描导入文件失败', { filePath, error: err.message });
        failedCount++;
      }
      if (webContents && !webContents.isDestroyed()) {
        webContents.send('private-kb:event', { type: 'scan-progress', filePath, fileName, total: allFiles.length, done: successCount + failedCount });
      }
    };

    await new Promise((resolve) => {
      function next() {
        while (activeCount < CONCURRENCY && queue.length > 0) {
          const fp = queue.shift();
          activeCount++;
          processOneFile(fp).finally(() => {
            activeCount--;
            next();
            if (activeCount === 0 && queue.length === 0) resolve();
          });
        }
        if (activeCount === 0 && queue.length === 0) resolve();
      }
      next();
    });

    logInfo('[private-kb] 目录扫描导入完成', { total: allFiles.length, success: successCount, failed: failedCount });
    return { canceled: false, total: allFiles.length, success: successCount, failed: failedCount };
  }

  return {
    getCategories: () => KNOWLEDGE_CATEGORIES,
    createItem,
    updateItem,
    deleteItem,
    getItem,
    listItems,
    searchItems,
    getRecommendations,
    getStatistics,
    incrementUsage,
    importItems,
    exportItems,
    scanAndImportDirectory,
  };
}

module.exports = {
  createPrivateKnowledgeBaseService,
  KNOWLEDGE_CATEGORIES,
};
