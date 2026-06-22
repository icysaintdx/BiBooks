const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const { createSqliteDatabase } = require('../electron/services/sqliteDatabase.cjs');
const { createKnowledgeBaseStore } = require('../electron/services/knowledgeBaseStore.cjs');
const { createProjectWorkspaceStore } = require('../electron/services/projectWorkspaceStore.cjs');
const { createTechnicalPlanStore } = require('../electron/services/technicalPlanStore.cjs');
const { createFileService } = require('../electron/services/fileService.cjs');
const { buildDocxBuffer } = require('../electron/services/exportService.cjs');

const TEST_ROOT = 'F:\\测试标';
const TENDER_DOCX = path.join(TEST_ROOT, '虞城县控制性详细规划编制项目-招标文件(1).docx');
const OFFICIAL_BID_DOCX = path.join(TEST_ROOT, '（中弘）虞城县中心城区控制性详细规划编制项目1.docx');
const OFFICIAL_BID_PDF = path.join(TEST_ROOT, '中弘-虞城县中心城区控制性详细规划编制项目(1).pdf');
const ARTIFACT_ROOT = path.resolve(__dirname, '..', '..', 'BiBooks-test-artifacts', 'yucheng');
const CURATED_DIR = path.join(ARTIFACT_ROOT, 'knowledge-materials-curated');
const GENERATED_DIR = path.join(ARTIFACT_ROOT, 'generated');
const FOLDER_NAME = '测试-虞城正式投标文件素材';
const PROJECT_NAME = '虞城县控制性详细规划编制项目-全流程测试';

function now() {
  return new Date().toISOString();
}

function stableHash(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

function safeName(value) {
  return String(value || '未命名')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || '未命名';
}

function contentChars(text) {
  return String(text || '').replace(/\s+/g, '').length;
}

function stripBold(text) {
  return String(text || '').trim().replace(/^\*\*(.+)\*\*$/, '$1').trim();
}

function stripPageNumber(title) {
  return String(title || '').replace(/\s+\d+\s*$/, '').trim();
}

function mkdirClean(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function assertFiles() {
  for (const filePath of [TENDER_DOCX, OFFICIAL_BID_DOCX, OFFICIAL_BID_PDF]) {
    assert.ok(fs.existsSync(filePath), `missing test file: ${filePath}`);
  }
}

function createFileParser() {
  return createFileService({
    app,
    configStore: {
      load: () => ({
        file_parser: { provider: 'auto' },
      }),
    },
  });
}

async function parseSourceFiles(fileService) {
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const officialBid = await fileService.importDocument({ sourcePath: OFFICIAL_BID_DOCX });
  assert.equal(officialBid.success, true, officialBid.message || 'official bid parse failed');
  const tender = await fileService.importDocument({ sourcePath: TENDER_DOCX });
  assert.equal(tender.success, true, tender.message || 'tender parse failed');
  const officialPdf = await fileService.importDocument({ sourcePath: OFFICIAL_BID_PDF });
  assert.equal(officialPdf.success, true, officialPdf.message || 'official pdf parse failed');

  fs.writeFileSync(path.join(ARTIFACT_ROOT, 'official-bid-full.md'), `${officialBid.file_content.trim()}\n`, 'utf-8');
  fs.writeFileSync(path.join(ARTIFACT_ROOT, 'tender-full.md'), `${tender.file_content.trim()}\n`, 'utf-8');
  fs.writeFileSync(path.join(ARTIFACT_ROOT, 'official-bid-pdf-full.md'), `${officialPdf.file_content.trim()}\n`, 'utf-8');

  return {
    officialBidMarkdown: officialBid.file_content.trim(),
    tenderMarkdown: tender.file_content.trim(),
    officialPdfMarkdown: officialPdf.file_content.trim(),
    parserSummary: {
      tender: { parser: tender.parser_label, chars: tender.file_content.length },
      officialBidDocx: { parser: officialBid.parser_label, chars: officialBid.file_content.length },
      officialBidPdf: { parser: officialPdf.parser_label, chars: officialPdf.file_content.length },
    },
  };
}

const expectedChapters = [
  { number: 1, title: '投标函' },
  { number: 2, title: '投标函附录' },
  { number: 3, title: '法定代表人身份证明书' },
  { number: 4, title: '授权委托书' },
  { number: 5, title: '反商业贿赂承诺书' },
  { number: 6, title: '投标单位基本情况表' },
  { number: 7, title: '拟派项目组人员表' },
  { number: 8, title: '经营业绩一览表' },
  { number: 9, title: '中小企业声明函（服务）' },
  { number: 10, title: '供应商认为应该提交的其他资料' },
  { number: 11, title: '规划设计方案' },
];

function findChapterStarts(lines) {
  const catalogEnd = lines.findIndex((line) => /^（11）规划设计方案\s+\d+\s*$/.test(line.trim()));
  const starts = [];
  const used = new Set();
  for (let index = Math.max(0, catalogEnd + 1); index < lines.length; index += 1) {
    const line = stripPageNumber(stripBold(lines[index]));
    const match = /^（(\d{1,2})）(.+)$/.exec(line);
    if (!match) continue;
    const number = Number(match[1]);
    const expected = expectedChapters.find((item) => item.number === number);
    if (!expected || used.has(number)) continue;
    if (!match[2].includes(expected.title)) continue;
    starts.push({ number, title: expected.title, start: index });
    used.add(number);
  }
  starts.sort((a, b) => a.start - b.start);
  return starts;
}

function splitTopChapter(content, chapterTitle) {
  const lines = content.split(/\r?\n/);
  const starts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].trim();
    const title = stripBold(raw);
    if (!/^\*\*.+\*\*$/.test(raw)) continue;
    if (/^\d+、/.test(title) || /^[一二三四五六七八九十]+、/.test(title)) {
      starts.push({ title, start: index });
    }
  }
  if (!starts.length) return [];
  return starts.map((item, index) => {
    const end = starts[index + 1]?.start ?? lines.length;
    return {
      title: `${chapterTitle}-${item.title}`,
      content: lines.slice(item.start, end).join('\n').trim(),
    };
  }).filter((item) => contentChars(item.content) >= 120);
}

