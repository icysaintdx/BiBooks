// 内容生成阶段消费 formatTemplateTables 冒烟测试
// 直接调用 buildChapterContentMessages / buildChapterContentPlanMessages，
// 验证：有 formatTemplateTables 时 prompt 注入格式范本；无时不注入。
const assert = require('node:assert/strict');
const { buildChapterContentMessages, buildChapterContentPlanMessages } = require('../electron/services/contentGenerationTask.cjs');

function findUserMessages(messages) {
  return messages.filter((m) => m.role === 'user').map((m) => m.content);
}

function allContent(messages) {
  return messages.map((m) => m.content).join('\n');
}

async function main() {
  const sampleFormatTemplate = '## 第六章 格式1：投标函\n| 项目 | 内容要求 |\n|------|----------|\n| 投标人名称 | 填写全称 |';
  const sampleChapter = { id: '1.1.1', title: '投标函正文', description: '投标函具体内容' };
  const sampleParentWithRef = [{ id: '1', title: '投标函', description: '投标函部分', format_ref: '按第六章格式1编写' }];
  const sampleParentNoRef = [{ id: '2', title: '技术方案', description: '技术方案部分' }];

  // 场景 1：有 formatTemplateTables + parent 有 format_ref → 编排 prompt 包含格式范本
  {
    const messages = buildChapterContentPlanMessages({
      chapter: sampleChapter,
      parentChapters: sampleParentWithRef,
      siblingChapters: [],
      projectOverview: '测试项目',
      bidAnalysisFactsText: '',
      globalFactTitlesText: '',
      regenerateRequirement: '',
      tableRequirement: 'moderate',
      maxTables: 5,
      tableTotalSections: 10,
      imageGenerationAvailable: false,
      mermaidGenerationAvailable: false,
      maxAiImages: 0,
      totalSections: 10,
      knowledgeItems: [],
      formatTemplateTables: sampleFormatTemplate,
    });
    const content = allContent(messages);
    assert.ok(content.includes('格式范本模板'), '场景1编排prompt应包含格式范本模板');
    assert.ok(content.includes('第六章 格式1'), '场景1编排prompt应包含具体格式内容');
    console.log('[场景1] 编排 prompt 有 formatTemplateTables → 包含格式范本：通过');
  }

  // 场景 2：有 formatTemplateTables + parent 有 format_ref → 内容 prompt 包含格式范本 + format_ref 提示
  {
    const messages = buildChapterContentMessages({
      chapter: sampleChapter,
      parentChapters: sampleParentWithRef,
      siblingChapters: [],
      projectOverview: '测试项目',
      industryContext: '',
      selectedFactsText: '',
      regenerateRequirement: '',
      contentPlan: null,
      knowledgeContents: [],
      formatTemplateTables: sampleFormatTemplate,
    });
    const content = allContent(messages);
    assert.ok(content.includes('格式范本模板'), '场景2内容prompt应包含格式范本模板');
    assert.ok(content.includes('第六章 格式1'), '场景2内容prompt应包含具体格式内容');
    assert.ok(content.includes('按第六章格式1编写'), '场景2内容prompt应包含format_ref引用');
    assert.ok(content.includes('上级章节的格式要求'), '场景2内容prompt应包含上级章节格式要求提示');
    console.log('[场景2] 内容 prompt 有 formatTemplateTables + format_ref → 包含格式范本 + 引用提示：通过');
  }

  // 场景 3：有 formatTemplateTables + parent 无 format_ref → 内容 prompt 包含格式范本但无 format_ref 提示
  {
    const messages = buildChapterContentMessages({
      chapter: sampleChapter,
      parentChapters: sampleParentNoRef,
      siblingChapters: [],
      projectOverview: '测试项目',
      industryContext: '',
      selectedFactsText: '',
      regenerateRequirement: '',
      contentPlan: null,
      knowledgeContents: [],
      formatTemplateTables: sampleFormatTemplate,
    });
    const content = allContent(messages);
    assert.ok(content.includes('格式范本模板'), '场景3内容prompt应包含格式范本模板');
    assert.ok(!content.includes('上级章节的格式要求'), '场景3内容prompt不应包含上级章节格式要求提示（无format_ref）');
    console.log('[场景3] 内容 prompt 有 formatTemplateTables + 无 format_ref → 包含格式范本但无引用提示：通过');
  }

  // 场景 4：无 formatTemplateTables → prompt 不包含格式范本
  {
    const messages = buildChapterContentMessages({
      chapter: sampleChapter,
      parentChapters: sampleParentWithRef,
      siblingChapters: [],
      projectOverview: '测试项目',
      industryContext: '',
      selectedFactsText: '',
      regenerateRequirement: '',
      contentPlan: null,
      knowledgeContents: [],
      formatTemplateTables: '',
    });
    const content = allContent(messages);
    assert.ok(!content.includes('格式范本模板'), '场景4内容prompt不应包含格式范本模板');
    assert.ok(!content.includes('上级章节的格式要求'), '场景4内容prompt不应包含上级章节格式要求提示');
    console.log('[场景4] 无 formatTemplateTables → prompt 不含格式范本：通过');
  }

  // 场景 5：无 formatTemplateTables + 编排 prompt → 不包含格式范本
  {
    const messages = buildChapterContentPlanMessages({
      chapter: sampleChapter,
      parentChapters: sampleParentWithRef,
      siblingChapters: [],
      projectOverview: '测试项目',
      bidAnalysisFactsText: '',
      globalFactTitlesText: '',
      regenerateRequirement: '',
      tableRequirement: 'moderate',
      maxTables: 5,
      tableTotalSections: 10,
      imageGenerationAvailable: false,
      mermaidGenerationAvailable: false,
      maxAiImages: 0,
      totalSections: 10,
      knowledgeItems: [],
      formatTemplateTables: '',
    });
    const content = allContent(messages);
    assert.ok(!content.includes('格式范本模板'), '场景5编排prompt不应包含格式范本模板');
    console.log('[场景5] 无 formatTemplateTables + 编排 prompt → 不含格式范本：通过');
  }

  console.log('\n内容生成消费格式范本冒烟：全部通过');
}

main().catch((error) => {
  console.error('冒烟失败：', error);
  process.exit(1);
});
