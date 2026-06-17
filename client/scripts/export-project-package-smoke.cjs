const AdmZip = require('adm-zip');
const { buildDocxBuffer } = require('../electron/services/exportService.cjs');

async function main() {
  const buffer = await buildDocxBuffer({
    project_name: '完整标书导出测试',
    doc_type: '完整投标文件',
    outline: [
      {
        id: '第一部分',
        title: '技术标',
        children: [
          {
            id: '1',
            title: '项目实施方案',
            content: '本章节为技术方案正文。',
          },
        ],
      },
      {
        id: '第二部分',
        title: '商务标',
        content: [
          '# 商务标',
          '',
          '## 资质证明材料',
          '',
          '| 资质名称 | 证书编号 | 有效期截止 |',
          '| --- | --- | --- |',
          '| 营业执照 | ABC123 | 2028-12-31 |',
        ].join('\n'),
      },
      {
        id: '第三部分',
        title: '报价文件',
        content: [
          '# 报价文件',
          '',
          '| 序号 | 名称 | 数量 | 单价（元） | 小计（元） |',
          '| --- | --- | ---: | ---: | ---: |',
          '| 1 | 服务项 | 2 | 1000.00 | 2000.00 |',
          '',
          '- 含税合计：2,260.00 元',
        ].join('\n'),
      },
    ],
  });

  const zip = new AdmZip(buffer);
  const documentXml = zip.readAsText('word/document.xml');
  const tableCount = (documentXml.match(/<w:tbl>/g) || []).length;
  if (!documentXml.includes('完整标书导出测试')) {
    throw new Error('project package title missing from export');
  }
  if (!documentXml.includes('商务标') || !documentXml.includes('报价文件')) {
    throw new Error('project package sections missing from export');
  }
  if (tableCount < 2) {
    throw new Error(`expected at least 2 Word tables, got ${tableCount}`);
  }
  if (documentXml.includes('内容由 AI 生成')) {
    throw new Error('formal project export contains internal AI marker');
  }

  console.log('export-project-package smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