function createCuratedMaterials(markdown) {
  mkdirClean(CURATED_DIR);
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const starts = findChapterStarts(lines);
  assert.equal(starts.length, expectedChapters.length, `expected ${expectedChapters.length} top-level chapters, got ${starts.length}`);

  const catalogStart = lines.findIndex((line) => stripBold(line).replace(/\s+/g, '') === '目录');
  const coverEnd = starts[0].start;
  const materials = [];
  materials.push({
    slug: '00_封面上传索引与目录参考',
    title: '封面、上传索引与目录参考',
    group: 'front_matter',
    content: lines.slice(0, coverEnd).join('\n').trim(),
  });

  starts.forEach((item, index) => {
    const end = starts[index + 1]?.start ?? lines.length;
    const content = lines.slice(item.start, end).join('\n').trim();
    const slug = `${String(item.number).padStart(2, '0')}_${item.title}`;
    materials.push({
      slug,
      title: item.title,
      group: item.number <= 9 ? 'commercial_core' : item.number === 10 ? 'commercial_supplement' : 'technical_scheme',
      content,
    });
    if (item.number === 10 || item.number === 11) {
      splitTopChapter(content, item.title).forEach((part, partIndex) => {
        materials.push({
          slug: `${String(item.number).padStart(2, '0')}_${String(partIndex + 1).padStart(2, '0')}_${safeName(part.title.replace(`${item.title}-`, ''))}`,
          title: part.title,
          group: item.number === 10 ? 'commercial_supplement_detail' : 'technical_scheme_detail',
          content: part.content,
        });
      });
    }
  });

  const manifest = {
    sourceFile: OFFICIAL_BID_DOCX,
    generatedAt: now(),
    note: 'Codex 测试用素材拆分，不是 BiBooks 产品功能。',
    total: materials.length,
    materials: [],
  };

  for (const [index, item] of materials.entries()) {
    const fileName = `${String(index).padStart(2, '0')}_${safeName(item.slug)}.md`;
    const filePath = path.join(CURATED_DIR, fileName);
    const header = [
      `# ${item.title}`,
      '',
      '> 来源：正式投标文件拆分测试素材。仅用于本轮 BiBooks 流程验证。',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, `${header}${item.content.trim()}\n`, 'utf-8');
    manifest.materials.push({
      index,
      title: item.title,
      group: item.group,
      fileName,
      chars: item.content.length,
      contentChars: contentChars(item.content),
    });
  }
  writeJson(path.join(CURATED_DIR, 'manifest.json'), manifest);
  return { materials, manifest };
}

