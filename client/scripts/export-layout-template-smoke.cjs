const AdmZip = require('adm-zip');
const { buildDocxBuffer } = require('../electron/services/exportService.cjs');

async function main() {
  const buffer = await buildDocxBuffer({
    project_name: '版式模板导出测试',
    bidder_name: '测试投标单位',
    outline: [
      {
        id: '1',
        title: '测试章节',
        children: [
          {
            id: '1.1',
            title: '测试表格',
            content: [
              '正文段落用于检查字体、字号和行距。',
              '',
              '| 名称 | 数量 |',
              '| --- | ---: |',
              '| 设备 | 2 |',
            ].join('\n'),
          },
        ],
      },
    ],
  }, {
    layoutTemplate: {
      id: 'smoke-layout',
      name: 'Smoke Layout',
      industry: 'test',
      page: {
        size: 'A4',
        margin_top_mm: 12,
        margin_bottom_mm: 13,
        margin_left_mm: 17,
        margin_right_mm: 16,
        gutter_mm: 2,
      },
      header: {
        enabled: true,
        text: '{项目名称}',
        logo_path: '',
      },
      footer: {
        enabled: true,
        text: '{投标单位}',
        page_number_format: '第 {page} 页 / 共 {pages} 页',
      },
      typography: {
        body_font: 'Arial',
        body_size_pt: 11,
        line_spacing: 2,
        first_line_indent_chars: 1,
      },
      headings: [
        { level: 1, font: 'Calibri', size_pt: 20, bold: true, alignment: 'center', numbering: '' },
        { level: 2, font: 'Calibri', size_pt: 15, bold: true, alignment: 'left', numbering: '' },
        { level: 3, font: 'Calibri', size_pt: 13, bold: true, alignment: 'left', numbering: '' },
        { level: 4, font: 'Arial', size_pt: 11, bold: true, alignment: 'left', numbering: '' },
      ],
      tables: {
        header_fill: 'ABCDEF',
        border_color: '123456',
        repeat_header: true,
        allow_page_break: false,
      },
      images: {
        max_width_percent: 80,
        align: 'center',
        caption_enabled: true,
      },
    },
  });

  const zip = new AdmZip(buffer);
  const documentXml = zip.readAsText('word/document.xml');
  const stylesXml = zip.readAsText('word/styles.xml');
  const relsXml = zip.readAsText('word/_rels/document.xml.rels');
  const headerXml = zip.readAsText('word/header1.xml');
  const footerXml = zip.readAsText('word/footer1.xml');

  const expectedPageMargin = '<w:pgMar w:top="680" w:right="907" w:bottom="737" w:left="964"';
  if (!documentXml.includes(expectedPageMargin)) {
    throw new Error('layout template margins were not written to document.xml');
  }
  if (!documentXml.includes('<w:shd w:fill="ABCDEF" w:val="clear"/>')) {
    throw new Error('layout template table header fill was not written');
  }
  if (!documentXml.includes('w:color="123456"')) {
    throw new Error('layout template table border color was not written');
  }
  if (!documentXml.includes('<w:tblHeader/>')) {
    throw new Error('layout template repeat table header was not written');
  }
  if (!documentXml.includes('<w:cantSplit/>')) {
    throw new Error('layout template row page-break rule was not written');
  }
  if (!stylesXml.includes('w:ascii="Arial"') || !stylesXml.includes('w:ascii="Calibri"')) {
    throw new Error('layout template fonts were not written to styles.xml');
  }
  if (!stylesXml.includes('<w:sz w:val="22"/>')) {
    throw new Error('layout template body font size was not written');
  }
  if (!relsXml.includes('header') || !relsXml.includes('footer')) {
    throw new Error('layout template header/footer relationships were not written');
  }
  if (!headerXml.includes('版式模板导出测试')) {
    throw new Error('layout template header text was not rendered');
  }
  if (!footerXml.includes('测试投标单位') || !footerXml.includes('PAGE') || !footerXml.includes('NUMPAGES')) {
    throw new Error('layout template footer text/page numbers were not rendered');
  }

  console.log('export-layout-template smoke ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
