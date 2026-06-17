const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { fileURLToPath } = require('node:url');
const { app, dialog, nativeImage } = require('electron');
const cheerio = require('cheerio');
const { imageSize } = require('image-size');
const { compactLogError, createDeveloperLogger, textMetrics } = require('../utils/developerLog.cjs');
const { getGeneratedImagesDir, getImportedImagesDir } = require('../utils/paths.cjs');
const { getDocxDefaultStyles, getPageSettings, loadCustomFonts, getFontName } = require('./fontConfig.cjs');
const {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  Header,
  ImageRun,
  LevelFormat,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} = require('docx');
const { generateCoverParagraphs } = require('./coverGenerator.cjs');
const { generateTocParagraphs } = require('./tocGenerator.cjs');

const MAX_IMAGE_WIDTH = 520;
const NUMBERING_REFERENCE_PREFIX = 'technical-plan-numbering';
const DOCX_TABLE_WIDTH_TWIPS = 9000;
const MERMAID_EXPORT_RETRY_ATTEMPTS = 2;
const MERMAID_EXPORT_RETRY_DELAY_MS = 3000;

function encodeMermaidForInk(code) {
  const state = JSON.stringify({
    code: String(code || ''),
    mermaid: { theme: 'default' },
  });
  return `pako:${zlib.deflateSync(Buffer.from(state, 'utf-8')).toString('base64url')}`;
}