function splitIntoBlocks(content, title) {
  const blocks = [];
  const chunks = String(content || '')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => contentChars(chunk) >= 20);
  for (const [index, chunk] of chunks.entries()) {
    blocks.push({
      id: `P${String(index + 1).padStart(6, '0')}`,
      type: /^<table[\s>]/i.test(chunk) ? 'table' : 'paragraph',
      heading_path: [title],
      content: chunk,
    });
  }
  if (!blocks.length) {
    blocks.push({
      id: 'P000001',
      type: 'paragraph',
      heading_path: [title],
      content: String(content || '').trim(),
    });
  }
  return blocks;
}

function importMaterialsToKnowledgeBase(db, materials) {
  const store = createKnowledgeBaseStore({ app, db });
  const folder = store.createFolder(`${FOLDER_NAME}-${new Date().toISOString().slice(0, 10)}`);
  const imported = [];

  for (const [index, material] of materials.entries()) {
    const documentId = `doc-yucheng-${Date.now()}-${String(index).padStart(2, '0')}`;
    const documentDir = path.join('folders', folder.id, 'documents', documentId).replace(/\\/g, '/');
    const sourcePath = path.join(documentDir, 'source.md').replace(/\\/g, '/');
    const markdownPath = path.join(documentDir, 'content.md').replace(/\\/g, '/');
    fs.mkdirSync(store.resolvePath(documentDir), { recursive: true });
    fs.writeFileSync(store.resolvePath(sourcePath), `${material.content.trim()}\n`, 'utf-8');
    fs.writeFileSync(store.resolvePath(markdownPath), `${material.content.trim()}\n`, 'utf-8');
    const document = store.createDocument({
      id: documentId,
      folder_id: folder.id,
      file_name: `${safeName(material.title)}.md`,
      document_dir: documentDir,
      source_path: sourcePath,
      markdown_path: markdownPath,
      source_extension: '.md',
      status: 'success',
      progress: 100,
      message: 'Codex 测试素材已导入',
      parser_label: 'Codex 测试拆分',
      created_at: now(),
      updated_at: now(),
    });
    store.updateMarkdownMetadata(document.id, material.content, 'Codex 测试拆分');
    const blocks = splitIntoBlocks(material.content, material.title);
    const finalItem = {
      id: 'K000001',
      title: material.title,
      resume: `来自正式投标文件的“${material.title}”章节，可作为同类标书编制参考。`,
      content: material.content,
      source_file: path.basename(OFFICIAL_BID_DOCX),
      source_block_ids: blocks.map((block) => block.id),
    };
    store.saveBlocks(document.id, blocks, []);
    store.saveCandidateItems(document.id, [{ id: finalItem.id, title: finalItem.title, summary: finalItem.resume }]);
    store.saveMatchResult(document.id, {
      candidateItems: [{ id: finalItem.id, title: finalItem.title, summary: finalItem.resume }],
      finalItems: [finalItem],
      matchResult: { discarded: [], system_discarded_after_retry: [] },
      report: {
        total_blocks: blocks.length,
        filtered_blocks_count: 0,
        candidate_items_count: 1,
        final_items_count: 1,
        matched_blocks_count: blocks.length,
        discarded_blocks_count: 0,
        system_discarded_after_retry_count: 0,
        new_items_from_recovery_count: 0,
        recovery_attempt_count: 0,
        batch_size: 1,
        coverage_rate: 1,
        matched_rate: 1,
        created_at: now(),
      },
    });
    store.updateDocument(document.id, {
      status: 'success',
      progress: 100,
      message: 'Codex 测试素材已导入',
      item_count: 1,
      block_count: blocks.length,
      candidate_item_count: 1,
    });
    imported.push({ documentId: document.id, title: material.title, blockCount: blocks.length });
  }

  return { folder, imported };
}

