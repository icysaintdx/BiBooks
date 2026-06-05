/**
 * 智能排版服务
 * 自动格式化技术方案内容，统一标题层级、段落间距、列表样式、表格格式
 */

/**
 * 标准化标题层级
 * 确保标题从一级开始，层级连续不断裂
 */
function normalizeHeadingLevels(content) {
  const lines = content.split('\n');
  const result = [];
  let minLevel = 7;

  // 第一遍：找到最小标题层级
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s/);
    if (match) {
      minLevel = Math.min(minLevel, match[1].length);
    }
  }

  if (minLevel === 7) return content; // 没有标题

  // 第二遍：调整标题层级
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s(.+)/);
    if (match) {
      const currentLevel = match[1].length;
      const newLevel = Math.min(currentLevel - minLevel + 1, 4); // 最多到四级标题
      result.push('#'.repeat(newLevel) + ' ' + match[2]);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * 标准化段落间距
 * 确保段落之间有适当的空行
 */
function normalizeSpacing(content) {
  // 将连续多个空行合并为两个空行
  let result = content.replace(/\n{4,}/g, '\n\n\n');

  // 确保标题前后有空行
  result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  result = result.replace(/(#{1,6}\s[^\n]+)\n([^\n])/g, '$1\n\n$2');

  // 确保列表前后有空行（但列表项之间不需要）
  result = result.replace(/([^\n])\n([-*]\s)/g, '$1\n\n$2');
  result = result.replace(/([-*]\s[^\n]+)\n([^\n\-*])/g, '$1\n\n$2');

  // 确保代码块前后有空行
  result = result.replace(/([^\n])\n```/g, '$1\n\n```');
  result = result.replace(/```\n([^\n])/g, '```\n\n$1');

  // 确保表格前后有空行
  result = result.replace(/([^\n])\n(\|)/g, '$1\n\n$2');
  result = result.replace(/(\|[^\n]+)\n([^\n|])/g, '$1\n\n$2');

  // 清理首尾空行
  result = result.trim();

  return result;
}

/**
 * 标准化列表样式
 * 统一使用 - 作为无序列表标记
 */
function normalizeListStyle(content) {
  // 将 * 和 + 替换为 -
  const lines = content.split('\n');
  const result = [];

  for (const line of lines) {
    // 替换无序列表标记
    const match = line.match(/^(\s*)([*+])\s(.+)/);
    if (match) {
      result.push(`${match[1]}- ${match[3]}`);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * 标准化表格格式
 * 确保表格对齐和格式一致
 */
function normalizeTableFormat(content) {
  const lines = content.split('\n');
  const result = [];
  let inTable = false;
  let tableLines = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableLines = [];
      }
      tableLines.push(trimmed);
    } else {
      if (inTable) {
        result.push(...formatTable(tableLines));
        inTable = false;
        tableLines = [];
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(...formatTable(tableLines));
  }

  return result.join('\n');
}

function formatTable(lines) {
  if (lines.length < 2) return lines;

  const result = [];
  const rows = lines.map((line) =>
    line.split('|').filter((cell) => cell.trim() !== '').map((cell) => cell.trim())
  );

  // 找到最大列数
  const maxCols = Math.max(...rows.map((row) => row.length));

  // 标准化每行的列数
  const normalizedRows = rows.map((row) => {
    while (row.length < maxCols) row.push('');
    return row;
  });

  // 输出表头
  result.push('| ' + normalizedRows[0].join(' | ') + ' |');
  result.push('| ' + normalizedRows[0].map(() => '---').join(' | ') + ' |');

  // 输出数据行
  for (let i = 1; i < normalizedRows.length; i++) {
    // 跳过分隔行
    if (normalizedRows[i].every((cell) => /^[-:]+$/.test(cell))) continue;
    result.push('| ' + normalizedRows[i].join(' | ') + ' |');
  }

  return result;
}

/**
 * 标准化代码块
 * 确保代码块有语言标识
 */
function normalizeCodeBlocks(content) {
  // 为没有语言标识的代码块添加默认标识
  return content.replace(/```\n/g, '```text\n');
}

/**
 * 清理冗余内容
 * 删除重复的空行、多余的空格等
 */
function cleanContent(content) {
  let result = content;

  // 删除行尾空格
  result = result.replace(/[ \t]+$/gm, '');

  // 将 tab 替换为空格
  result = result.replace(/\t/g, '  ');

  // 删除多余空行（保留最多两个连续空行）
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * 智能排版主函数
 * 对内容进行完整的格式化处理
 */
function smartFormat(content) {
  if (!content || typeof content !== 'string') {
    return { text: content || '', changes: [] };
  }

  const changes = [];
  let result = content;

  // 1. 清理冗余内容
  const cleaned = cleanContent(result);
  if (cleaned !== result) {
    changes.push('清理冗余空行和行尾空格');
    result = cleaned;
  }

  // 2. 标准化标题层级
  const headingsNormalized = normalizeHeadingLevels(result);
  if (headingsNormalized !== result) {
    changes.push('标准化标题层级');
    result = headingsNormalized;
  }

  // 3. 标准化列表样式
  const listsNormalized = normalizeListStyle(result);
  if (listsNormalized !== result) {
    changes.push('统一列表标记为 -');
    result = listsNormalized;
  }

  // 4. 标准化表格格式
  const tablesNormalized = normalizeTableFormat(result);
  if (tablesNormalized !== result) {
    changes.push('标准化表格格式');
    result = tablesNormalized;
  }

  // 5. 标准化代码块
  const codeNormalized = normalizeCodeBlocks(result);
  if (codeNormalized !== result) {
    changes.push('补充代码块语言标识');
    result = codeNormalized;
  }

  // 6. 标准化段落间距
  const spacingNormalized = normalizeSpacing(result);
  if (spacingNormalized !== result) {
    changes.push('标准化段落间距');
    result = spacingNormalized;
  }

  return { text: result, changes };
}

/**
 * 格式化单个章节内容
 * 适用于内容生成后的格式化
 */
function formatChapter(content, chapterTitle) {
  if (!content) return content;

  // 如果内容不以标题开头，添加章节标题
  if (chapterTitle && !content.trim().startsWith('#')) {
    content = `## ${chapterTitle}\n\n${content}`;
  }

  return smartFormat(content).text;
}

module.exports = {
  smartFormat,
  formatChapter,
  normalizeHeadingLevels,
  normalizeSpacing,
  normalizeListStyle,
  normalizeTableFormat,
  normalizeCodeBlocks,
  cleanContent,
};