function mermaidInkUrl(code) {
  return `https://mermaid.ink/img/${encodeMermaidForInk(code)}?type=png&bgColor=!white`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPercent(value) {
  return Math.max(0, Math.min(Math.round(Number(value) || 0), 100));
}

function reportProgress(context, progress, message, extra = {}) {
  if (!context?.onProgress) return;
  try {
    context.onProgress({
      phase: extra.phase || 'running',
      progress: clampPercent(progress),
      message,
      warnings: [...(context.warnings || [])],
      ...extra,
    });
  } catch (error) {
    console.warn('[export-word] progress callback failed', error);
  }
}

function reportConversionProgress(context, message) {
  const stats = context?.stats || {};
  const total = Math.max(1, (stats.leafCount || 0) + (stats.mermaidCount || 0));
  const done = Math.min(total, (context.convertedLeafCount || 0) + (context.convertedMermaidCount || 0));
  reportProgress(context, 10 + (done / total) * 78, message);
}

function writeExportLog(context, event, payload = {}) {
  if (!context?.developerLogger?.enabled) return;
  context.developerLogger.write(event, payload);
}

function addWarning(context, message) {
  if (context?.warnings) {
    context.warnings.push(message);
  }
  writeExportLog(context, 'export.warning', { message });
  console.warn(`[export-word] ${message}`);
}

function addUnsupportedHtmlWarning(context, tagName) {
  const tag = String(tagName || '').toLowerCase();
  if (!tag) return;
  if (!context.unsupportedHtmlTags) {
    context.unsupportedHtmlTags = new Set();
  }
  if (context.unsupportedHtmlTags.has(tag)) {
    return;
  }
  context.unsupportedHtmlTags.add(tag);
  addWarning(context, `HTML 标签 <${tag}> 导出时已降级，请核对 Word 内容。`);
}

function compactText(value, maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function countMermaidBlocks(content) {
  return (String(content || '').match(/```mermaid[\s\S]*?```/gi) || []).length;
}

function countOutlineStats(items = []) {
  let leafCount = 0;
  let mermaidCount = 0;

  for (const item of items || []) {
    if (item.children?.length) {
      const childStats = countOutlineStats(item.children);
      leafCount += childStats.leafCount;
      mermaidCount += childStats.mermaidCount;
    } else {
      leafCount += 1;
      mermaidCount += countMermaidBlocks(item.content);
    }
  }

  return { leafCount, mermaidCount };
}

function collectOutlineContents(items = []) {
  const contents = [];
  for (const item of items || []) {
    if (item.children?.length) {
      contents.push(...collectOutlineContents(item.children));
    } else {
      contents.push(String(item.content || ''));
    }
  }
  return contents;
}

function countOutlineContentMetrics(items = []) {
  const contents = collectOutlineContents(items);
  return {
    ...textMetrics(contents.join('\n\n')),
    leaf_content_count: contents.filter((content) => content.trim()).length,
  };
}

function loadDeveloperConfig(configStore) {
  try {
    return configStore?.load?.() || {};
  } catch {
    return {};
  }
}

function sanitizeFilename(value) {
  return String(value || '标书文档')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || '标书文档';
}

function cleanText(value) {
  return String(value || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function safeHexColor(value, fallback) {
  const color = String(value || '').replace(/^#/, '').trim();
  return /^[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function mmToTwips(value) {
  return Math.round(numberInRange(value, 0, 0, 500) * 56.7);
}

function ptToHalfPoints(value, fallback) {
  return Math.round(numberInRange(value, fallback, 6, 72) * 2);
}

function lineSpacingToTwips(value) {
  return Math.round(numberInRange(value, 1.5, 1, 3) * 240);
}

function normalizeAlignment(value, fallback = AlignmentType.START) {
  if (value === 'center') return AlignmentType.CENTER;
  if (value === 'right') return AlignmentType.RIGHT;
  if (value === 'both' || value === 'justified') return AlignmentType.JUSTIFIED;
  if (value === 'left' || value === 'start') return AlignmentType.START;
  return fallback;
}

function replaceTemplateVariables(value, payload = {}) {
  const replacements = {
    项目名称: payload.project_name || payload.projectName || '',
    投标单位: payload.bidder_name || payload.bidderName || '',
    招标单位: payload.tenderer_name || payload.tendererName || '',
    日期: payload.date || '',
  };
  return String(value || '').replace(/\{([^{}]+)\}/g, (match, key) => (
    replacements[key] !== undefined ? replacements[key] : match
  ));
}

function coverValue(value, payload, fallback = '') {
  const text = replaceTemplateVariables(value || '', payload).trim();
  return text || fallback;
}

function resolveLayoutTemplate(options = {}) {
  if (options.layoutTemplate) {
    return options.layoutTemplate;
  }
  if (options.config?.layout_template) {
    return options.config.layout_template;
  }
  if (options.configStore?.load) {
    try {
      return options.configStore.load()?.layout_template || null;
    } catch {
      return null;
    }
  }
  return null;
}

function buildLayoutContext(layoutTemplate) {
  const officialStyles = getDocxDefaultStyles();
  const officialPageSettings = getPageSettings();
  const template = layoutTemplate && typeof layoutTemplate === 'object' ? layoutTemplate : null;
  const typography = template?.typography || {};
  const page = template?.page || {};
  const tables = template?.tables || {};
  const images = template?.images || {};
  const bodyFont = String(typography.body_font || officialStyles.body.run.font || getFontName('body')).trim();
  const bodySize = ptToHalfPoints(typography.body_size_pt, officialStyles.body.run.size / 2);
  const lineSpacing = lineSpacingToTwips(typography.line_spacing);
  const firstLineIndent = Math.round(numberInRange(typography.first_line_indent_chars, 2, 0, 4) * (bodySize / 2) * 20);
  const headingStyles = {};

  for (const heading of template?.headings || []) {
    const level = Number(heading?.level);
    if (!Number.isInteger(level) || level < 1 || level > 6) continue;
    headingStyles[level] = {
      run: {
        font: String(heading.font || bodyFont).trim() || bodyFont,
        size: ptToHalfPoints(heading.size_pt, level === 1 ? 16 : 14),
        bold: heading.bold !== false,
      },
      paragraph: {
        alignment: normalizeAlignment(heading.alignment, level === 1 ? AlignmentType.CENTER : AlignmentType.START),
        spacing: {
          before: level === 1 ? 280 : 180,
          after: 120,
          line: lineSpacing,
        },
      },
    };
  }

  const pageSize = page.size === 'A3'
    ? { width: mmToTwips(297), height: mmToTwips(420) }
    : { width: mmToTwips(210), height: mmToTwips(297) };
  const margin = template?.page
    ? {
      top: mmToTwips(page.margin_top_mm),
      bottom: mmToTwips(page.margin_bottom_mm),
      left: mmToTwips(page.margin_left_mm),
      right: mmToTwips(page.margin_right_mm),
      gutter: mmToTwips(page.gutter_mm),
    }
    : officialPageSettings.margin;

  return {
    template,
    bodyFont,
    bodySize,
    lineSpacing,
    firstLineIndent,
    styles: {
      document: {
        run: { font: bodyFont, size: bodySize },
        paragraph: {
          spacing: { line: lineSpacing, after: 160 },
          indent: firstLineIndent ? { firstLine: firstLineIndent } : undefined,
        },
      },
      heading1: headingStyles[1] || officialStyles.heading1,
      heading2: headingStyles[2] || officialStyles.heading2,
      heading3: headingStyles[3] || {
        run: { font: bodyFont, size: bodySize, bold: true },
        paragraph: { spacing: { before: 160, after: 100, line: lineSpacing } },
      },
      heading4: headingStyles[4] || {
        run: { font: bodyFont, size: bodySize, bold: true },
        paragraph: { spacing: { before: 120, after: 80, line: lineSpacing } },
      },
    },
    pageSettings: {
      size: template?.page ? pageSize : officialPageSettings.size,
      margin,
    },
    table: {
      headerFill: safeHexColor(tables.header_fill, 'F1F6FF'),
      borderColor: safeHexColor(tables.border_color, 'DCDFF6'),
      repeatHeader: tables.repeat_header !== false,
      allowPageBreak: tables.allow_page_break !== false,
    },
    image: {
      maxWidth: Math.round(MAX_IMAGE_WIDTH * (numberInRange(images.max_width_percent, 100, 20, 100) / 100)),
      alignment: images.align === 'left' ? AlignmentType.START : AlignmentType.CENTER,
      captionEnabled: images.caption_enabled !== false,
    },
  };
}

function getLayoutContext(context = {}) {
  if (!context.layout) {
    context.layout = buildLayoutContext();
  }
  return context.layout;
}

function textRun(text, options = {}) {
  const layout = options.layout || buildLayoutContext();
  return new TextRun({
    text: cleanText(text),
    font: options.font || layout.bodyFont,
    size: options.size || layout.bodySize,
    bold: options.bold,
    italics: options.italics,
    strike: options.strike,
    color: options.color,
    underline: options.underline ? { type: UnderlineType.SINGLE } : undefined,
  });
}

function lineBreakRun() {
  return new TextRun({ break: 1 });
}

function textRunsWithBreaks(value, options = {}) {
  const parts = String(value || '').split(/<br\s*\/?\s*>/gi);
  const runs = [];

  parts.forEach((part, index) => {
    if (index > 0) {
      runs.push(lineBreakRun());
    }
    if (part) {
      runs.push(textRun(part, options));
    }
  });

  return runs;
}

function paragraph(children, options = {}) {
  const layout = options.layout || buildLayoutContext();
  const shouldUseDefaultIndent = !options.noIndent && !options.bullet && !options.numbering;
  return new Paragraph({
    children: children?.length ? children : [textRun('', { layout })],
    heading: options.heading,
    alignment: options.alignment,
    bullet: options.bullet,
    numbering: options.numbering,
    spacing: { before: options.before || 0, after: options.after ?? 160, line: options.line || layout.lineSpacing },
    indent: options.indent !== undefined ? options.indent : shouldUseDefaultIndent ? layout.styles.document.paragraph.indent : undefined,
    border: options.border,
    shading: options.shading,
  });
}

function contextTextRun(context, text, options = {}) {
  return textRun(text, { ...options, layout: getLayoutContext(context) });
}

function contextParagraph(context, children, options = {}) {
  return paragraph(children, { ...options, layout: getLayoutContext(context) });
}

function tableBorders(context = {}) {
  const borderColor = getLayoutContext(context).table.borderColor;
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    left: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    right: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
  };
}

function tableColumnWidths(columnCount) {
  const safeCount = Math.max(1, columnCount || 1);
  const base = Math.floor(DOCX_TABLE_WIDTH_TWIPS / safeCount);
  const widths = Array.from({ length: safeCount }, () => base);
  widths[widths.length - 1] += DOCX_TABLE_WIDTH_TWIPS - (base * safeCount);
  return widths;
}

function tableCellWidth(columnSpan, totalColumns) {
  const safeTotal = Math.max(1, totalColumns || 1);
  const safeSpan = Math.max(1, columnSpan || 1);
  return Math.round((DOCX_TABLE_WIDTH_TWIPS * safeSpan) / safeTotal);
}

function createTableCell({ children, context = {}, isHeader = false, columnSpan = 1, totalColumns = 1 }) {
  const safeSpan = Math.max(1, columnSpan || 1);
  const layout = getLayoutContext(context);
  return new TableCell({
    children,
    shading: isHeader ? { type: ShadingType.CLEAR, fill: layout.table.headerFill } : undefined,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    columnSpan: safeSpan > 1 ? safeSpan : undefined,
    width: { size: tableCellWidth(safeSpan, totalColumns), type: WidthType.DXA },
  });
}

function createDocxTable(rows, columnCount, context = {}) {
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: tableColumnWidths(columnCount),
    layout: TableLayoutType.FIXED,
    borders: tableBorders(context),
  });
}

function normalizeColumnSpan(value) {
  const span = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(span) && span > 1 ? span : 1;
}

function isMarkdownTableRowLine(line) {
  return /^\s*\|.*\|\s*$/.test(String(line || ''));
}

function isMarkdownTableDelimiterLine(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || ''));
}

function splitMarkdownTableCells(line) {
  let source = String(line || '').trim();
  if (!source.includes('|')) {
    return [];
  }
  if (source.startsWith('|')) {
    source = source.slice(1);
  }
  if (source.endsWith('|')) {
    source = source.slice(0, -1);
  }

  const cells = [];
  let current = '';
  let escaped = false;
  for (const char of source) {
    if (char === '|' && !escaped) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
    escaped = char === '\\' && !escaped;
  }
  cells.push(current.trim());
  return cells;
}

function isMarkdownTableDelimiterCell(cell) {
  return /^:?-{3,}:?$/.test(String(cell || '').trim());
}

function markdownTableRowIndent(line) {
  const match = /^(\s*)\|/.exec(String(line || ''));
  return match ? match[1] : '';
}

function formatMarkdownTableRow(cells, indent = '') {
  return `${indent}| ${cells.map((cell) => String(cell || '').trim()).join(' | ')} |`;
}

function isMarkdownTableCandidateLine(line) {
  const value = String(line || '').trim();
  if (!value || !value.includes('|')) {
    return false;
  }
  return splitMarkdownTableCells(value).length >= 2;
}

function normalizeMarkdownTableCells(cells, columnCount) {
  const normalized = cells.slice(0, columnCount).map((cell) => String(cell || '').trim());
  while (normalized.length < columnCount) {
    normalized.push('');
  }
  return normalized;
}

function markdownDelimiterForColumnCount(columnCount, indent = '') {
  return formatMarkdownTableRow(Array.from({ length: Math.max(2, columnCount) }, () => '---'), indent);
}

function normalizeMarkdownTableBlock(headerLine, delimiterLine, rowLines = []) {
  const indent = markdownTableRowIndent(headerLine) || markdownTableRowIndent(delimiterLine);
  const headerCells = splitMarkdownTableCells(headerLine);
  const delimiterCells = splitMarkdownTableCells(delimiterLine);
  const bodyRows = rowLines.map(splitMarkdownTableCells);
  const columnCount = Math.max(2, headerCells.length, delimiterCells.length, ...bodyRows.map((cells) => cells.length));
  const lines = [
    formatMarkdownTableRow(normalizeMarkdownTableCells(headerCells, columnCount), indent),
    markdownDelimiterForColumnCount(columnCount, indent),
  ];

  for (const cells of bodyRows) {
    if (cells.some((cell) => String(cell || '').trim())) {
      lines.push(formatMarkdownTableRow(normalizeMarkdownTableCells(cells, columnCount), indent));
    }
  }

  return lines;
}

function expandCompressedMarkdownTableRows(headerLine, nextLine) {
  if (!isMarkdownTableRowLine(headerLine) || !isMarkdownTableRowLine(nextLine)) {
    return null;
  }

  const headerCells = splitMarkdownTableCells(headerLine);
  const nextCells = splitMarkdownTableCells(nextLine);
  const columnCount = headerCells.length;
  if (columnCount < 2 || nextCells.length <= columnCount) {
    return null;
  }

  const delimiterCells = nextCells.slice(0, columnCount);
  if (!delimiterCells.every(isMarkdownTableDelimiterCell)) {
    return null;
  }

  // 模型有时会把分隔行和后续数据行压成同一行，这里按表头列数拆回 GFM 表格。
  const indent = markdownTableRowIndent(headerLine);
  const lines = [formatMarkdownTableRow(headerCells, indent), formatMarkdownTableRow(delimiterCells, indent)];
  const remainingCells = nextCells.slice(columnCount);
  while (remainingCells.length) {
    if (remainingCells.length > columnCount && !remainingCells[0] && remainingCells.length % columnCount !== 0) {
      remainingCells.shift();
      continue;
    }
    const rowCells = remainingCells.splice(0, columnCount);
    if (rowCells.some((cell) => String(cell || '').trim())) {
      lines.push(formatMarkdownTableRow(rowCells, indent));
    }
  }

  return lines;
}

function expandInlineMarkdownTableRows(line) {
  const source = String(line || '');
  if (!/\|\s*:?-{3,}:?\s*\|/.test(source)) {
    return [source];
  }

  const firstPipeIndex = source.indexOf('|');
  if (firstPipeIndex < 0) {
    return [source];
  }

  const prefix = source.slice(0, firstPipeIndex);
  const isIndentedTableLine = /^\s*$/.test(prefix);
  const tableText = source.slice(firstPipeIndex).trim();
  const tableRows = tableText
    .replace(/\|\s+\|/g, '|\n|')
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean);

  if (isIndentedTableLine) {
    return tableRows.map((row) => `${prefix}${row}`);
  }

  return [prefix.trimEnd(), ...tableRows];
}

function normalizeMarkdownTablesForDocx(content) {
  const expandedLines = String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap(expandInlineMarkdownTableRows);
  const lines = [];

  for (let index = 0; index < expandedLines.length; index += 1) {
    const line = expandedLines[index];
    const nextLine = expandedLines[index + 1] || '';
    const compressedTableRows = expandCompressedMarkdownTableRows(line, nextLine);
    const startsCompressedTable = Boolean(compressedTableRows);
    const startsTable = isMarkdownTableCandidateLine(line) && isMarkdownTableDelimiterLine(nextLine);
    const startsPipeTableWithoutDelimiter = isMarkdownTableCandidateLine(line)
      && !isMarkdownTableDelimiterLine(line)
      && isMarkdownTableCandidateLine(nextLine)
      && !isMarkdownTableDelimiterLine(nextLine);
    const previousLine = lines[lines.length - 1] || '';

    if ((startsTable || startsCompressedTable) && previousLine.trim() && !isMarkdownTableRowLine(previousLine)) {
      lines.push('');
    }
    if (compressedTableRows) {
      lines.push(...compressedTableRows);
      index += 1;
      continue;
    }
    if (startsTable) {
      const rowLines = [];
      let cursor = index + 2;
      while (cursor < expandedLines.length && isMarkdownTableCandidateLine(expandedLines[cursor]) && !isMarkdownTableDelimiterLine(expandedLines[cursor])) {
        rowLines.push(expandedLines[cursor]);
        cursor += 1;
      }
      lines.push(...normalizeMarkdownTableBlock(line, nextLine, rowLines));
      if (expandedLines[cursor] && String(expandedLines[cursor]).trim()) {
        lines.push('');
      }
      index = cursor - 1;
      continue;
    }
    if (isMarkdownTableDelimiterLine(line)) {
      const rowLines = [];
      let cursor = index + 1;
      while (cursor < expandedLines.length && isMarkdownTableCandidateLine(expandedLines[cursor]) && !isMarkdownTableDelimiterLine(expandedLines[cursor])) {
        rowLines.push(expandedLines[cursor]);
        cursor += 1;
      }
      if (rowLines.length) {
        const headerLine = rowLines.shift();
        if (previousLine.trim() && !isMarkdownTableCandidateLine(previousLine)) {
          lines.push('');
        }
        lines.push(...normalizeMarkdownTableBlock(headerLine, line, rowLines));
        if (expandedLines[cursor] && String(expandedLines[cursor]).trim()) {
          lines.push('');
        }
        index = cursor - 1;
      }
      continue;
    }
    if (startsPipeTableWithoutDelimiter) {
      const rowLines = [];
      let cursor = index;
      while (cursor < expandedLines.length && isMarkdownTableCandidateLine(expandedLines[cursor]) && !isMarkdownTableDelimiterLine(expandedLines[cursor])) {
        rowLines.push(expandedLines[cursor]);
        cursor += 1;
      }
      if (rowLines.length >= 2) {
        if (previousLine.trim() && !isMarkdownTableCandidateLine(previousLine)) {
          lines.push('');
        }
        const headerLine = rowLines.shift();
        lines.push(...normalizeMarkdownTableBlock(headerLine, markdownDelimiterForColumnCount(splitMarkdownTableCells(headerLine).length), rowLines));
        if (expandedLines[cursor] && String(expandedLines[cursor]).trim()) {
          lines.push('');
        }
        index = cursor - 1;
        continue;
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

function createOrderedListReference(context) {
  if (!context.numberingReferences) {
    context.numberingReferences = [];
  }
  context.numberingIndex = (context.numberingIndex || 0) + 1;
  const reference = `${NUMBERING_REFERENCE_PREFIX}-${context.numberingIndex}`;
  context.numberingReferences.push(reference);
  return reference;
}

function headingLevel(level) {
  if (level <= 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  if (level === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_4;
}

function imageTypeFromMime(mime) {
  if (!mime) return null;
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('bmp')) return 'bmp';
  if (mime.includes('webp')) return 'webp';
  return null;
}

function imageTypeFromPath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase().replace('.', '');
  if (ext === 'jpeg') return 'jpg';
  return ['png', 'jpg', 'gif', 'bmp', 'webp'].includes(ext) ? ext : null;
}

function describeImageSourceForLog(source) {
  const value = String(source || '').trim();
  if (!value) return { kind: 'empty' };
  if (/^data:/i.test(value)) return { kind: 'data-url' };
  try {
    const url = new URL(value);
    if (url.protocol === 'yibiao-asset:') {
      return { kind: 'asset', host: url.hostname, extension: path.extname(url.pathname || '').toLowerCase() };
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return { kind: 'remote', protocol: url.protocol.replace(':', ''), host: url.hostname, extension: path.extname(url.pathname || '').toLowerCase() };
    }
    if (url.protocol === 'file:') {
      return { kind: 'local-file-url', extension: path.extname(url.pathname || '').toLowerCase() };
    }
    return { kind: 'url', protocol: url.protocol.replace(':', '') };
  } catch {
    return { kind: path.isAbsolute(value) ? 'local-path' : 'relative-path', extension: path.extname(value).toLowerCase() };
  }
}

function normalizeImageForDocx(loaded) {
  if (!loaded?.buffer || !loaded.type) {
    return loaded;
  }

  if (loaded.type !== 'webp') {
    return loaded;
  }

  const image = nativeImage?.createFromBuffer ? nativeImage.createFromBuffer(loaded.buffer) : null;
  if (!image || image.isEmpty()) {
    throw new Error('WebP 图片转换失败');
  }

  return { buffer: image.toPNG(), type: 'png' };
}

function resolveAssetImagePath(url) {
  if (!app?.getPath) return null;

  const assetUrl = new URL(url);
  const assetRoots = {
    'generated-images': getGeneratedImagesDir(app),
    'imported-images': getImportedImagesDir(app),
  };
  const rootDir = assetRoots[assetUrl.hostname];
  if (!rootDir) return null;

  const relativePath = decodeURIComponent(assetUrl.pathname.replace(/^\/+/, ''));
  if (!relativePath) return null;

  const baseDir = path.resolve(rootDir);
  const resolvedPath = path.resolve(baseDir, relativePath);
  if (resolvedPath !== baseDir && !resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

async function loadImage(source, context = {}) {
  const url = String(source || '').trim();
  if (!url) return null;

  const dataUrlMatch = /^data:([^;,]+);base64,(.+)$/i.exec(url);
  if (dataUrlMatch) {
    return {
      buffer: Buffer.from(dataUrlMatch[2], 'base64'),
      type: imageTypeFromMime(dataUrlMatch[1]),
    };
  }

  if (/^yibiao-asset:\/\//i.test(url)) {
    const assetPath = resolveAssetImagePath(url);
    if (!assetPath || !fs.existsSync(assetPath)) {
      return null;
    }

    return {
      buffer: fs.readFileSync(assetPath),
      type: imageTypeFromPath(assetPath),
    };
  }

  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`图片下载失败：${url}`);
    }
    const type = imageTypeFromMime(response.headers.get('content-type')) || imageTypeFromPath(new URL(url).pathname);
    return { buffer: Buffer.from(await response.arrayBuffer()), type };
  }

  const fileUrlPrefix = 'file://';
  const rawPath = url.startsWith(fileUrlPrefix) ? fileURLToPath(url) : url;
  const resolvedPath = path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(context.baseDir || process.cwd(), rawPath);

  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  return {
    buffer: fs.readFileSync(resolvedPath),
    type: imageTypeFromPath(resolvedPath),
  };
}

async function loadImageWithRetry(source, context = {}, options = {}) {
  const retryAttempts = Math.max(0, Number(options.retryAttempts) || 0);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 0);
  let attempt = 0;

  while (attempt <= retryAttempts) {
    try {
      return await loadImage(source, context);
    } catch (error) {
      if (attempt >= retryAttempts) {
        throw error;
      }

      attempt += 1;
      if (typeof options.onRetry === 'function') {
        options.onRetry(attempt, error);
      }
      if (retryDelayMs > 0) {
        await delay(retryDelayMs);
      }
    }
  }

  return null;
}

async function imageRunFromNode(node, context, options = {}) {
  let loaded = null;
  const imageLabel = compactText(node.alt || node.url || '未知图片');
  const imageIndex = (context.imageCount || 0) + 1;
  context.imageCount = imageIndex;
  writeExportLog(context, 'export.image.started', {
    image_index: imageIndex,
    label: imageLabel,
    source: describeImageSourceForLog(node.url),
  });
  try {
    loaded = await loadImageWithRetry(node.url, context, options.loadRetry);
  } catch (error) {
    const message = `图片无法导出：${imageLabel}，${compactText(error.message || '下载失败', 120)}`;
    addWarning(context, message);
    writeExportLog(context, 'export.image.error', {
      image_index: imageIndex,
      label: imageLabel,
      phase: 'load',
      error: compactLogError(error),
    });
    return contextTextRun(context, `[${message}]`, { color: 'C83220' });
  }
  if (!loaded?.buffer || !loaded.type) {
    const message = `图片无法导出：${imageLabel}，未找到可用图片数据`;
    addWarning(context, message);
    writeExportLog(context, 'export.image.error', {
      image_index: imageIndex,
      label: imageLabel,
      phase: 'load',
      reason: 'missing_image_data',
    });
    return contextTextRun(context, `[${message}]`, { color: 'C83220' });
  }

  try {
    loaded = normalizeImageForDocx(loaded);
  } catch (error) {
    const message = `图片无法导出：${imageLabel}，${error.message || '图片格式转换失败'}`;
    addWarning(context, message);
    writeExportLog(context, 'export.image.error', {
      image_index: imageIndex,
      label: imageLabel,
      phase: 'normalize',
      source_type: loaded.type,
      error: compactLogError(error),
    });
    return contextTextRun(context, `[${message}]`, { color: 'C83220' });
  }

  let size;
  try {
    size = imageSize(loaded.buffer);
  } catch (error) {
    const message = `图片无法导出：${imageLabel}，图片尺寸识别失败`;
    addWarning(context, message);
    writeExportLog(context, 'export.image.error', {
      image_index: imageIndex,
      label: imageLabel,
      phase: 'size',
      type: loaded.type,
      bytes: loaded.buffer.length,
      error: compactLogError(error),
    });
    return contextTextRun(context, `[${message}]`, { color: 'C83220' });
  }
  const layout = getLayoutContext(context);
  const maxImageWidth = layout.image.maxWidth || MAX_IMAGE_WIDTH;
  const sourceWidth = size.width || maxImageWidth;
  const sourceHeight = size.height || Math.round(maxImageWidth * 0.62);
  const ratio = Math.min(1, maxImageWidth / sourceWidth);
  const width = Math.round(sourceWidth * ratio);
  const height = Math.round(sourceHeight * ratio);
  context.imageSuccessCount = (context.imageSuccessCount || 0) + 1;
  writeExportLog(context, 'export.image.completed', {
    image_index: imageIndex,
    label: imageLabel,
    type: loaded.type,
    bytes: loaded.buffer.length,
    source_width: sourceWidth,
    source_height: sourceHeight,
    output_width: width,
    output_height: height,
  });

  return new ImageRun({
    type: loaded.type,
    data: loaded.buffer,
    transformation: { width, height },
    altText: {
      title: cleanText(node.alt || '图片'),
      description: cleanText(node.alt || node.url || 'Markdown 图片'),
      name: cleanText(node.alt || 'image'),
    },
  });
}

async function imageParagraphFromSource(source, alt, context, options = {}) {
  return contextParagraph(context, [await imageRunFromNode({ url: source, alt }, context, options)], { alignment: getLayoutContext(context).image.alignment });
}

async function inlineRuns(nodes = [], context = {}, marks = {}) {
  const runs = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push(...textRunsWithBreaks(node.value, { ...marks, layout: getLayoutContext(context) }));
    } else if (node.type === 'strong') {
      runs.push(...await inlineRuns(node.children, context, { ...marks, bold: true }));
    } else if (node.type === 'emphasis') {
      runs.push(...await inlineRuns(node.children, context, { ...marks, italics: true }));
    } else if (node.type === 'delete') {
      runs.push(...await inlineRuns(node.children, context, { ...marks, strike: true }));
    } else if (node.type === 'inlineCode') {
      runs.push(new TextRun({ text: cleanText(node.value), font: getFontName('code'), size: 22, color: '155BD7' }));
    } else if (node.type === 'break') {
      runs.push(lineBreakRun());
    } else if (node.type === 'html' && /^<br\s*\/?\s*>$/i.test(String(node.value || '').trim())) {
      runs.push(lineBreakRun());
    } else if (node.type === 'html') {
      const $ = cheerio.load(String(node.value || ''), null, false);
      runs.push(...await htmlInlineRuns($, $.root().contents().toArray(), context, marks));
    } else if (node.type === 'link') {
      const children = await inlineRuns(node.children, context, { ...marks, color: '2174FD', underline: true });
      runs.push(new ExternalHyperlink({ link: node.url, children }));
    } else if (node.type === 'image') {
      runs.push(await imageRunFromNode(node, context));
    } else if (node.children) {
      runs.push(...await inlineRuns(node.children, context, marks));
    }
  }

  return runs;
}

function nodeText(node) {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode') return String(node.value || '');
  return (node.children || []).map(nodeText).join('');
}

function isImageOnlyParagraph(node) {
  return (node.children || []).filter((child) => child.type !== 'text' || String(child.value || '').trim()).length === 1
    && (node.children || []).some((child) => child.type === 'image');
}

function isFigureCaptionParagraph(node) {
  return /^图[:：]/.test(nodeText(node).trim());
}

function htmlTagName(node) {
  return String(node?.name || '').toLowerCase();
}

function hasBlockHtmlChildren($, node) {
  return $(node).contents().toArray().some((child) => ['table', 'ul', 'ol', 'blockquote', 'pre', 'div', 'section', 'article', 'img'].includes(htmlTagName(child)));
}

async function htmlInlineRuns($, nodes = [], context = {}, marks = {}) {
  const runs = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push(...textRunsWithBreaks(node.data || '', { ...marks, layout: getLayoutContext(context) }));
      continue;
    }

    if (node.type !== 'tag') {
      continue;
    }

    const tag = htmlTagName(node);
    if (tag === 'br') {
      runs.push(lineBreakRun());
    } else if (tag === 'strong' || tag === 'b') {
      runs.push(...await htmlInlineRuns($, $(node).contents().toArray(), context, { ...marks, bold: true }));
    } else if (tag === 'em' || tag === 'i') {
      runs.push(...await htmlInlineRuns($, $(node).contents().toArray(), context, { ...marks, italics: true }));
    } else if (tag === 'code') {
      runs.push(new TextRun({ text: cleanText($(node).text()), font: getFontName('code'), size: 22, color: '155BD7' }));
    } else if (tag === 'a') {
      const href = $(node).attr('href') || '';
      const children = await htmlInlineRuns($, $(node).contents().toArray(), context, { ...marks, color: '2174FD', underline: true });
      if (href) {
        runs.push(new ExternalHyperlink({ link: href, children }));
      } else {
        runs.push(...children);
      }
    } else if (tag === 'img') {
      runs.push(await imageRunFromNode({ url: $(node).attr('src'), alt: $(node).attr('alt') || 'HTML 图片' }, context));
    } else {
      if (!['span', 'small', 'sub', 'sup'].includes(tag)) {
        addUnsupportedHtmlWarning(context, tag);
      }
      runs.push(...await htmlInlineRuns($, $(node).contents().toArray(), context, marks));
    }
  }

  return runs;
}