function materialByTitle(materials, title) {
  return materials.find((item) => item.title === title) || null;
}

function materialDetails(materials, group) {
  return materials.filter((item) => item.group === group);
}

function createBaselineOutline(materials) {
  const commercialTitles = expectedChapters.slice(0, 10).map((item) => item.title);
  const commercialChildren = commercialTitles.map((title, index) => {
    const material = materialByTitle(materials, title);
    return material ? {
      id: `commercial_${String(index + 1).padStart(2, '0')}`,
      title,
      description: `复用正式投标文件 ${title} 结构`,
      content: material.content,
    } : null;
  }).filter(Boolean);

  const technicalDetails = materialDetails(materials, 'technical_scheme_detail');
  const technicalChildren = technicalDetails.length
    ? technicalDetails.map((item, index) => ({
      id: `technical_${String(index + 1).padStart(2, '0')}`,
      title: item.title.replace(/^规划设计方案-/, ''),
      description: '从正式投标技术方案拆分的可复用章节',
      content: item.content,
    }))
    : [{
      id: 'technical_01',
      title: '规划设计方案',
      content: materialByTitle(materials, '规划设计方案')?.content || '',
    }];

  return {
    project_name: PROJECT_NAME,
    project_overview: '基于虞城县控制性详细规划编制项目招标文件创建的 Codex 全流程测试项目。',
    outline: [
      {
        id: 'commercial',
        title: '商务响应文件',
        description: '投标函、资质、人员、业绩、承诺等商务材料。',
        children: commercialChildren,
      },
      {
        id: 'technical',
        title: '规划设计方案',
        description: '项目认识、工作内容、进度计划、质量保障、技术路线、成果与服务承诺。',
        children: technicalChildren,
      },
    ],
  };
}

const testLayoutTemplate = {
  id: 'codex-yucheng-a4',
  name: 'Codex 虞城测试 A4 模板',
  industry: '国土空间规划',
  page: {
    size: 'A4',
    margin_top_mm: 25,
    margin_bottom_mm: 25,
    margin_left_mm: 28,
    margin_right_mm: 25,
    gutter_mm: 0,
  },
  header: {
    enabled: true,
    text: '虞城县中心城区控制性详细规划编制项目',
    logo_path: '',
  },
  footer: {
    enabled: true,
    text: '中弘设计集团有限公司',
    page_number_format: '第 {page} 页 / 共 {pages} 页',
  },
  cover: {
    title: '虞城县中心城区控制性详细规划编制项目',
    subtitle: '投标文件',
    bidder_label: '投标单位',
    tenderer_label: '招标单位',
    date_label: '日期',
    show_logo_placeholder: false,
    logo_path: '',
  },
  toc: {
    show_page_numbers: true,
    page_number_format: '第 {page} 页 / 共 {pages} 页',
    leader: 'dot',
    max_level: 3,
  },
  preview: {
    show_guides: true,
    show_rulers: true,
  },
  typography: {
    body_font: '宋体',
    body_size_pt: 12,
    line_spacing: 1.5,
    first_line_indent_chars: 2,
  },
  headings: [
    { level: 1, font: '黑体', size_pt: 22, bold: true, alignment: 'center', numbering: '一、' },
    { level: 2, font: '黑体', size_pt: 16, bold: true, alignment: 'left', numbering: '（一）' },
    { level: 3, font: '黑体', size_pt: 14, bold: true, alignment: 'left', numbering: '1.' },
    { level: 4, font: '宋体', size_pt: 12, bold: true, alignment: 'left', numbering: '（1）' },
  ],
  tables: {
    header_fill: 'F1F6FF',
    border_color: 'DCDFF6',
    repeat_header: true,
    allow_page_break: true,
  },
  images: {
    max_width_percent: 92,
    align: 'center',
    caption_enabled: true,
  },
};

function flattenLeaves(items) {
  return (items || []).flatMap((item) => item.children?.length ? flattenLeaves(item.children) : [item]);
}

