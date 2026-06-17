const { app } = require('electron');
const AdmZip = require('adm-zip');
const { buildDocxBuffer } = require('../electron/services/exportService.cjs');

app.whenReady().then(async () => {
  const buffer = await buildDocxBuffer({
    project_name: 'table export smoke',
    bidder_name: 'test bidder',
    outline: [
      {
        id: '1',
        title: 'table chapter',
        children: [
          {
            id: '1.1',
            title: 'table section',
            content: [
              'normal markdown table:',
              '',
              '| no | name | qty |',
              '| --- | --- | ---: |',
              '| 1 | device A | 2 |',
              '| 2 | service B | 3 |',
              '',
              'delimiter-first malformed table:',
              '| --- | --- | --- |',
              '| qualification | code | valid_to |',
              '| license | 913000000000000000 | 2028-01-01 |',
              '',
              'pipe table without delimiter:',
              '| item | qty | note |',
              '| service | 1 | should become a Word table |',
            ].join('\n'),
          },
        ],
      },
    ],
  }, {
    layoutTemplate: {
      page: {
        size: 'A4',
        margin_top_mm: 20,
        margin_bottom_mm: 20,
        margin_left_mm: 25,
        margin_right_mm: 25,
        gutter_mm: 0,
      },
      header: {
        enabled: true,
        text: '{项目名称}',
      },
      footer: {
        enabled: true,
        text: '{投标单位}',
        page_number_format: 'Page {page} / {pages}',
      },
      typography: {
        body_font: 'Arial',
        body_size_pt: 11,
        line_spacing: 1.5,
        first_line_indent_chars: 2,
      },
      headings: [],
      tables: {
        repeat_header: true,
        allow_page_break: false,
      },
      images: {},
    },
  });

  const zip = new AdmZip(buffer);
  const documentXml = zip.readAsText('word/document.xml');
  const tableCount = (documentXml.match(/<w:tbl>/g) || []).length;
  const sectionCount = (documentXml.match(/<w:sectPr/g) || []).length;
  const entries = zip.getEntries().map((entry) => entry.entryName);

  if (tableCount < 3) {
    throw new Error(`expected at least 3 Word tables, got ${tableCount}`);
  }
  if (documentXml.includes('| ---') || documentXml.includes('--- |') || documentXml.includes('w:t>---')) {
    throw new Error('markdown table delimiter leaked into docx document.xml');
  }
  if (sectionCount < 3) {
    throw new Error(`expected cover/toc/body sections, got ${sectionCount}`);
  }
  if (!entries.some((name) => /^word\/header\d+\.xml$/.test(name))) {
    throw new Error('docx package is missing header xml');
  }
  if (!entries.some((name) => /^word\/footer\d+\.xml$/.test(name))) {
    throw new Error('docx package is missing footer xml');
  }

  console.log('export-table smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
