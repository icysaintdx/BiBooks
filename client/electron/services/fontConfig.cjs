/**
 * 公文字体配置服务
 * 管理字体加载和映射，确保公文格式符合国家标准
 */

const fs = require('node:fs');
const path = require('node:path');
const { logInfo, logWarn } = require('../utils/logger.cjs');

// 字体目录
const FONTS_DIR = path.join(__dirname, '..', 'fonts');

// 公文标准字体映射
const OFFICIAL_FONTS = {
  // 标题字体（方正小标宋）
  title: {
    name: '方正小标宋简体',
    fallback: 'FZXiaoBiaoSong-B05S',
    cssName: 'FZXiaoBiaoSong-B05S',
    alternatives: ['小标宋', 'SimSun', '宋体'],
  },
  // 正文字体（方正仿宋）
  body: {
    name: '方正仿宋简体',
    fallback: 'FZFangSong-Z02S',
    cssName: 'FZFangSong-Z02S',
    alternatives: ['仿宋', 'FangSong', 'STFangsong'],
  },
  // 注释字体（方正楷体）
  annotation: {
    name: '方正楷体简体',
    fallback: 'FZKai-Z03S',
    cssName: 'FZKai-Z03S',
    alternatives: ['楷体', 'KaiTi', 'STKaiti'],
  },
  // 小标题字体（方正黑体）
  heading: {
    name: '方正黑体简体',
    fallback: 'FZHei-B01S',
    cssName: 'FZHei-B01S',
    alternatives: ['黑体', 'SimHei', 'STHeiti'],
  },
  // 等宽字体（代码块）
  code: {
    name: 'Consolas',
    fallback: 'Consolas',
    cssName: 'Consolas',
    alternatives: ['Courier New', 'monospace'],
  },
};

// 公文格式参数（GB/T 9704-2012）
const OFFICIAL_FORMAT = {
  // 页面设置（A4纸）
  page: {
    width: 210,  // mm
    height: 297, // mm
    marginTop: 37,    // mm（上边距 37mm）
    marginBottom: 35, // mm（下边距 35mm）
    marginLeft: 28,   // mm（左边距 28mm）
    marginRight: 26,  // mm（右边距 26mm）
  },
  // 字体大小（单位：磅）
  fontSize: {
    title: 22,        // 标题：二号（22磅）
    subtitle: 16,     // 小标题：三号（16磅）
    body: 16,         // 正文：三号（16磅）
    annotation: 14,   // 注释：四号（14磅）
    header: 14,       // 页眉：四号（14磅）
    footer: 14,       // 页脚：四号（14磅）
    pageNumber: 14,   // 页码：四号（14磅）
  },
  // 行距（单位：磅）
  lineHeight: {
    title: 32,        // 标题行距
    body: 28.8,       // 正文行距（固定值28.8磅）
    annotation: 24,   // 注释行距
  },
  // 段落间距（单位：磅）
  spacing: {
    titleBefore: 0,
    titleAfter: 0,
    bodyBefore: 0,
    bodyAfter: 0,
    paragraphIndent: 32, // 首行缩进（2个字符 = 32磅）
  },
};

/**
 * 检测字体是否已安装
 */
function isFontAvailable(fontName) {
  // 在 Electron 中，我们可以通过检查系统字体列表来判断
  // 这里简化处理，返回 false 让系统使用 fallback
  return false;
}

/**
 * 获取字体的实际可用名称
 */
function getFontName(fontType) {
  const fontConfig = OFFICIAL_FONTS[fontType];
  if (!fontConfig) {
    return OFFICIAL_FONTS.body.name;
  }

  // 优先使用配置的字体
  if (isFontAvailable(fontConfig.name)) {
    return fontConfig.name;
  }

  // 尝试 fallback
  if (isFontAvailable(fontConfig.fallback)) {
    return fontConfig.fallback;
  }

  // 尝试备选字体
  for (const alt of fontConfig.alternatives) {
    if (isFontAvailable(alt)) {
      return alt;
    }
  }

  // 返回默认值
  return fontConfig.fallback;
}

