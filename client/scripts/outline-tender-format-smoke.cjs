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

function sampleMultiTopLevel() {
  return { outline: [{ id: '1', title: '投标函', description: '投标函部分' }, { id: '2', title: '商务标', description: '商务标部分' }] };
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
      // 场景4多条格式引用时返回两个一级条目
      raw = userMessages.includes('投标函') && userMessages.includes('商务标') && userMessages.includes('第六章格式2') ? sampleMultiTopLevel() : sampleTopLevel(); // 招标格式优先：一级目录骨架
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
  // 场景 1：招标文件规定了投标文件组成（含格式引用）-> 走招标格式优先骨架 + format_ref 注入
  {
    const storedPlan = baseStoredPlan({
      bidAnalysisTasks: {
        ...baseStoredPlan().bidAnalysisTasks,
        bidFileStructure: { id: 'bidFileStructure', label: '投标文件组成与格式', status: 'success', content: '1. 投标函 — 按第六章格式1编写\n2. 规划设计方案' },
      },
    });
    const { callLog, finalPlan } = await run(storedPlan, 'aligned', '招标文件原文……投标文件组成……');
    const usedTenderStructure = callLog.some((c) => c.system.includes('招标文件已经明确规定了投标文件的组成'));
    const usedGroups = callLog.some((c) => c.system.includes('提取适合作为技术标一级目录的评分大类'));
    assert.ok(usedTenderStructure, '场景1应走招标格式优先骨架（tenderStructureWorkflow）');
    assert.ok(!usedGroups, '场景1不应调用评分大类提取（不应走 alignedWorkflow）');
    assert.ok(finalPlan.outlineData && (finalPlan.outlineData.outline || []).length, '场景1应生成 outlineData');
    // 阶段二深化断言：补全二三级目录时，子目录生成消息必须携带 bidFileStructure（最高优先级）与当前父条目标题
    const childCall = callLog.find((c) => (c.label || '').includes('子目录'));
    assert.ok(childCall, '场景1应存在子目录生成调用');
    assert.ok(
      childCall.user.includes('招标文件规定的投标文件组成与格式'),
      '场景1子目录生成消息应携带招标投标文件组成/格式（bidFileStructure）',
    );
    assert.ok(
      childCall.user.includes('投标函'),
      '场景1子目录生成消息应携带当前一级条目标题（父条目）',
    );
    // 阶段三深化断言：outline 节点应携带 format_ref；子目录 prompt 应包含格式引用提示
    const topItem = (finalPlan.outlineData.outline || [])[0];
    assert.ok(topItem, '场景1应有至少一个一级目录');
    assert.equal(topItem.format_ref, '按第六章格式1编写', '场景1一级目录应携带 format_ref（格式引用）');
    assert.ok(
      childCall.user.includes('按第六章格式1编写'),
      '场景1子目录生成消息应包含格式引用提示',
    );
    console.log('[场景1] 招标规定组成 + 格式引用 -> format_ref 注入 + 子目录 prompt 增强：通过');
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

  // 场景 4：bidFileStructure 含多条格式引用 -> 不同条目应有不同 format_ref
  {
    const storedPlan = baseStoredPlan({
      bidAnalysisTasks: {
        ...baseStoredPlan().bidAnalysisTasks,
        bidFileStructure: { id: 'bidFileStructure', label: '投标文件组成与格式', status: 'success', content: '1. 投标函 — 按第六章格式1编写\n2. 商务标 — 按第六章格式2编写' },
      },
    });
    const { callLog, finalPlan } = await run(storedPlan, 'aligned', '招标文件原文……');
    assert.ok(finalPlan.outlineData && (finalPlan.outlineData.outline || []).length >= 2, '场景4应生成至少两个一级目录');
    const items = finalPlan.outlineData.outline;
    // 两个条目应有不同 format_ref
    assert.equal(items[0].format_ref, '按第六章格式1编写', '场景4第一个条目应有 format_ref 格式1');
    assert.equal(items[1].format_ref, '按第六章格式2编写', '场景4第二个条目应有 format_ref 格式2');
    // 子目录 prompt 应包含对应格式引用
    const childCalls = callLog.filter((c) => (c.label || '').includes('子目录'));
    assert.ok(childCalls.length >= 2, '场景4应有两次子目录生成调用');
    assert.ok(childCalls[0].user.includes('按第六章格式1编写'), '场景4第一次子目录应包含格式1引用');
    assert.ok(childCalls[1].user.includes('按第六章格式2编写'), '场景4第二次子目录应包含格式2引用');
    console.log('[场景4] 多条格式引用 -> 不同条目 format_ref 独立 + 子目录 prompt 分别增强：通过');
  }

  console.log('\n大纲招标格式优先路由冒烟：全部通过');
}

main().catch((error) => {
  console.error('冒烟失败：', error);
  process.exit(1);
});
