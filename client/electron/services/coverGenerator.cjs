/**
 * 封面生成模块
 * 根据项目信息自动生成标书封面页
 * 参考: BiaoShu-SKILL generate_cover.py
 */

const {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
} = require('docx');
const { getDocxDefaultStyles, getPageSettings, getFontName } = require('./fontConfig.cjs');

/**
 * 格式标准配置
 */
const FORMAT_CONFIGS = {
  government: {
    titleFont: '华文中宋',
    titleSize: 36,
    subtitleFont: '华文中宋',
    subtitleSize: 28,
    bodyFont: '仿宋_GB2312',
    bodySize: 16,
    labelFont: '仿宋_GB2312',
    labelSize: 14,
  },
  enterprise: {
    titleFont: '黑体',
    titleSize: 32,
    subtitleFont: '黑体',
    subtitleSize: 24,
    bodyFont: '宋体',
    bodySize: 14,
    labelFont: '宋体',
    labelSize: 12,
  },
  highway: {
    titleFont: '黑体',
    titleSize: 36,
    subtitleFont: '黑体',
    subtitleSize: 28,
    bodyFont: '宋体',
    bodySize: 16,
    labelFont: '宋体',
    labelSize: 14,
  },
};

/**
 * 创建居中段落
 */
function createCenterParagraph(text, fontName, fontSize, bold = false, spacing = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: spacing.before || 0,
      after: spacing.after || 0,
      line: spacing.line || 360,
    },
    children: [
      new TextRun({
        text,
        font: {
          name: fontName,
          eastAsia: fontName,
        },
        size: fontSize * 2, // docx 库使用 half-points
        bold,
      }),
    ],
  });
}

/**
 * 创建空段落
 */
function createEmptyParagraph(lineCount = 1) {
  return new Paragraph({
    spacing: {
      before: 0,
      after: 0,
      line: 220,
    },
    children: [
      new TextRun({
        text: '',
        size: 12,
      }),
    ],
  });
}

/**
 * 生成封面内容
 * @param {Object} options - 封面选项
 * @param {string} options.projectName - 项目名称
 * @param {string} options.bidderName - 投标单位名称
 * @param {string} options.tendererName - 招标人名称
 * @param {string} options.date - 日期
 * @param {string} options.formatStandard - 格式标准 (government/enterprise/highway)
 * @param {string} options.docType - 文档类型 (技术标/投标文件)
 * @returns {Array} 段落数组
 */
function generateCoverContent(options = {}) {
  const {
    projectName = '投标项目',
    bidderName = '',
    tendererName = '',
    date = '',
    formatStandard = 'government',
    docType = '技术标',
    title = '',
    subtitle = '',
    bidderLabel = '投标单位',
    tendererLabel = '招标单位',
    dateLabel = '日期',
    showLogoPlaceholder = false,
  } = options;

  const config = FORMAT_CONFIGS[formatStandard] || FORMAT_CONFIGS.government;
  const currentDate = date || new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const paragraphs = [];

  // 顶部空行
  for (let i = 0; i < 4; i++) {
    paragraphs.push(createEmptyParagraph());
  }

  if (showLogoPlaceholder) {
    paragraphs.push(
      createCenterParagraph(
        '[公司LOGO]',
        config.labelFont,
        14,
        false,
        { before: 0, after: 200, line: 360 }
      )
    );
  }

  // 空行
  for (let i = 0; i < 2; i++) {
    paragraphs.push(createEmptyParagraph());
  }

  // 招标人名称（如果有）
  if (tendererName) {
    paragraphs.push(
      createCenterParagraph(
        `${tendererLabel}：${tendererName}`,
        config.bodyFont,
        config.bodySize,
        false,
        { before: 0, after: 200, line: 360 }
      )
    );
    paragraphs.push(createEmptyParagraph());
  }

  // 项目名称
  paragraphs.push(
    createCenterParagraph(
      title || projectName,
      config.titleFont,
      config.titleSize,
      true,
      { before: 0, after: 300, line: 400 }
    )
  );

  // 空行
  paragraphs.push(createEmptyParagraph());

  // 文档类型（技术标/投标文件）
  paragraphs.push(
    createCenterParagraph(
      subtitle || docType,
      config.subtitleFont,
      config.subtitleSize,
      true,
      { before: 0, after: 0, line: 400 }
    )
  );

  // 空行
  for (let i = 0; i < 4; i++) {
    paragraphs.push(createEmptyParagraph());
  }

  // 投标单位
  if (bidderName) {
    paragraphs.push(
      createCenterParagraph(
        `${bidderLabel}：${bidderName}`,
        config.bodyFont,
        config.bodySize,
        false,
        { before: 0, after: 200, line: 360 }
      )
    );
    paragraphs.push(createEmptyParagraph());
  }

  // 日期
  paragraphs.push(
    createCenterParagraph(
      `${dateLabel}：${currentDate}`,
      config.bodyFont,
      config.bodySize,
      false,
      { before: 0, after: 0, line: 360 }
    )
  );

  // 底部空行
  for (let i = 0; i < 1; i++) {
    paragraphs.push(createEmptyParagraph());
  }

  return paragraphs;
}

/**
 * 生成封面 Word 文档
 * @param {Object} options - 封面选项
 * @returns {Promise<Buffer>} Word 文档 Buffer
 */
async function generateCoverDocx(options = {}) {
  const {
    formatStandard = 'government',
  } = options;

  const pageSettings = getPageSettings(formatStandard);
  const defaultStyles = getDocxDefaultStyles(formatStandard);
  const coverContent = generateCoverContent(options);

  const doc = new Document({
    styles: defaultStyles,
    sections: [
      {
        properties: {
          page: {
            margin: pageSettings.margin,
          },
        },
        children: coverContent,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * 生成封面并保存到文件
 * @param {Object} options - 封面选项
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<string>} 输出文件路径
 */
async function generateCoverToFile(options, outputPath) {
  const buffer = await generateCoverDocx(options);
  const fs = require('node:fs');
  const path = require('node:path');

  // 确保目录存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * 生成封面段落（用于集成到现有 Word 文档）
 * @param {Object} options - 封面选项
 * @returns {Array} 段落数组，可直接插入到 Document 的 children 中
 */
function generateCoverParagraphs(options = {}) {
  return generateCoverContent(options);
}

module.exports = {
  generateCoverDocx,
  generateCoverToFile,
  generateCoverParagraphs,
  generateCoverContent,
  FORMAT_CONFIGS,
};