function saveProjectSnapshot(db, projectId, technicalPlanStore) {
  const snapshot = technicalPlanStore.exportTechnicalPlanSnapshot();
  const timestamp = now();
  db.prepare(`
    INSERT INTO app_project_snapshots (project_id, technical_plan_state_json, technical_plan_markdown, created_at, updated_at)
    VALUES (@project_id, @state_json, @markdown, @created_at, @updated_at)
    ON CONFLICT(project_id) DO UPDATE SET
      technical_plan_state_json = excluded.technical_plan_state_json,
      technical_plan_markdown = excluded.technical_plan_markdown,
      updated_at = excluded.updated_at
  `).run({
    project_id: projectId,
    state_json: JSON.stringify(snapshot.state || null),
    markdown: snapshot.markdown || '',
    created_at: timestamp,
    updated_at: timestamp,
  });
}

async function createProjectAndBaseline(db, fileService, materials, imported) {
  const technicalPlanStore = createTechnicalPlanStore({ app, db, fileService });
  const projectStore = createProjectWorkspaceStore({ app, db, technicalPlanStore });
  const state = projectStore.create({
    name: PROJECT_NAME,
    tenderSourcePath: TENDER_DOCX,
    notes: 'Codex 自动创建的虞城全流程测试项目，用于验证本地解析、知识库素材复用和导出质量。',
  });
  const project = state.project;
  assert.ok(project?.id, 'project was not created');
  assert.ok(project?.tenderFilePath && fs.existsSync(project.tenderFilePath), 'tender file was not copied into project source dir');

  const importedTender = await technicalPlanStore.importTenderDocument({ sourcePath: project.tenderFilePath });
  assert.equal(importedTender.success, true, importedTender.message || 'failed to import tender into technical plan');

  const outlineData = createBaselineOutline(materials);
  technicalPlanStore.saveOutlineConfig({
    outlineMode: 'aligned',
    referenceKnowledgeDocumentIds: imported.imported.map((item) => item.documentId),
  });
  technicalPlanStore.saveOutline(outlineData);
  for (const leaf of flattenLeaves(outlineData.outline)) {
    technicalPlanStore.saveChapterContent({ nodeId: leaf.id, content: leaf.content || '' });
  }
  technicalPlanStore.updateStep('expand');
  saveProjectSnapshot(db, project.id, technicalPlanStore);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const outputDocx = path.join(GENERATED_DIR, 'bibooks-yucheng-baseline.docx');
  const buffer = await buildDocxBuffer({
    project_name: PROJECT_NAME,
    bidder_name: '中弘设计集团有限公司',
    tenderer_name: '虞城县国土空间规划编制研究中心',
    date: '2025年11月21日',
    doc_type: '投标文件',
    outline: outlineData.outline,
  }, { warnings: [], layoutTemplate: testLayoutTemplate });
  fs.writeFileSync(outputDocx, buffer);

  return {
    project,
    tenderMarkdownChars: importedTender.markdown.length,
    outlineLeafCount: flattenLeaves(outlineData.outline).length,
    outputDocx,
  };
}

function inspectDocx(filePath) {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  const documentXml = zip.readAsText('word/document.xml');
  return {
    bytes: fs.statSync(filePath).size,
    tableCount: (documentXml.match(/<w:tbl\b/g) || []).length,
    sectionCount: (documentXml.match(/<w:sectPr\b/g) || []).length,
    headerFiles: entries.filter((name) => /^word\/header\d+\.xml$/.test(name)).length,
    footerFiles: entries.filter((name) => /^word\/footer\d+\.xml$/.test(name)).length,
    markdownTableResidue: /\|\s*-{3,}\s*\|/.test(documentXml),
    containsPageNumberField: /w:fldChar|PAGE|NUMPAGES/.test(documentXml),
  };
}