async function htmlTableToDocx($, tableNode, context) {
  const rows = [];
  const rowDescriptors = $(tableNode).find('tr').toArray().map((rowNode) => {
    const cells = $(rowNode).children('th,td').toArray().map((cellNode) => ({
      node: cellNode,
      columnSpan: normalizeColumnSpan($(cellNode).attr('colspan')),
    }));
    return {
      cells,
      columnCount: cells.reduce((sum, cell) => sum + cell.columnSpan, 0),
    };
  }).filter((row) => row.cells.length);
  const maxColumns = Math.max(1, ...rowDescriptors.map((row) => row.columnCount));

  for (const row of rowDescriptors) {
    const cells = [];
    for (const [cellIndex, cell] of row.cells.entries()) {
      const cellNode = cell.node;
      const isHeader = htmlTagName(cellNode) === 'th';
      const remainingSpan = cellIndex === row.cells.length - 1 ? maxColumns - row.columnCount : 0;
      cells.push(createTableCell({
        context,
        children: [contextParagraph(context, await htmlInlineRuns($, $(cellNode).contents().toArray(), context, { bold: isHeader }), { after: 80, noIndent: true })],
        isHeader,
        columnSpan: cell.columnSpan + Math.max(0, remainingSpan),
        totalColumns: maxColumns,
      }));
    }
    rows.push(new TableRow({
      children: cells,
      tableHeader: getLayoutContext(context).table.repeatHeader && rows.length === 0,
      cantSplit: !getLayoutContext(context).table.allowPageBreak,
    }));
  }

  if (!rows.length) {
    return [];
  }

  return [createDocxTable(rows, maxColumns, context)];
}

