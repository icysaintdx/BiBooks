/**
 * AI 去痕处理模块
 * 去除 AI 生成文本中的典型痕迹，使内容更自然
 * 移植自 BiaoShu-SKILL humanizer.py
 */

// AI 特征词汇替换映射
const REPLACEMENTS = {
  '赋能': '支持',
  '助力': '帮助',
  '驱动': '推动',
  '引领': '带动',
  '生态': '体系',
  '闭环': '流程',
  '抓手': '手段',
  '颗粒度': '细致程度',
  '底层逻辑': '基本原理',
  '顶层设计': '整体规划',
};

// 段落开头的填充短语（需要删除的）
const FILLER_PHRASES = [
  '首先，', '其次，', '再次，', '最后，',
  '一方面，', '另一方面，',
  '不仅如此，', '更重要的是，', '值得注意的是，',
  '众所周知，', '显而易见，', '毋庸置疑，',
];

// 重复表达替换（出现超过阈值时替换部分实例）
const VARIATION_REPLACEMENTS = [
  { word: '采用', alternatives: ['使用', '运用', '利用'] },
  { word: '实现', alternatives: ['达成', '完成', '达到'] },
  { word: '提供', alternatives: ['给予', '供应', '交付'] },
  { word: '确保', alternatives: ['保证', '保障', '维护'] },
  { word: '提升', alternatives: ['提高', '增强', '改善'] },
];

const VARIATION_THRESHOLD = 3;

/**
 * 替换 AI 特征词汇
 * @param {string} text
 * @returns {{ text: string, changes: string[] }}
 */
function replaceAiPhrases(text) {
  const changes = [];
  let result = text;

  for (const [old, replacement] of Object.entries(REPLACEMENTS)) {
    if (result.includes(old)) {
      result = result.replaceAll(old, replacement);
      changes.push(`替换: ${old} -> ${replacement}`);
    }
  }

  return { text: result, changes };
}

/**
 * 删除段落开头的填充短语
 * @param {string} text
 * @returns {{ text: string, changes: string[] }}
 */
function removeFillers(text) {
  const changes = [];
  let result = text;

  for (const phrase of FILLER_PHRASES) {
    if (result.includes(phrase)) {
      // 删除段落开头的填充短语
      result = result.replaceAll('\n' + phrase, '\n');
      // 删除文本开头的填充短语
      if (result.startsWith(phrase)) {
        result = result.slice(phrase.length);
      }
      changes.push(`删除填充: ${phrase}`);
    }
  }

  return { text: result, changes };
}

/**
 * 拆分过长句子
 * @param {string} text
 * @returns {{ text: string, changes: string[] }}
 */
function simplifyExpressions(text) {
  const changes = [];
  const sentences = text.split('。');
  const simplified = [];

  for (const sentence of sentences) {
    if (sentence.length > 100) {
      const parts = sentence.split('，');
      if (parts.length > 2) {
        const mid = Math.floor(parts.length / 2);
        const newSentence = parts.slice(0, mid).join('，') + '。\n' + parts.slice(mid).join('，');
        simplified.push(newSentence);
        changes.push('断句: 长句拆分');
        continue;
      }
    }
    simplified.push(sentence);
  }

  return { text: simplified.join('。'), changes };
}

/**
 * 增加表达变化性（替换高频重复词）
 * @param {string} text
 * @returns {{ text: string, changes: string[] }}
 */
function addVariation(text) {
  const changes = [];
  let result = text;

  for (const { word, alternatives } of VARIATION_REPLACEMENTS) {
    const count = result.split(word).length - 1;
    if (count > VARIATION_THRESHOLD) {
      const replaceCount = Math.min(count - 2, alternatives.length);
      for (let i = 0; i < replaceCount; i++) {
        result = result.replace(word, alternatives[i]);
        changes.push(`变化: ${word} -> ${alternatives[i]}`);
      }
    }
  }

  return { text: result, changes };
}

/**
 * 对文本执行完整的 AI 去痕处理
 * @param {string} text - 原始文本
 * @returns {{ text: string, changes: string[] }}
 */
function humanize(text) {
  if (!text) return { text: '', changes: [] };

  const allChanges = [];

  let result = replaceAiPhrases(text);
  allChanges.push(...result.changes);

  result = removeFillers(result.text);
  allChanges.push(...result.changes);

  result = simplifyExpressions(result.text);
  allChanges.push(...result.changes);

  result = addVariation(result.text);
  allChanges.push(...result.changes);

  return { text: result.text, changes: allChanges };
}

/**
 * 对章节列表执行去痕处理
 * @param {Array<{title: string, content: string}>} chapters
 * @returns {{ chapters: Array, totalChanges: number }}
 */
function humanizeChapters(chapters) {
  if (!Array.isArray(chapters)) return { chapters, totalChanges: 0 };

  let totalChanges = 0;
  const processed = chapters.map((chapter) => {
    const { text, changes } = humanize(chapter.content);
    totalChanges += changes.length;
    return { ...chapter, content: text };
  });

  return { chapters: processed, totalChanges };
}

module.exports = {
  humanize,
  humanizeChapters,
  replaceAiPhrases,
  removeFillers,
  simplifyExpressions,
  addVariation,
  REPLACEMENTS,
  FILLER_PHRASES,
};
