/**
 * 文档拆分服务
 * 将招标文件按章节拆分，提取结构化内容
 * 参考: ProposalLLM Extract_Word.py
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * 从 Word 文档提取内容块
 * 注意：此服务使用 mammoth 库进行文档解析
 * 需要安装：npm install mammoth
 */
async function extractDocumentBlocks(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ path: filePath });
    const html = result.value;

    // 解析 HTML 提取结构化内容
    const blocks = parseHtmlToBlocks(html);
    return {
      success: true,
      blocks,
      messages: result.messages,
    };
  } catch (error) {
    console.error('[document-splitter] 提取文档内容失败:', error.message);
    return {
      success: false,
      error: error.message,
      blocks: [],
    };
  }
}

/**
 * 解析 HTML 为结构化块
 * @param {string} html - HTML 内容
 * @returns {Array<Object>} 内容块数组
 */
function parseHtmlToBlocks(html) {
  const blocks = [];
  const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const listRegex = /<[ou]l[^>]*>([\s\S]*?)<\/[ou]l>/gi;

  // 提取所有内容块
  let lastIndex = 0;
  let match;

  // 提取标题
  const headings = [];
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: stripHtml(match[2]),
      index: match.index,
    });
  }

  // 提取段落
  const paragraphs = [];
  while ((match = paragraphRegex.exec(html)) !== null) {
    paragraphs.push({
      text: stripHtml(match[1]),
      index: match.index,
    });
  }

  // 提取表格
  const tables = [];
  while ((match = tableRegex.exec(html)) !== null) {
    tables.push({
      html: match[1],
      index: match.index,
    });
  }

  // 提取列表
  const lists = [];
  while ((match = listRegex.exec(html)) !== null) {
    lists.push({
      html: match[1],
      index: match.index,
    });
  }

  // 按位置排序并构建结构化块
  const allItems = [
    ...headings.map((h) => ({ ...h, type: 'heading' })),
    ...paragraphs.map((p) => ({ ...p, type: 'paragraph' })),
    ...tables.map((t) => ({ ...t, type: 'table' })),
    ...lists.map((l) => ({ ...l, type: 'list' })),
  ].sort((a, b) => a.index - b.index);

  // 构建层级结构
  let currentSection = null;
  for (const item of allItems) {
    if (item.type === 'heading') {
      currentSection = {
        level: item.level,
        title: item.text,
        content: [],
      };
      blocks.push(currentSection);
    } else if (currentSection) {
      currentSection.content.push(item);
    } else {
      // 没有标题的内容块
      blocks.push({
        level: 0,
        title: '前言',
        content: [item],
      });
    }
  }

  return blocks;
}

/**
 * 去除 HTML 标签
 * @param {string} html - HTML 字符串
 * @returns {string} 纯文本
 */
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * 按章节拆分文档
 * @param {string} filePath - 文档路径
 * @returns {Promise<Object>} 拆分结果
 */
async function splitDocumentBySections(filePath) {
  const result = await extractDocumentBlocks(filePath);
  if (!result.success) {
    return result;
  }

  const sections = [];
  let currentSection = null;

  for (const block of result.blocks) {
    if (block.level === 1) {
      // 一级标题作为主章节
      currentSection = {
        title: block.title,
        level: block.level,
        subsections: [],
        content: [],
      };
      sections.push(currentSection);
    } else if (block.level === 2 && currentSection) {
      // 二级标题作为子章节
      const subsection = {
        title: block.title,
        level: block.level,
        content: block.content,
      };
      currentSection.subsections.push(subsection);
    } else if (currentSection) {
      // 其他内容添加到当前章节
      currentSection.content.push(...block.content);
    }
  }

  return {
    success: true,
    sections,
    totalSections: sections.length,
  };
}

/**
 * 提取关键信息
 * @param {Array<Object>} sections - 章节数组
 * @returns {Object} 关键信息
 */
function extractKeyInformation(sections) {
  const info = {
    projectNames: [],
    requirements: [],
    dates: [],
    amounts: [],
    organizations: [],
  };

  const textContent = sections
    .flatMap((s) => [
      s.title,
      ...s.content.map((c) => c.text || ''),
      ...s.subsections.map((sub) => sub.title),
    ])
    .join(' ');

  // 提取项目名称（通常在标题中）
  const projectMatch = textContent.match(/关于[《「]([^》」]+)[》」]的?项目/);
  if (projectMatch) {
    info.projectNames.push(projectMatch[1]);
  }

  // 提取日期
  const dateRegex = /\d{4}年\d{1,2}月\d{1,2}日/g;
  const dateMatches = textContent.match(dateRegex);
  if (dateMatches) {
    info.dates.push(...dateMatches);
  }

  // 提取金额
  const amountRegex = /(\d+(?:\.\d+)?)\s*(?:万元|元)/g;
  let amountMatch;
  while ((amountMatch = amountRegex.exec(textContent)) !== null) {
    info.amounts.push(amountMatch[0]);
  }

  // 提取组织机构
  const orgKeywords = ['公司', '集团', '委员会', '局', '院', '中心', '协会'];
  for (const keyword of orgKeywords) {
    const orgRegex = new RegExp(`[\\u4e00-\\u9fa5]+${keyword}`, 'g');
    const orgMatches = textContent.match(orgRegex);
    if (orgMatches) {
      info.organizations.push(...orgMatches.slice(0, 5)); // 限制数量
    }
  }

  return info;
}

/**
 * 生成拆分报告
 * @param {Object} splitResult - 拆分结果
 * @returns {string} Markdown 格式报告
 */
function generateSplitReport(splitResult) {
  if (!splitResult.success) {
    return `# 文档拆分失败\n\n错误：${splitResult.error}`;
  }

  const lines = [
    '# 文档拆分报告',
    '',
    `## 概览`,
    `- 总章节数：${splitResult.totalSections}`,
    '',
    '## 章节结构',
    '',
  ];

  for (const section of splitResult.sections) {
    lines.push(`### ${section.title}`);
    if (section.subsections.length > 0) {
      for (const sub of section.subsections) {
        lines.push(`- ${sub.title}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 创建文档拆分服务实例
 */
function createDocumentSplitterService() {
  return {
    extractDocumentBlocks,
    splitDocumentBySections,
    extractKeyInformation,
    generateSplitReport,
  };
}

module.exports = {
  createDocumentSplitterService,
  extractDocumentBlocks,
  splitDocumentBySections,
  extractKeyInformation,
  generateSplitReport,
};