async function htmlListToDocx($, listNode, context, options = {}) {
  const blocks = [];
  const ordered = htmlTagName(listNode) === 'ol';
  const numberingReference = ordered ? createOrderedListReference(context) : null;

  for (const itemNode of $(listNode).children('li').toArray()) {
    const inlineNodes = $(itemNode).contents().toArray().filter((child) => !['ul', 'ol'].includes(htmlTagName(child)));
    const listOptions = ordered
      ? { numbering: { reference: numberingReference, level: Math.min(options.listLevel || 0, 2) } }
      : { bullet: { level: Math.min(options.listLevel || 0, 2) } };
    blocks.push(contextParagraph(context, await htmlInlineRuns($, inlineNodes, context), { ...listOptions, noIndent: true }));

    for (const childList of $(itemNode).children('ul,ol').toArray()) {
      blocks.push(...await htmlListToDocx($, childList, context, { ...options, listLevel: (options.listLevel || 0) + 1 }));
    }
  }

  return blocks;
}

async function htmlNodeToDocxBlocks($, node, context, options = {}) {
  if (node.type === 'text') {
    const text = String(node.data || '').trim();
    return text ? [contextParagraph(context, [contextTextRun(context, text)])] : [];
  }

  if (node.type !== 'tag') {
    return [];
  }

  const tag = htmlTagName(node);
  if (tag === 'table') {
    return htmlTableToDocx($, node, context);
  }
  if (tag === 'img') {
    return [await imageParagraphFromSource($(node).attr('src'), $(node).attr('alt') || 'HTML 图片', context)];
  }
  if (tag === 'ul' || tag === 'ol') {
    return htmlListToDocx($, node, context, options);
  }
  if (tag === 'blockquote') {
    return [contextParagraph(context, await htmlInlineRuns($, $(node).contents().toArray(), context, { color: '536176' }), {
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2174FD' } },
      shading: { type: ShadingType.CLEAR, fill: 'F6F9FF' },
    })];
  }
  if (tag === 'pre') {
    return [contextParagraph(context, [new TextRun({ text: cleanText($(node).text()), font: getFontName('code'), size: 21, color: '243048' })], {
      shading: { type: ShadingType.CLEAR, fill: 'F6F9FF' },
      indent: { left: 260, right: 260 },
    })];
  }
  if (tag === 'br') {
    return [contextParagraph(context, [lineBreakRun()])];
  }
  if (['div', 'section', 'article'].includes(tag) && hasBlockHtmlChildren($, node)) {
    return htmlNodesToDocxBlocks($, $(node).contents().toArray(), context, options);
  }
  if (tag === 'p' && hasBlockHtmlChildren($, node)) {
    return htmlNodesToDocxBlocks($, $(node).contents().toArray(), context, options);
  }
  if (['p', 'div', 'section', 'article', 'span', 'strong', 'b', 'em', 'i', 'a', 'code'].includes(tag)) {
    return [contextParagraph(context, await htmlInlineRuns($, $(node).contents().toArray(), context), {
      alignment: /^图[:：]/.test($(node).text().trim()) ? AlignmentType.CENTER : undefined,
    })];
  }

  addUnsupportedHtmlWarning(context, tag);
  return htmlNodesToDocxBlocks($, $(node).contents().toArray(), context, options);
}

