function countMatches(text, pattern) {
  const matches = String(text || '').match(pattern);
  return matches ? matches.length : 0;
}

function countMarkdownTables(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let count = 0;
  let rows = 0;
  let maxColumns = 0;

  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1];
    if (!/^\s*\|.*\|\s*$/.test(line)) continue;
    if (!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(nextLine)) continue;
    count += 1;
    const columnCount = line.split('|').filter((cell) => cell.trim()).length;
    maxColumns = Math.max(maxColumns, columnCount);
    index += 2;
    while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
      rows += 1;
      index += 1;
    }
    index -= 1;
  }

  return { count, rows, maxColumns };
}

function ratio(part, total) {
  return total ? Number((part / total).toFixed(4)) : 0;
}

function analyzeParsedMarkdown(markdown) {
  const text = String(markdown || '');
  const chars = text.length;
  const nonWhitespaceChars = text.replace(/\s/g, '').length;
  const cjkChars = countMatches(text, /[\u3400-\u9fff]/g);
  const replacementChars = countMatches(text, /�/g);
  const mojibakeFragments = countMatches(text, /(?:Ã|Â|â€|锟|鏂|鎶|绛|勫|忕|€|™|œ||)/g);
  const imageMarkdownCount = countMatches(text, /!\[[^\]]*\]\([^)]*\)/g);
  const htmlImageCount = countMatches(text, /<img\b/gi);
  const headingCount = countMatches(text, /^#{1,6}\s+.+$/gm);
  const table = countMarkdownTables(text);
  const pipeLineCount = text.split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line)).length;
  const orphanPipeLines = Math.max(0, pipeLineCount - table.rows - table.count * 2);
  const warnings = [];

  if (!chars) {
    warnings.push({ level: 'high', code: 'empty_content', message: '解析结果为空，请检查文件是否可读或解析器是否失败。' });
  }
  if (chars > 0 && cjkChars < 80 && ratio(cjkChars, nonWhitespaceChars) < 0.08) {
    warnings.push({ level: 'medium', code: 'low_chinese_ratio', message: '中文正文占比较低，可能存在扫描件未 OCR、解析不完整或内容不是中文标书。' });
  }
  if (replacementChars > 0 || mojibakeFragments > 3) {
    warnings.push({ level: 'high', code: 'suspected_mojibake', message: '解析结果存在疑似乱码片段，需要人工核对原文。' });
  }
  if (pipeLineCount > 0 && table.count === 0) {
    warnings.push({ level: 'medium', code: 'table_not_recognized', message: '检测到表格样式文本，但未识别为标准 Markdown 表格，后续导出可能无法生成真实 Word 表格。' });
  }
  if (orphanPipeLines > 5) {
    warnings.push({ level: 'medium', code: 'orphan_table_rows', message: '存在较多非标准表格行，建议检查表格是否被解析断裂。' });
  }
  if (imageMarkdownCount + htmlImageCount > 0 && chars < 2000) {
    warnings.push({ level: 'medium', code: 'image_heavy_document', message: '解析结果图片占比较高且文本较少，可能存在扫描页或图片表格未充分 OCR。' });
  }

  return {
    chars,
    nonWhitespaceChars,
    chineseCharRatio: ratio(cjkChars, nonWhitespaceChars),
    headingCount,
    tableCount: table.count,
    tableRowCount: table.rows,
    tableMaxColumns: table.maxColumns,
    pipeLineCount,
    orphanPipeLineCount: orphanPipeLines,
    imageCount: imageMarkdownCount + htmlImageCount,
    suspectedMojibakeCount: replacementChars + mojibakeFragments,
    warnings,
    summary: warnings.length
      ? `发现 ${warnings.length} 个解析质量提示，建议导出前人工核对。`
      : '解析质量检查未发现明显风险。',
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  analyzeParsedMarkdown,
};