function createComparisonReport({ parserSummary, manifest, imported, projectResult, docxInspection }) {
  const reportPath = path.join(ARTIFACT_ROOT, 'yucheng-workflow-report.md');
  const lines = [
    '# 虞城项目全流程测试报告',
    '',
    `生成时间：${now()}`,
    '',
    '## 实际执行',
    '',
    `- 招标文件本地解析：${parserSummary.tender.chars} 字符，解析器：${parserSummary.tender.parser}`,
    `- 正式投标 DOCX 本地解析：${parserSummary.officialBidDocx.chars} 字符，解析器：${parserSummary.officialBidDocx.parser}`,
    `- 正式投标 PDF 本地解析：${parserSummary.officialBidPdf.chars} 字符，解析器：${parserSummary.officialBidPdf.parser}`,
    `- 拆分测试素材：${manifest.total} 份`,
    `- 导入知识库文件夹：${imported.folder.name}`,
    `- 导入知识库文档：${imported.imported.length} 份`,
    `- 创建测试项目：${projectResult.project.name}`,
    `- 测试项目目录：${projectResult.project.projectDir}`,
    `- 项目内招标文件：${projectResult.project.tenderFilePath}`,
    `- 技术方案招标解析文本：${projectResult.tenderMarkdownChars} 字符`,
    `- 基线大纲叶子章节：${projectResult.outlineLeafCount} 个`,
    `- 生成基线 DOCX：${projectResult.outputDocx}`,
    '',
    '## DOCX 结构检查',
    '',
    `- 文件大小：${docxInspection.bytes} bytes`,
    `- 真实 Word 表格数量：${docxInspection.tableCount}`,
    `- Section 数量：${docxInspection.sectionCount}`,
    `- 页眉文件数量：${docxInspection.headerFiles}`,
    `- 页脚文件数量：${docxInspection.footerFiles}`,
    `- 是否残留 Markdown 表格分隔线：${docxInspection.markdownTableResidue ? '是' : '否'}`,
    `- 是否包含页码字段：${docxInspection.containsPageNumberField ? '是' : '否'}`,
    '',
    '## 质量差距判断',
    '',
    '- 这份基线 DOCX 能验证：本地解析、项目招标文件复制、知识库导入、参考材料复用、真实表格导出、封面/目录/正文三节导出链路。',
    '- 它不是 AI 独立生成结果：当前未调用云端 API，也未调用本地大模型，所以内容主要来自正式投标文件拆分材料重组。',
    '- 与正式投标文件相比，缺口主要是：扫描件/图片附件没有从 PDF/DOCX 中完整还原，报价仍需从报价模块录入，商务证照 OCR 还未真实跑入企业知识库，目录页码需要 Word 打开后更新域才能精确。',
    '- 如果接入本地模型，下一轮应测试：招标文件解析 -> 自动大纲 -> 引用知识库生成正文 -> 交付检查 -> 完整合并导出。',
    '',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf-8');
  return reportPath;
}

async function main() {
  assertFiles();
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const dbPath = path.join(app.getPath('userData'), 'workspace', 'yibiao.sqlite');
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(ARTIFACT_ROOT, `yibiao-before-yucheng-${Date.now()}.sqlite.bak`);
    fs.copyFileSync(dbPath, backupPath);
  }

  const sqliteDatabase = createSqliteDatabase(app);
  try {
    const fileService = createFileParser();
    const parsed = await parseSourceFiles(fileService);
    const { materials, manifest } = createCuratedMaterials(parsed.officialBidMarkdown);
    const imported = importMaterialsToKnowledgeBase(sqliteDatabase.db, materials);
    const projectResult = await createProjectAndBaseline(sqliteDatabase.db, fileService, materials, imported);
    const docxInspection = inspectDocx(projectResult.outputDocx);
    const reportPath = createComparisonReport({
      parserSummary: parsed.parserSummary,
      manifest,
      imported,
      projectResult,
      docxInspection,
    });

    console.log(JSON.stringify({
      ok: true,
      artifacts: {
        curatedDir: CURATED_DIR,
        generatedDir: GENERATED_DIR,
        reportPath,
        outputDocx: projectResult.outputDocx,
      },
      parserSummary: parsed.parserSummary,
      importedKnowledge: {
        folder: imported.folder,
        documentCount: imported.imported.length,
      },
      project: {
        id: projectResult.project.id,
        name: projectResult.project.name,
        projectDir: projectResult.project.projectDir,
        tenderFilePath: projectResult.project.tenderFilePath,
      },
      docxInspection,
    }, null, 2));
  } finally {
    sqliteDatabase.close?.();
  }
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