async function htmlNodesToDocxBlocks($, nodes = [], context = {}, options = {}) {
  const blocks = [];
  for (const node of nodes) {
    blocks.push(...await htmlNodeToDocxBlocks($, node, context, options));
  }
  return blocks;
}

async function htmlToDocxBlocks(html, context = {}, options = {}) {
  const source = String(html || '').trim();
  if (!source) {
    return [];
  }

  const $ = cheerio.load(source, null, false);
  const blocks = await htmlNodesToDocxBlocks($, $.root().contents().toArray(), context, options);
  if (!blocks.length) {
    addWarning(context, '部分 HTML 内容未能导出，请核对 Word 内容。');
  }
  return blocks;
}

async function tableCellParagraphs(cell, context, isHeader = false) {
  const phrasingNodes = (cell.children || []).filter((child) => child.type !== 'paragraph');
  if (phrasingNodes.length) {
    return [contextParagraph(context, await inlineRuns(phrasingNodes, context, { bold: isHeader }), { after: 80, noIndent: true })];
  }

  const blocks = await markdownNodesToDocx(cell.children || [], context, { inTable: true });
  if (!blocks.length) return [contextParagraph(context, [contextTextRun(context, '')], { after: 80, noIndent: true })];
  return blocks.filter((block) => block instanceof Paragraph);
}

