// 大纲"招标格式优先"路由冒烟测试
// 用假 aiService + 内存 workspaceStore 驱动 runOutlineGenerationTask，
// 验证：招标文件规定了投标文件组成时走招标格式骨架；否则回退评分对齐/自由生成。
const assert = require('node:assert/strict');
const { runOutlineGenerationTask } = require('../electron/services/outlineGenerationTask.cjs');

// 一个最小的三级目录，满足 validateCompleteOutline（深度>=3）
function sampleOutline() {
  return {
    outline: [
      {
        id: '1',
        title: '一级A',
        description: '一级A描述',
        children: [
          { id: '1.1', title: '二级A1', description: '二级A1', children: [{ id: '1.1.1', title: '三级A11', description: '三级A11' }] },
        ],
      },
    ],
  };
}

function sampleTopLevel() {
  return { outline: [{ id: '1', title: '投标函', description: '投标函部分' }] };
}

function sampleChildren() {
  return { children: [{ id: '1.1', title: '二级', description: '二级', children: [{ id: '1.1.1', title: '三级', description: '三级' }] }] };
}

function sampleGroups() {
  return { groups: [{ requirement_id: 'R1', title: '规划设计方案', description: '规划设计方案大类', detail_points: ['总体构思'] }] };
}

// 假 aiService：记录每次调用用到的 system 提示词，按提示词类型返回对应假数据
function createFakeAiService(callLog) {
  async function collectJsonResponse(options) {
    const systemMessage = (options.messages || []).find((m) => m.role === 'system')?.content || '';
    const userMessages = (options.messages || []).filter((m) => m.role === 'user').map((m) => m.content).join('\n');
    callLog.push({ system: systemMessage, user: userMessages, label: options.progressLabel });

    let raw;
    if (systemMessage.includes('招标文件已经明确规定了投标文件的组成')) {
      raw = sampleTopLevel(); // 招标格式优先：一级目录骨架
    } else if (systemMessage.includes('生成二级和三级目录') || options.progressLabel?.includes('子目录')) {
      raw = sampleChildren();
    } else if (systemMessage.includes('提取适合作为技术标一级目录的评分大类')) {
      raw = sampleGroups();
    } else if (systemMessage.includes('生成投标文件中技术标部分的一级目录结构')) {
      raw = sampleTopLevel();
    } else if (options.progressLabel === '完整目录') {
      raw = sampleOutline();
    } else if (systemMessage.includes('审核') || options.progressLabel?.includes('审核')) {
      raw = { passed: true, suggestions: [] };
    } else {
      // 兜底：返回完整目录
      raw = sampleOutline();
    }
    const normalized = options.normalizer ? options.normalizer(raw) : raw;
    if (options.validator) options.validator(normalized);
    return normalized;
  }
  return { collectJsonResponse, isDeveloperMode: () => false };
}

// 内存 workspaceStore：只实现 runOutlineGenerationTask 用到的方法
function createFakeWorkspaceStore(storedPlan, tenderMarkdown) {
  let plan = { ...storedPlan };
  return {
    loadTechnicalPlan: () => plan,
    updateTechnicalPlan: (partial) => { plan = { ...plan, ...partial }; return plan; },
    readTenderMarkdown: () => tenderMarkdown || '',
  };
}

function baseStoredPlan(extra) {
  // 关键解析项（key 模式必填）必须 success，否则 runOutlineGenerationTask 会抛错
  const requiredIds = ['projectOverview', 'techRequirements', 'projectInfo', 'partAInfo', 'deliveryAndServiceRequirements'];
  const bidAnalysisTasks = {};
  for (const id of requiredIds) {
    bidAnalysisTasks[id] = { id, label: id, status: 'success', content: `${id} 内容` };
  }
  return {
    projectOverview: '项目概述内容',
    techRequirements: '技术评分要求内容',
    bidAnalysisTasks,
    ...extra,
  };
}

async function run(storedPlan, mode, tenderMarkdown) {
  const callLog = [];
  const aiService = createFakeAiService(callLog);
  const workspaceStore = createFakeWorkspaceStore(storedPlan, tenderMarkdown);
  await runOutlineGenerationTask({
    aiService,
    workspaceStore,
    knowledgeBaseService: {},
    updateTask: (patch) => ({ task_id: 't1', type: 'outline-generation', ...patch }),
    payload: { mode },
  });
  return { callLog, finalPlan: workspaceStore.loadTechnicalPlan() };
}

async function main() {
  // 场景 1：招标文件规定了投标文件组成 -> 走招标格式优先骨架
  {
    const storedPlan = baseStoredPlan({
      bidAnalysisTasks: {
        ...baseStoredPlan().bidAnalysisTasks,
        bidFileStructure: { id: 'bidFileStructure', label: '投标文件组成与格式', status: 'success', content: '1. 投标函\n2. 规划设计方案\n按第六章格式编写' },
      },
    });
    const { callLog, finalPlan } = await run(storedPlan, 'aligned', '招标文件原文……投标文件组成……');
    const usedTenderStructure = callLog.some((c) => c.system.includes('招标文件已经明确规定了投标文件的组成'));
    const usedGroups = callLog.some((c) => c.system.includes('提取适合作为技术标一级目录的评分大类'));
    assert.ok(usedTenderStructure, '场景1应走招标格式优先骨架（tenderStructureWorkflow）');
    assert.ok(!usedGroups, '场景1不应调用评分大类提取（不应走 alignedWorkflow）');
    assert.ok(finalPlan.outlineData && (finalPlan.outlineData.outline || []).length, '场景1应生成 outlineData');
    console.log('[场景1] 招标规定组成 -> 招标格式优先骨架：通过');
  }

  // 场景 2：招标文件未规定组成（aligned）-> 回退评分对齐
  {
    const storedPlan = baseStoredPlan({
      bidAnalysisTasks: {
        ...baseStoredPlan().bidAnalysisTasks,
        bidFileStructure: { id: 'bidFileStructure', label: '投标文件组成与格式', status: 'success', content: '原文未提及投标文件组成与格式' },
      },
    });
    const { callLog } = await run(storedPlan, 'aligned', '');
    const usedTenderStructure = callLog.some((c) => c.system.includes('招标文件已经明确规定了投标文件的组成'));
    const usedGroups = callLog.some((c) => c.system.includes('提取适合作为技术标一级目录的评分大类'));
    assert.ok(!usedTenderStructure, '场景2不应走招标格式优先骨架');
    assert.ok(usedGroups, '场景2应回退到评分对齐（alignedWorkflow）');
    console.log('[场景2] 招标未规定组成(aligned) -> 回退评分对齐：通过');
  }

  // 场景 3：无 bidFileStructure 解析项（free）-> 回退自由生成
  {
    const storedPlan = baseStoredPlan({});
    const { callLog } = await run(storedPlan, 'free', '');
    const usedTenderStructure = callLog.some((c) => c.system.includes('招标文件已经明确规定了投标文件的组成'));
    const usedFree = callLog.some((c) => c.system.includes('生成投标文件中技术标部分的一级目录结构') || c.label === '完整目录');
    assert.ok(!usedTenderStructure, '场景3不应走招标格式优先骨架');
    assert.ok(usedFree, '场景3应回退到自由生成（freeWorkflow）');
    console.log('[场景3] 无组成解析项(free) -> 回退自由生成：通过');
  }

  console.log('\n大纲招标格式优先路由冒烟：全部通过');
}

main().catch((error) => {
  console.error('冒烟失败：', error);
  process.exit(1);
});
