const { analyzeParsedMarkdown } = require('../electron/services/documentQuality.cjs');

const quality = analyzeParsedMarkdown([
  '# 项目标题',
  '',
  '| 序号 | 名称 | 数量 |',
  '| --- | --- | ---: |',
  '| 1 | 设备A | 2 |',
  '| 2 | 服务B | 3 |',
  '',
  '本项目需要完成系统建设和运维服务。',
].join('\n'));

if (quality.tableCount !== 1) throw new Error(`table count mismatch: ${quality.tableCount}`);
if (quality.tableRowCount !== 2) throw new Error(`table row count mismatch: ${quality.tableRowCount}`);
if (quality.headingCount !== 1) throw new Error(`heading count mismatch: ${quality.headingCount}`);

const bad = analyzeParsedMarkdown('ÃÂ â€ 锟 鏂 鎶 绛');
if (!bad.warnings.some((warning) => warning.code === 'suspected_mojibake')) {
  throw new Error('mojibake warning missing');
}

const empty = analyzeParsedMarkdown('');
if (!empty.warnings.some((warning) => warning.code === 'empty_content')) {
  throw new Error('empty warning missing');
}

console.log('document-quality smoke ok');