async function markdownNodesToDocx(nodes = [], context = {}, options = {}) {
  const blocks = [];

  for (const node of nodes) {
    if (node.type === 'heading') {
      blocks.push(contextParagraph(context, await inlineRuns(node.children, context), {
        heading: headingLevel(node.depth),
        before: node.depth === 1 ? 280 : 180,
        after: 120,
        alignment: getLayoutContext(context).styles[`heading${Math.min(Math.max(node.depth, 1), 4)}`]?.paragraph?.alignment,
        noIndent: true,
      }));
    } else if (node.type === 'paragraph') {
      blocks.push(contextParagraph(context, await inlineRuns(node.children, context), {
        after: options.inTable ? 80 : 160,
        alignment: !options.inTable && (isImageOnlyParagraph(node) || isFigureCaptionParagraph(node)) ? AlignmentType.CENTER : undefined,
        noIndent: options.inTable,
      }));
    } else if (node.type === 'list') {
      const numberingReference = node.ordered ? createOrderedListReference(context) : null;
      for (const item of node.children || []) {
        const firstParagraph = (item.children || []).find((child) => child.type === 'paragraph');
        const restChildren = (item.children || []).filter((child) => child !== firstParagraph);
        const listOptions = node.ordered
          ? { numbering: { reference: numberingReference, level: Math.min(options.listLevel || 0, 2) } }
          : { bullet: { level: Math.min(options.listLevel || 0, 2) } };
        blocks.push(contextParagraph(context, await inlineRuns(firstParagraph?.children || [], context), { ...listOptions, noIndent: true }));
        blocks.push(...await markdownNodesToDocx(restChildren, context, { ...options, listLevel: (options.listLevel || 0) + 1 }));
      }
    } else if (node.type === 'table') {
      const rows = [];
      const maxColumns = Math.max(1, ...(node.children || []).map((row) => row.children?.length || 0));
      for (const [rowIndex, row] of (node.children || []).entries()) {
        const cells = [];
        const rowCells = row.children || [];
        for (const [cellIndex, cell] of rowCells.entries()) {
          const columnSpan = cellIndex === rowCells.length - 1
            ? Math.max(1, maxColumns - rowCells.length + 1)
            : 1;
          cells.push(createTableCell({
            context,
            children: await tableCellParagraphs(cell, context, rowIndex === 0),
            isHeader: rowIndex === 0,
            columnSpan,
            totalColumns: maxColumns,
          }));
        }
        rows.push(new TableRow({
          children: cells,
          tableHeader: getLayoutContext(context).table.repeatHeader && rowIndex === 0,
          cantSplit: !getLayoutContext(context).table.allowPageBreak,
        }));
      }
      if (rows.length) {
        blocks.push(createDocxTable(rows, maxColumns, context));
      }
    } else if (node.type === 'blockquote') {
      for (const child of node.children || []) {
        if (child.type === 'paragraph') {
          blocks.push(contextParagraph(context, await inlineRuns(child.children, context, { color: '536176' }), {
            indent: { left: 360 },
            border: { left: { style: BorderStyle.SINGLE, size: 12, color: '2174FD' } },
            shading: { type: ShadingType.CLEAR, fill: 'F6F9FF' },
          }));
        } else {
          blocks.push(...await markdownNodesToDocx([child], context, options));
        }
      }
    } else if (node.type === 'code') {
      if (String(node.lang || '').toLowerCase() === 'mermaid') {
        const nextIndex = (context.convertedMermaidCount || 0) + 1;
        const total = context.stats?.mermaidCount || nextIndex;
        writeExportLog(context, 'export.mermaid.started', {
          mermaid_index: nextIndex,
          total,
          code_metrics: textMetrics(node.value),
        });
        reportConversionProgress(context, `正在转换 Mermaid 图 ${nextIndex}/${total}，可能需要联网等待。`);
        blocks.push(await imageParagraphFromSource(mermaidInkUrl(node.value), 'Mermaid 图', context, {
          loadRetry: {
            retryAttempts: MERMAID_EXPORT_RETRY_ATTEMPTS,
            retryDelayMs: MERMAID_EXPORT_RETRY_DELAY_MS,
            onRetry: (attempt) => {
              reportConversionProgress(context, `Mermaid 图 ${nextIndex}/${total} 转换失败，3 秒后第 ${attempt} 次重试。`);
            },
          },
        }));
        context.convertedMermaidCount = nextIndex;
        writeExportLog(context, 'export.mermaid.completed', {
          mermaid_index: nextIndex,
          total,
        });
        reportConversionProgress(context, `Mermaid 图 ${nextIndex}/${total} 已处理。`);
      } else {
        blocks.push(contextParagraph(context, [new TextRun({ text: cleanText(node.value), font: getFontName('code'), size: 21, color: '243048' })], {
          shading: { type: ShadingType.CLEAR, fill: 'F6F9FF' },
          indent: { left: 260, right: 260 },
        }));
      }
    } else if (node.type === 'html') {
      blocks.push(...await htmlToDocxBlocks(node.value, context, options));
    } else if (node.type === 'thematicBreak') {
      blocks.push(contextParagraph(context, [contextTextRun(context, '────────────────────────', { color: 'DCDFF6' })], { alignment: AlignmentType.CENTER }));
    } else if (node.children) {
      blocks.push(...await markdownNodesToDocx(node.children, context, options));
    }
  }

  return blocks;
}