/**
 * 获取 Word 文档的默认样式配置
 */
function getDocxDefaultStyles() {
  return {
    document: {
      run: {
        font: getFontName('body'),
        size: OFFICIAL_FORMAT.fontSize.body * 2, // docx 使用半磅
      },
      paragraph: {
        spacing: {
          line: OFFICIAL_FORMAT.lineHeight.body * 20, // docx 使用 twips
        },
      },
    },
    title: {
      run: {
        font: getFontName('title'),
        size: OFFICIAL_FORMAT.fontSize.title * 2,
        bold: true,
      },
      paragraph: {
        alignment: 'center',
        spacing: {
          before: OFFICIAL_FORMAT.spacing.titleBefore * 20,
          after: OFFICIAL_FORMAT.spacing.titleAfter * 20,
          line: OFFICIAL_FORMAT.lineHeight.title * 20,
        },
      },
    },
    heading1: {
      run: {
        font: getFontName('heading'),
        size: OFFICIAL_FORMAT.fontSize.subtitle * 2,
        bold: true,
      },
      paragraph: {
        spacing: {
          before: 12 * 20,
          after: 6 * 20,
          line: OFFICIAL_FORMAT.lineHeight.body * 20,
        },
      },
    },
    heading2: {
      run: {
        font: getFontName('heading'),
        size: OFFICIAL_FORMAT.fontSize.subtitle * 2,
        bold: true,
      },
      paragraph: {
        spacing: {
          before: 10 * 20,
          after: 4 * 20,
          line: OFFICIAL_FORMAT.lineHeight.body * 20,
        },
      },
    },
    body: {
      run: {
        font: getFontName('body'),
        size: OFFICIAL_FORMAT.fontSize.body * 2,
      },
      paragraph: {
        spacing: {
          line: OFFICIAL_FORMAT.lineHeight.body * 20,
        },
        indent: {
          firstLine: OFFICIAL_FORMAT.spacing.paragraphIndent * 20,
        },
      },
    },
    annotation: {
      run: {
        font: getFontName('annotation'),
        size: OFFICIAL_FORMAT.fontSize.annotation * 2,
      },
      paragraph: {
        spacing: {
          line: OFFICIAL_FORMAT.lineHeight.annotation * 20,
        },
      },
    },
    code: {
      run: {
        font: getFontName('code'),
        size: OFFICIAL_FORMAT.fontSize.body * 2 - 2,
      },
    },
  };
}

/**
 * 获取页面设置
 */
function getPageSettings() {
  const { page } = OFFICIAL_FORMAT;
  return {
    size: {
      width: Math.round(page.width * 56.7),  // mm to twips
      height: Math.round(page.height * 56.7),
    },
    margin: {
      top: Math.round(page.marginTop * 56.7),
      bottom: Math.round(page.marginBottom * 56.7),
      left: Math.round(page.marginLeft * 56.7),
      right: Math.round(page.marginRight * 56.7),
    },
  };
}

/**
 * 加载自定义字体目录中的字体
 */
function loadCustomFonts() {
  if (!fs.existsSync(FONTS_DIR)) {
    logWarn('[font-config] 字体目录不存在', FONTS_DIR);
    return [];
  }

  const fontFiles = fs.readdirSync(FONTS_DIR).filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ext === '.ttf' || ext === '.otf' || ext === '.woff' || ext === '.woff2';
  });

  logInfo('[font-config] 发现字体文件', { count: fontFiles.length, files: fontFiles });
  return fontFiles;
}

module.exports = {
  OFFICIAL_FONTS,
  OFFICIAL_FORMAT,
  getFontName,
  getDocxDefaultStyles,
  getPageSettings,
  loadCustomFonts,
  isFontAvailable,
};
