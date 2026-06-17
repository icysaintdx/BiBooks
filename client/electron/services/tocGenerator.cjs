/**
 * 目录生成模块
 * 生成 Word 自动目录（TOC 域代码）
 * 参考: BiaoShu-SKILL generate_toc.py
 */

const {
  AlignmentType,
  LeaderType,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} = require('docx');

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

/**
 * 格式标准配置
 */
const TOC_FORMAT_CONFIGS = {
  government: {
    titleFont: '黑体',
    titleSize: 22,
    bodyFont: '宋体',
    bodySize: 12,
  },
  enterprise: {
    titleFont: '黑体',
    titleSize: 18,
    bodyFont: '宋体',
    bodySize: 10.5,
  },
  highway: {
    titleFont: '黑体',
    titleSize: 22,
    bodyFont: '宋体',
    bodySize: 12,
  },
};

/**
 * 创建目录标题段落
 */
function createTocTitle(formatStandard = 'government') {
  const config = TOC_FORMAT_CONFIGS[formatStandard] || TOC_FORMAT_CONFIGS.government;

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: 240,
      after: 360,
      line: 360,
    },
    children: [
      new TextRun({
        text: '目  录',
        font: {
          name: config.titleFont,
          eastAsia: config.titleFont,
        },
        size: config.titleSize * 2, // docx 库使用 half-points
        bold: true,
      }),
    ],
  });
}

/**
 * 创建 TOC 域代码段落
 * 注意: docx 库不直接支持 TOC 域代码，需要使用 rawXml 插入
 */
function createTocFieldParagraph() {
  // 使用 docx 库的 XML 功能插入 TOC 域代码
  // 这里我们创建一个占位段落，实际的 TOC 域代码需要在 Word 中手动更新
  return new Paragraph({
    spacing: {
      before: 0,
      after: 120,
      line: 276,
    },
    children: [
      new TextRun({
        text: '（目录将在 Word 中自动生成，请右键点击此处选择"更新域"）',
        font: {
          name: '宋体',
          eastAsia: '宋体',
        },
        size: 24, // 12pt
        color: '808080',
        italics: true,
      }),
    ],
  });
}

/**
 * 生成静态目录内容
 * @param {Array} outline - 大纲数据
 * @param {number} maxLevel - 最大层级
 * @returns {Array} 段落数组
 */
function normalizeLeader(value) {
  if (value === 'hyphen') return LeaderType.HYPHEN;
  if (value === 'underscore') return LeaderType.UNDERSCORE;
  if (value === 'middleDot') return LeaderType.MIDDLE_DOT;
  if (value === 'none') return LeaderType.NONE;
  return LeaderType.DOT;
}

function collectStaticTocRows(outline = [], maxLevel = 3) {
  const rows = [];

  function processItems(items, level = 1) {
    if (level > maxLevel) return;
    for (const [index, item] of items.entries()) {
      const title = outlineTitleText(item, level, index);
      if (title) rows.push({ title, level });
      if (item.children && item.children.length > 0) {
        processItems(item.children, level + 1);
      }
    }
  }

  processItems(outline);
  return rows;
}

function generateStaticTocContent(outline = [], maxLevel = 3, options = {}) {
  const paragraphs = [];
  const rows = collectStaticTocRows(outline, maxLevel);
  const leader = normalizeLeader(options.leader);
  const showPageNumber = options.showPageNumber !== false;

  for (const [rowIndex, row] of rows.entries()) {
    const indent = (row.level - 1) * 360;
    const fontSize = row.level === 1 ? 24 : row.level === 2 ? 21 : 18;
    const isBold = row.level === 1;
    const children = [
      new TextRun({
        text: row.title,
        font: {
          name: row.level === 1 ? '黑体' : '宋体',
          eastAsia: row.level === 1 ? '黑体' : '宋体',
        },
        size: fontSize,
        bold: isBold,
      }),
    ];
    if (showPageNumber) {
      children.push(new TextRun({ text: '\t' }));
      children.push(new TextRun({
        text: String(rowIndex + 1),
        font: { name: '宋体', eastAsia: '宋体' },
        size: fontSize,
      }));
    }

    paragraphs.push(
      new Paragraph({
        spacing: {
          before: 60,
          after: 60,
          line: 276,
        },
        indent: {
          left: indent,
        },
        tabStops: showPageNumber
          ? [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX, leader }]
          : undefined,
        children,
      })
    );
  }

  return paragraphs;
}

/**
 * 生成完整目录页段落数组
 * @param {Object} options - 目录选项
 * @param {Array} options.outline - 大纲数据
 * @param {string} options.formatStandard - 格式标准
 * @param {boolean} options.autoToc - 是否包含自动目录域代码
 * @param {boolean} options.staticToc - 是否包含静态目录
 * @returns {Array} 段落数组
 */
function generateTocParagraphs(options = {}) {
  const {
    outline = [],
    formatStandard = 'government',
    autoToc = true,
    staticToc = true,
    leader = 'dot',
    maxLevel = 3,
    showPageNumber = true,
  } = options;

  const paragraphs = [];

  // 目录标题
  paragraphs.push(createTocTitle(formatStandard));

  // 自动目录域代码
  if (autoToc) {
    paragraphs.push(createTocFieldParagraph());
  }

  // 静态目录
  if (staticToc && outline.length > 0) {
    paragraphs.push(...generateStaticTocContent(outline, maxLevel, { leader, showPageNumber }));
  }

  return paragraphs;
}

/**
 * 生成目录文档（独立文件）
 * @param {Object} options - 目录选项
 * @returns {Promise<Buffer>} Word 文档 Buffer
 */
async function generateTocDocx(options = {}) {
  const { Document, Packer } = require('docx');
  const { getDocxDefaultStyles, getPageSettings } = require('./fontConfig.cjs');

  const {
    formatStandard = 'government',
  } = options;

  const pageSettings = getPageSettings(formatStandard);
  const defaultStyles = getDocxDefaultStyles(formatStandard);
  const tocContent = generateTocParagraphs(options);

  const doc = new Document({
    styles: defaultStyles,
    sections: [
      {
        properties: {
          page: {
            margin: pageSettings.margin,
          },
        },
        children: tocContent,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * 生成目录并保存到文件
 * @param {Object} options - 目录选项
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function generateTocToFile(options, outputPath) {
  const buffer = await generateTocDocx(options);
  const fs = require('node:fs');
  const path = require('node:path');

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = {
  generateTocParagraphs,
  generateTocDocx,
  generateTocToFile,
  generateStaticTocContent,
  TOC_FORMAT_CONFIGS,
};