async function parseMarkdown(content) {
  const [{ unified }, remarkParse, remarkGfm] = await Promise.all([
    import('unified'),
    import('remark-parse'),
    import('remark-gfm'),
  ]);
  return unified().use(remarkParse.default).use(remarkGfm.default).parse(normalizeMarkdownTablesForDocx(content));
}

async function markdownToDocxBlocks(content, context = {}) {
  const tree = await parseMarkdown(content);
  return markdownNodesToDocx(tree.children || [], context);
}

async function addMarkdownContent(children, content, context) {
  children.push(...await markdownToDocxBlocks(content, context));
}

const CHINESE_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const OUTLINE_NUMBER_PREFIX_PATTERN = /^(?:第[一二三四五六七八九十百千万\d]+[章节][、\s]*|[一二三四五六七八九十百千万]+[、.]\s*|[（(][一二三四五六七八九十百千万\d]+[）)]\s*|\d+(?:\.\d+)*[、.)）]?\s*)/;

function chineseNumber(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return String(value || '');
  if (number <= 10) return CHINESE_NUMERALS[number];
  if (number < 20) return `十${CHINESE_NUMERALS[number - 10]}`;
  const tens = Math.floor(number / 10);
  const ones = number % 10;
  return `${CHINESE_NUMERALS[tens]}十${ones ? CHINESE_NUMERALS[ones] : ''}`;
}

function standardOutlineLabel(level = 1, siblingIndex = 0) {
  const index = siblingIndex + 1;
  if (level <= 1) return `${chineseNumber(index)}、`;
  if (level === 2) return `（${chineseNumber(index)}）`;
  if (level === 3) return `${index}.`;
  return `（${index}）`;
}

function stripOutlineNumberPrefix(text) {
  return String(text || '').trim().replace(OUTLINE_NUMBER_PREFIX_PATTERN, '').trim();
}

function outlineTitleText(item = {}, level = 1, siblingIndex = 0) {
  const rawTitle = String(item.title || '').trim();
  const rawId = String(item.id || '').trim();
  const titleWithoutId = rawId && rawTitle.startsWith(rawId)
    ? rawTitle.slice(rawId.length).replace(/^[\s.、)）-]+/, '').trim()
    : rawTitle;
  const title = stripOutlineNumberPrefix(titleWithoutId || rawId);
  const label = standardOutlineLabel(level, siblingIndex);

  return `${label}${title ? ` ${title}` : ''}`.trim();
}

async function addOutlineItems(children, items, context, level = 1) {
  for (const [index, item] of (items || []).entries()) {
    const title = outlineTitleText(item, level, index);
    if (title) {
      children.push(contextParagraph(context, [contextTextRun(context, title, { bold: true })], {
        heading: headingLevel(level),
        before: level === 1 ? 320 : 200,
        after: 120,
        alignment: getLayoutContext(context).styles[`heading${Math.min(Math.max(level, 1), 4)}`]?.paragraph?.alignment,
        noIndent: true,
      }));
    }

    if (!item.children?.length) {
      if (String(item.content || '').trim()) {
        await addMarkdownContent(children, item.content, context);
      }
      context.convertedLeafCount = (context.convertedLeafCount || 0) + 1;
      reportConversionProgress(context, `已处理 ${context.convertedLeafCount}/${context.stats?.leafCount || context.convertedLeafCount} 个正文小节。`);
      continue;
    }

    await addOutlineItems(children, item.children, context, level + 1);
  }
}

function createNumberingConfig(context) {
  const references = context.numberingReferences || [];
  if (!references.length) {
    return undefined;
  }

  return {
    config: references.map((reference) => ({
      reference,
      levels: [0, 1, 2].map((level) => ({
        level,
        format: LevelFormat.DECIMAL,
        text: `%${level + 1}.`,
        alignment: AlignmentType.START,
        style: {
          paragraph: {
            indent: { left: 720 + level * 420, hanging: 260 },
          },
        },
      })),
    })),
  };
}

function createHeaderFooterTextRuns(text, context) {
  const parts = String(text || '').split(/(\{page\}|\{pages\})/g);
  const children = [];
  for (const part of parts) {
    if (!part) continue;
    if (part === '{page}') {
      children.push(new TextRun({ children: [PageNumber.CURRENT], font: getLayoutContext(context).bodyFont, size: getLayoutContext(context).bodySize }));
    } else if (part === '{pages}') {
      children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], font: getLayoutContext(context).bodyFont, size: getLayoutContext(context).bodySize }));
    } else {
      children.push(contextTextRun(context, part));
    }
  }
  return children.length ? children : [contextTextRun(context, '')];
}

function createSectionHeadersFooters(layout, payload, context) {
  const section = {};
  const headerText = replaceTemplateVariables(layout.template?.header?.text || '', payload).trim();
  const footerText = replaceTemplateVariables(layout.template?.footer?.text || '', payload).trim();
  const pageNumberText = String(layout.template?.footer?.page_number_format || '').trim();

  if (layout.template?.header?.enabled && headerText) {
    section.headers = {
      default: new Header({
        children: [contextParagraph(context, createHeaderFooterTextRuns(headerText, context), {
          alignment: AlignmentType.CENTER,
          after: 80,
          noIndent: true,
        })],
      }),
    };
  }

  if (layout.template?.footer?.enabled && (footerText || pageNumberText)) {
    const footerRuns = [
      ...createHeaderFooterTextRuns(footerText, context),
      ...(footerText && pageNumberText ? [new TextRun({ text: '  ', font: layout.bodyFont, size: layout.bodySize })] : []),
      ...createHeaderFooterTextRuns(pageNumberText, context),
    ];
    section.footers = {
      default: new Footer({
        children: [contextParagraph(context, footerRuns, {
          alignment: AlignmentType.CENTER,
          before: 80,
          noIndent: true,
        })],
      }),
    };
  }

  return section;
}

function createTocSectionHeadersFooters(layout, payload, context) {
  if (!layout.template?.toc?.show_page_numbers) {
    return {};
  }
  const pageNumberText = String(layout.template?.toc?.page_number_format || layout.template?.footer?.page_number_format || '').trim();
  if (!pageNumberText) {
    return {};
  }
  return {
    footers: {
      default: new Footer({
        children: [contextParagraph(context, createHeaderFooterTextRuns(pageNumberText, context), {
          alignment: AlignmentType.CENTER,
          before: 80,
          noIndent: true,
        })],
      }),
    },
  };
}

function createSectionProperties(layout, extra = {}) {
  return {
    page: {
      size: layout.pageSettings.size,
      margin: layout.pageSettings.margin,
      ...(extra.page || {}),
    },
    ...(extra.type ? { type: extra.type } : {}),
  };
}

function createBodySection(layout, payload, context, children) {
  return {
    ...createSectionHeadersFooters(layout, payload, context),
    properties: createSectionProperties(layout, {
      type: SectionType.NEXT_PAGE,
      page: { pageNumbers: { start: 1 } },
    }),
    children,
  };
}

async function buildDocxResult(payload, options = {}) {
  const stats = countOutlineStats(payload.outline || []);
  const layout = buildLayoutContext(resolveLayoutTemplate(options));
  const context = {
    baseDir: payload.base_dir || payload.baseDir,
    onProgress: options.onProgress,
    warnings: options.warnings || [],
    stats,
    convertedLeafCount: 0,
    convertedMermaidCount: 0,
    imageCount: 0,
    imageSuccessCount: 0,
    numberingReferences: [],
    numberingIndex: 0,
    unsupportedHtmlTags: new Set(),
    developerLogger: options.developerLogger,
    layout,
  };
  writeExportLog(context, 'export.docx.build.started', {
    stats,
    content_metrics: countOutlineContentMetrics(payload.outline || []),
  });

  // 生成封面页
  const coverOptions = {
    projectName: payload.project_name || '投标文件',
    bidderName: payload.bidder_name || payload.bidderName || '',
    tendererName: payload.tenderer_name || payload.tendererName || '',
    date: payload.date || '',
    formatStandard: payload.format_standard || payload.formatStandard || 'government',
    docType: payload.doc_type || payload.docType || '技术标',
    title: coverValue(layout.template?.cover?.title, payload, payload.project_name || '投标文件'),
    subtitle: coverValue(layout.template?.cover?.subtitle, payload, payload.doc_type || payload.docType || '投标文件'),
    bidderLabel: layout.template?.cover?.bidder_label || '投标单位',
    tendererLabel: layout.template?.cover?.tenderer_label || '招标单位',
    dateLabel: layout.template?.cover?.date_label || '日期',
    showLogoPlaceholder: layout.template?.cover?.show_logo_placeholder === true,
    logoPath: layout.template?.cover?.logo_path || '',
  };
  const coverParagraphs = generateCoverParagraphs(coverOptions);

  // 生成目录页
  const tocOptions = {
    outline: payload.outline || [],
    formatStandard: payload.format_standard || payload.formatStandard || 'government',
    autoToc: false,
    staticToc: true,
    leader: layout.template?.toc?.leader || 'dot',
    maxLevel: layout.template?.toc?.max_level || 3,
    showPageNumber: true,
  };
  const tocParagraphs = generateTocParagraphs(tocOptions);

  // 封面 + 分页符 + 目录 + 分页符 + 正文内容
  const bodyChildren = [
    contextParagraph(context, [contextTextRun(context, payload.project_name || '投标技术文件', { bold: true, size: layout.styles.heading1.run.size })], { alignment: AlignmentType.CENTER, after: 300, noIndent: true }),
  ];

  reportProgress(context, 10, stats.mermaidCount
    ? `准备导出正文，并转换 ${stats.mermaidCount} 张 Mermaid 图。`
    : '准备导出正文。');
  await addOutlineItems(bodyChildren, payload.outline || [], context);
  reportProgress(context, 90, '正在生成 Word 文件。');

  const numbering = createNumberingConfig(context);

  // 加载自定义字体
  const customFonts = loadCustomFonts();

  const doc = new Document({
    ...(numbering ? { numbering } : {}),
    styles: {
      default: {
        document: {
          run: { font: layout.styles.document.run.font, size: layout.styles.document.run.size },
          paragraph: layout.styles.document.paragraph,
        },
        heading1: {
          run: layout.styles.heading1.run,
          paragraph: layout.styles.heading1.paragraph,
        },
        heading2: {
          run: layout.styles.heading2.run,
          paragraph: layout.styles.heading2.paragraph,
        },
        heading3: {
          run: layout.styles.heading3.run,
          paragraph: layout.styles.heading3.paragraph,
        },
        heading4: {
          run: layout.styles.heading4.run,
          paragraph: layout.styles.heading4.paragraph,
        },
      },
    },
    sections: [
      {
        properties: createSectionProperties(layout),
        children: coverParagraphs,
      },
      {
        ...createTocSectionHeadersFooters(layout, payload, context),
        properties: createSectionProperties(layout, { type: SectionType.NEXT_PAGE }),
        children: tocParagraphs.length ? tocParagraphs : [contextParagraph(context, [contextTextRun(context, '目录')], { alignment: AlignmentType.CENTER, noIndent: true })],
      },
      createBodySection(layout, payload, context, bodyChildren),
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeExportLog(context, 'export.docx.build.completed', {
    stats,
    warning_count: context.warnings.length,
    converted_leaf_count: context.convertedLeafCount,
    converted_mermaid_count: context.convertedMermaidCount,
    image_count: context.imageCount,
    image_success_count: context.imageSuccessCount,
    image_failure_count: Math.max(0, context.imageCount - context.imageSuccessCount),
    buffer_bytes: buffer.length,
  });
  return { buffer, warnings: context.warnings, stats };
}

async function buildDocxBuffer(payload, options = {}) {
  const result = await buildDocxResult(payload, options);
  return result.buffer;
}

function createExportService({ configStore } = {}) {
  return {
    async exportWord(payload = {}, onProgress) {
      const stats = countOutlineStats(Array.isArray(payload.outline) ? payload.outline : []);
      const developerLogger = createDeveloperLogger({
        app,
        config: loadDeveloperConfig(configStore),
        moduleName: 'export',
        name: 'word-export',
        meta: {
          project_name: sanitizeFilename(payload.project_name || '投标技术文件'),
          stats,
        },
      });
      developerLogger.write('export.word.started', {
        project_name: sanitizeFilename(payload.project_name || '投标技术文件'),
        stats,
        content_metrics: countOutlineContentMetrics(Array.isArray(payload.outline) ? payload.outline : []),
      });
      if (!Array.isArray(payload.outline) || !payload.outline.length) {
        const error = new Error('没有可导出的目录内容');
        developerLogger.write('export.word.error', { error: compactLogError(error) });
        throw error;
      }

      const progressContext = { onProgress, warnings: [], stats };
      reportProgress(progressContext, 2, stats.mermaidCount
        ? `检测到 ${stats.mermaidCount} 张 Mermaid 图，导出时会转换为 Word 图片。`
        : '正在准备 Word 导出。');
      const defaultFilename = `${sanitizeFilename(payload.project_name || '标书文档')}.docx`;
      const defaultDir = app?.getPath ? app.getPath('documents') : process.env.USERPROFILE || process.cwd();
      const result = await dialog.showSaveDialog({
        title: '导出 Word 文档',
        defaultPath: path.join(defaultDir, defaultFilename),
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      });

      if (result.canceled || !result.filePath) {
        reportProgress(progressContext, 0, '已取消导出。', { phase: 'canceled' });
        developerLogger.write('export.word.canceled', { stats });
        return { success: false, canceled: true, message: '已取消导出' };
      }

      try {
        const warnings = [];
        const buildResult = await buildDocxResult(payload, { onProgress, warnings, developerLogger, configStore });
        reportProgress({ onProgress, warnings: buildResult.warnings, stats: buildResult.stats }, 96, '正在写入 Word 文件。');
        developerLogger.write('export.word.write.started', {
          output_file_name: path.basename(result.filePath),
          output_extension: path.extname(result.filePath).toLowerCase(),
          buffer_bytes: buildResult.buffer.length,
        });
        fs.writeFileSync(result.filePath, buildResult.buffer);
        const message = buildResult.warnings.length
          ? `Word 已导出，但有 ${buildResult.warnings.length} 处图片未能插入，请打开文档核对。`
          : 'Word 已导出，请打开文档核对图片、表格和版式。';
        reportProgress({ onProgress, warnings: buildResult.warnings, stats: buildResult.stats }, 100, message, { phase: 'success' });
        developerLogger.write('export.word.completed', {
          output_file_name: path.basename(result.filePath),
          output_extension: path.extname(result.filePath).toLowerCase(),
          buffer_bytes: buildResult.buffer.length,
          warning_count: buildResult.warnings.length,
          stats: buildResult.stats,
        });
        return { success: true, path: result.filePath, message, warnings: buildResult.warnings };
      } catch (error) {
        developerLogger.write('export.word.error', {
          output_file_name: path.basename(result.filePath),
          output_extension: path.extname(result.filePath).toLowerCase(),
          error: compactLogError(error),
        });
        throw error;
      }
    },
  };
}

module.exports = {
  buildDocxBuffer,
  buildDocxResult,
  createExportService,
};
