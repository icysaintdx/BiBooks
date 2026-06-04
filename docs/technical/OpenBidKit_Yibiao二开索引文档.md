# OpenBidKit_Yibiao 二次开发完整索引文档

> **编写日期**: 2026-06-05
> **文档用途**: 为基于 OpenBidKit_Yibiao 的二次开发提供完整代码索引和改造指南
> **项目路径**: `D:\businessPPA\OpenBidKit_Yibiao`

---

## 一、项目总览

### 1.1 项目基本信息

| 项目 | 说明 |
|------|------|
| 项目名称 | 易标投标工具箱 (OpenBidKit_Yibiao) |
| 技术栈 | Electron 41+ / React 19+ / TypeScript 5.9+ / Vite 7+ / SQLite |
| 许可证 | AGPL-3.0 |
| 原作者 | mark / yibiaoai |
| 原始仓库 | https://github.com/FB208/OpenBidKit_Yibiao |
| 总文件数 | 约 185 个文件（不含 .git） |
| 核心目录 | `client/`（当前主程序） |

### 1.2 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                   Renderer (React/TS)                    │
│   src/features/    src/shared/    src/components/        │
└────────────────────────┬────────────────────────────────┘
                         │ window.yibiao (IPC Bridge)
┌────────────────────────┴────────────────────────────────┐
│                Main Process (Node.js/CJS)                │
│   electron/services/    electron/ipc/    electron/utils/  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────┐
│              SQLite (better-sqlite3)                     │
│   workspace/yibiao.sqlite                                │
└─────────────────────────────────────────────────────────┘
```

### 1.3 关键架构约束

1. **无根 package.json**: 所有命令在 `client/` 下执行
2. **Main/Renderer 严格分离**: Renderer 不能直接访问 Node API，必须通过 `window.yibiao` IPC bridge
3. **CommonJS vs ESM**: Electron Main/Preload 用 `.cjs`，Renderer 用 `.ts/.tsx`
4. **SQLite 存储**: 工作区数据存 `workspace/yibiao.sqlite`，使用 `better-sqlite3`
5. **大文本文件化**: 招标文件 Markdown 存为 `.md` 文件，不存入 SQLite

---

## 二、完整目录结构树

```
D:\businessPPA\OpenBidKit_Yibiao\
│
├── .github/                              [GitHub 配置]
│   ├── ISSUE_TEMPLATE/
│   │   ├── 功能建议.md                    [Issue 模板 - 功能建议]
│   │   └── 问题反馈.md                    [Issue 模板 - 问题反馈]
│   └── workflows/
│       └── release.yml                   [GitHub Actions 发布工作流]
│
├── .vscode/                              [VSCode 配置]
│   ├── launch.json                       [调试配置 - 旧版遗留]
│   └── tasks.json                        [任务配置 - 旧版遗留]
│
├── analytics/                            [埋点服务 - 二开需删除]
│   ├── README.md
│   ├── dashboard/                        [统计仪表板]
│   └── worker/                           [Cloudflare Worker 埋点后端]
│
├── archive/                              [归档 - 旧版 Python+React 架构]
│   ├── backend/                          [FastAPI 后端]
│   └── frontend/                         [React 前端]
│
├── client/                               [★ 核心 - 当前 Electron 客户端]
│   ├── package.json                      [依赖配置]
│   ├── tsconfig.json                     [TypeScript 配置]
│   ├── vite.config.ts                    [Vite 配置]
│   ├── 开发说明.md                        [开发规范文档]
│   ├── assets/                           [应用图标]
│   ├── doc/                              [内部设计文档]
│   ├── scripts/                          [构建脚本]
│   ├── electron/                         [★ Electron 主进程]
│   │   ├── main.cjs                      [入口文件]
│   │   ├── preload.cjs                   [预加载桥接]
│   │   ├── ipc/                          [IPC 处理器]
│   │   ├── services/                     [★ 业务服务层]
│   │   └── utils/                        [工具函数]
│   └── src/                              [★ Renderer 前端]
│       ├── main.tsx                      [前端入口]
│       ├── App.tsx                       [根组件]
│       ├── styles.css                    [全局样式]
│       ├── app/                          [路由/Provider]
│       ├── components/                   [布局组件]
│       ├── features/                     [★ 业务模块]
│       └── shared/                       [★ 共享模块]
│
├── screenshots/                          [截图资源]
├── sql/                                  [SQL Schema]
│   └── workspace_schema.sql              [数据库表结构定义]
├── 文章/                                 [技术博客]
│
├── AGENTS.md                             [AI Agent 指令文档]
├── CODE_OF_CONDUCT.md                    [社区行为准则]
├── CONTRIBUTING.md                       [贡献指南]
├── LICENSE                               [AGPL-3.0 许可证]
├── NOTICE                                [版权归属声明]
├── README.md                             [中文说明]
├── README.en.md                          [英文说明]
├── SECURITY.md                           [安全策略]
├── findings.md                           [技术发现记录 197 条]
├── progress.md                           [开发进度日志 170+ 条]
└── task_plan.md                          [任务计划文档 50+ 任务]
```

---

## 三、Electron 主进程代码索引 (`client/electron/`)

### 3.1 入口文件

| 文件 | 大小 | 功能 |
|------|------|------|
| `main.cjs` | 4.5KB | Electron 主进程入口，创建窗口、注册协议、初始化 IPC |
| `preload.cjs` | 7.0KB | 预加载脚本，构建 `window.yibiao` bridge 对象 |

### 3.2 IPC 处理器 (`electron/ipc/`)

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `index.cjs` | 8.5KB | IPC 总入口，注册所有 handler，初始化所有服务 | 需改造 |
| `aiIpc.cjs` | 384B | AI 调用 IPC：`ai:chat`、`ai:request-json`、`ai:test-image-model` | 可复用 |
| `configIpc.cjs` | 852B | 配置 IPC：`config:load/save/list-models/open-config-folder` | 可复用 |
| `exportIpc.cjs` | 655B | 导出 IPC：`export:word`、`export:word-progress` | 可复用 |
| `fileIpc.cjs` | 254B | 文件 IPC：`file:select-duplicate-check-files` | 可复用 |
| `knowledgeBaseIpc.cjs` | 1.6KB | 知识库 IPC：13 个 channel | 可复用 |
| `technicalPlanIpc.cjs` | 1.3KB | 技术方案 IPC：10 个 channel | 可复用 |
| `taskIpc.cjs` | 1.8KB | 任务 IPC：`tasks:start/subscribe/pause/recover` | 可复用 |
| `duplicateCheckIpc.cjs` | 691B | 标书查重 IPC：5 个 channel | 可复用 |
| `rejectionCheckIpc.cjs` | 938B | 废标检查 IPC：7 个 channel | 可复用 |

### 3.3 业务服务层 (`electron/services/`) - 核心代码

#### 3.3.1 AI 调用服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `aiService.cjs` | 39.7KB | **AI 调用核心**：封装所有大模型交互 | ✅ 直接复用 |

**核心函数**:
- `chatWithConfig(app, config, request)` - 文本对话，调用 OpenAI 兼容 `/chat/completions`
- `collectJsonResponseWithConfig(app, config, request)` - JSON 结构化输出，带重试和修复
- `generateImageWithConfig(app, config, request)` - AI 生图
- `listModels(config)` - 列出可用模型

**关键设计**:
- 支持 6 种文本模型提供商：jinlong、volcengine、xiaomi、deepseek、longcat、custom
- JSON 解析有多层容错：直接解析 → 提取 fenced JSON → 提取平衡括号 → 修复非法转义 → 重试
- 所有请求带 300 秒超时

**⚠️ 二开需删除**: 埋点代码（发送到 `analytics.agnet.top`）

#### 3.3.2 配置管理服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `configStore.cjs` | 10.1KB | 配置读写，JSON 文件持久化 | ✅ 直接复用 |

**配置结构**:
```javascript
{
  text_model_provider: 'jinlong' | 'volcengine' | 'xiaomi' | 'deepseek' | 'longcat' | 'custom',
  text_model_profiles: { [provider]: { api_key, base_url, model_name } },
  image_model: { provider, base_url, api_key, model_name, status },
  file_parser: { provider: 'local' | 'mineru-accurate-api' | 'mineru-agent-api', mineru_token },
  developer_mode: boolean,
  analytics_client_id: string,  // 二开需删除
}
```

#### 3.3.3 文件解析服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `fileService.cjs` | 26.4KB | 招标文件导入和解析 | ✅ 直接复用 |
| `doc2markdown/convert.mjs` | 42.4KB | 文档转 Markdown 核心 | ✅ 直接复用 |
| `documentParseErrors.cjs` | 1.6KB | 文件解析错误处理 | ✅ 直接复用 |

**三种解析后端**:
1. **本地解析** (`local`): .txt/.md/.docx/.pdf/.doc/.wps → Markdown
2. **MinerU Agent API** (`mineru-agent-api`): 轻量解析
3. **MinerU 精准解析 API** (`mineru-accurate-api`): 高精度解析

#### 3.3.4 数据库管理

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `sqliteDatabase.cjs` | 24.5KB | SQLite 初始化、Schema 迁移 | 需改造 |

**Schema 版本**:
- v1: 技术方案全流程表（meta/tasks/bid_items/outline_nodes/content_sections/content_plans/global_fact_groups）
- v2: 标书查重 + 废标检查表
- v3: 知识库表（folders/documents/blocks/candidate_items/items/item_blocks/discarded_groups/reports）
- v4: 全局事实变量表

#### 3.3.5 任务调度服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `taskService.cjs` | 25.8KB | 后台任务生命周期管理 | 需改造 |

**任务类型定义**:
```javascript
{
  'bid-analysis':            { group: 'technical-plan', lockPolicy: 'group-exclusive', step: 2 },
  'outline-generation':      { group: 'technical-plan', lockPolicy: 'group-exclusive', step: 3 },
  'global-facts-generation': { group: 'technical-plan', lockPolicy: 'group-exclusive', step: 4 },
  'content-generation':      { group: 'technical-plan', lockPolicy: 'group-exclusive', step: 5 },
  'rejection-items-extraction': { group: 'rejection-check', lockPolicy: 'group-exclusive', step: 1 },
  'rejection-check-run':     { group: 'rejection-check', lockPolicy: 'group-exclusive', step: 2 },
  'duplicate-analysis':      { group: 'duplicate-check', lockPolicy: 'group-exclusive', step: 2 },
}
```

#### 3.3.6 招标文件解析任务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `bidAnalysisTask.cjs` | 16.9KB | 招标文件结构化提取 | ✅ 直接复用 |

**解析任务列表（16 项）**:

| ID | 标签 | 类型 | 必选 |
|---|---|---|---|
| projectOverview | 项目概述 | markdown | ✅ |
| techRequirements | 技术评分要求 | markdown | ✅ |
| projectInfo | 项目信息 | json | ✅ |
| partAInfo | 甲方信息 | json | ✅ |
| deliveryAndServiceRequirements | 交货和服务要求 | json | ✅ |
| agentInfo | 代理机构信息 | json | ❌ |
| keyInfo | 投标关键节点 | json | ❌ |
| marginInfo | 投标保证金 | json | ❌ |
| qualificationReview | 资格审查 | json | ❌ |
| complianceCheck | 合规检查 | json | ❌ |
| openBid | 开标 | json | ❌ |
| evaluationBid | 评标 | json | ❌ |
| businessScoring | 商务评分 | json | ❌ |
| discardedBids | 废标条款 | json | ❌ |
| signingProcess | 签约流程 | json | ❌ |
| terminationCondition | 终止条件 | json | ❌ |

#### 3.3.7 目录生成任务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `outlineGenerationTask.cjs` | 47.5KB | 基于招标解析生成三级目录 | 需改造 |

**两种生成模式**:
1. **aligned 模式**（评分项对齐）: 一级目录标题严格等于评分大类标题
2. **free 模式**（自由生成）: 一次性生成完整三级目录

**知识库补目录**: `enhanceOutlineWithKnowledgeAdditions()` 从知识库补充缺失目录

#### 3.3.8 正文生成任务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `contentGenerationTask.cjs` | 162.6KB | **最大文件**，正文生成全流程 | 需大量改造 |

**7 阶段流程**:
1. **Planning**: AI 决定引用哪些知识库条目、使用哪些事实变量
2. **Generating**: AI 生成 Markdown 正文
3. **Outline Expanding**: 字数不足时补充目录
4. **Expanding**: 字数不足时追加正文
5. **Auditing**: 全文一致性审核
6. **Illustrating**: Mermaid 图渲染 + AI 生图
7. **Done**

**关键设计**:
- 全局事实变量（`globalFacts`）保证全文一致性
- 知识库条目精确引用
- Mermaid 图通过 mermaid.ink 在线渲染
- 配图候选池机制

#### 3.3.9 全局事实变量生成

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `globalFactsTask.cjs` | 16.6KB | 预设全文一致的关键变量 | 需改造 |

**两轮生成**:
1. 第一轮：基于招标文件 + 目录 + 解析结果 + 知识库，生成初始变量组
2. 第二轮：查漏补缺，补充/替换遗漏变量

#### 3.3.10 知识库服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `knowledgeBaseService.cjs` | 45.7KB | 知识库全流程管理 | ✅ 直接复用 |
| `knowledgeBaseStore.cjs` | 45.7KB | 知识库 SQLite CRUD | 需改造 |

**处理 Pipeline**:
```
源文件 → parseDocumentWithConfig() → Markdown
  → createRawBlocks() 按段落分块
  → filterNoiseBlocks() 过滤噪音
  → mergeSemanticBlocks() 语义合并（500+ 字）
  → AI 提取候选知识条目
  → AI 匹配 blocks → items
  → 生成最终知识条目
  → 生成报告
```

#### 3.3.11 标书查重服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `duplicateCheckService.cjs` | 96.8KB | 标书查重核心分析 | 需部分改造 |
| `duplicateCheckStore.cjs` | 39.6KB | 标书查重 SQLite CRUD | 需改造 |

**四维查重**: 元数据、大纲、正文、图片

#### 3.3.12 废标检查服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `rejectionCheckTask.cjs` | 29.3KB | 废标检查 AI 任务 | 需部分改造 |
| `rejectionCheckStore.cjs` | 27.1KB | 废标检查 SQLite CRUD | 需改造 |

**三类并发检查**: 废标项、错别字、逻辑谬误

#### 3.3.13 Word 导出服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `exportService.cjs` | 43.2KB | Markdown → DOCX 转换 | ✅ 直接复用 |

**核心技术栈**: `docx` 库 + `unified/remark` + `cheerio` + `mermaid.ink`

**支持内容**: 标题、段落、列表、表格、引用、代码块、HTML 内联标签、Mermaid 图、AI 配图

#### 3.3.14 其他服务

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `technicalPlanStore.cjs` | 31.9KB | 技术方案 SQLite CRUD | 需改造 |
| `updateService.cjs` | 6.1KB | 应用自动更新 | 可复用 |

### 3.4 工具函数 (`electron/utils/`)

| 文件 | 大小 | 功能 | 二开评估 |
|------|------|------|---------|
| `developerLog.cjs` | 3.5KB | 开发者模式日志 | ✅ 直接复用 |
| `errors.cjs` | 204B | 错误类型定义 | ✅ 直接复用 |
| `importedImages.cjs` | 1.0KB | 导入图片管理 | ✅ 直接复用 |
| `logger.cjs` | 196B | 日志工具 | ✅ 直接复用 |
| `paths.cjs` | 2.1KB | 路径工具 | ✅ 直接复用 |
| `wordCount.cjs` | 2.1KB | 字数统计 | ✅ 直接复用 |

---

## 四、前端代码索引 (`client/src/`)

### 4.1 入口文件

| 文件 | 大小 | 功能 |
|------|------|------|
| `main.tsx` | 346B | 应用入口，渲染 `<App />` |
| `App.tsx` | 1.4KB | 根组件，管理 `activeSection` 和 `developerMode` 状态 |
| `styles.css` | 158.7KB | 全局样式（Radix UI + 自定义） |
| `vite-env.d.ts` | 250B | Window 接口扩展，声明 `yibiao` bridge |

### 4.2 应用层 (`src/app/`)

| 文件 | 大小 | 功能 |
|------|------|------|
| `AppRouter.tsx` | 1.5KB | 路由，映射 SectionId 到页面组件 |
| `menuConfig.ts` | 1.2KB | 菜单配置，6 个主模块 + 开发者测试 |
| `UpdateNotifier.tsx` | 6.1KB | 更新通知 + 远程公告弹窗 |
| `providers/AppProviders.tsx` | 397B | Context Provider（Toast + DocumentParseNotice） |

### 4.3 布局组件 (`src/components/`)

| 文件 | 大小 | 功能 |
|------|------|------|
| `AppShell.tsx` | 900B | 布局组件，Sidebar + 主内容区 |
| `Sidebar.tsx` | 7.0KB | 可折叠侧边栏导航，8 个 SVG 图标 |

### 4.4 业务模块 (`src/features/`)

#### 4.4.1 技术方案模块 (technical-plan) - 核心

| 文件 | 大小 | 功能 |
|------|------|------|
| `pages/TechnicalPlanHome.tsx` | 27.5KB | 技术方案主页，6 步工作流编排 |
| `pages/DocumentAnalysisPage.tsx` | 4.0KB | Step 1: 招标文件导入 |
| `pages/BidAnalysisPage.tsx` | 15.3KB | Step 2: 招标文件解析 |
| `pages/OutlineEditPage.tsx` | 31.4KB | Step 3: 目录编辑 |
| `pages/GlobalFactsPage.tsx` | 11.8KB | Step 4: 全局事实变量 |
| `pages/ContentEditPage.tsx` | 58.5KB | Step 5: 正文编辑 |
| `hooks/useTechnicalPlanWorkflow.ts` | 1.5KB | 工作流状态管理 Hook |
| `services/bidAnalysisWorkflow.ts` | 10.8KB | 14 项招标解析任务定义 |
| `services/outlineWorkflow.ts` | 11.6KB | 目录生成工作流（free/aligned） |
| `services/technicalPlanStorage.ts` | 655B | 技术方案状态加载 |
| `types.ts` | 5.2KB | 技术方案类型定义 |

#### 4.4.2 知识库模块 (knowledge-base)

| 文件 | 大小 | 功能 |
|------|------|------|
| `pages/KnowledgeBasePage.tsx` | 57.3KB | 知识库管理：文件夹 CRUD、文档上传、迁移、查看 |
| `types.ts` | 3.1KB | 知识库类型定义 |

#### 4.4.3 标书查重模块 (duplicate-check)

| 文件 | 大小 | 功能 |
|------|------|------|
| `pages/DuplicateCheckPage.tsx` | 42.9KB | 标书查重：四维分析（元数据/大纲/正文/图片） |
| `types.ts` | 180B | 查重类型定义 |

#### 4.4.4 废标检查模块 (rejection-check)

| 文件 | 大小 | 功能 |
|------|------|------|
| `pages/RejectionCheckPage.tsx` | 79.0KB | **最大前端文件**，三步废标检查 |
| `types.ts` | 3.8KB | 废标检查类型定义 |

#### 4.4.5 设置模块 (settings)

| 文件 | 大小 | 功能 |
|------|------|------|
| `pages/SettingsPage.tsx` | 52.6KB | 设置页：通用/文本模型/图片模型/文件解析器/关于 |
| `types.ts` | 457B | 设置类型定义 |

#### 4.4.6 占位模块（未完成）

| 文件 | 大小 | 功能 |
|------|------|------|
| `bid-opportunity/pages/BidOpportunityPage.tsx` | 3.6KB | 投标商机（开发中） |
| `business-bid/pages/BusinessBidPage.tsx` | 4.3KB | 商务标（开发中） |
| `developer/pages/DeveloperTestPage.tsx` | 6.2KB | 开发者测试页 |

### 4.5 共享模块 (`src/shared/`)

#### 4.5.1 AI 客户端

| 文件 | 大小 | 功能 |
|------|------|------|
| `ai/aiClient.ts` | 498B | `window.yibiao.ai` 的薄封装，提供 `chat()` 和 `requestJson()` |
| `ai/index.ts` | 39B | 导出 |

#### 4.5.2 埋点（二开需删除）

| 文件 | 大小 | 功能 |
|------|------|------|
| `analytics/analytics.ts` | 4.8KB | 匿名埋点，发送到 `analytics.agnet.top` |
| `remoteNotice.ts` | 2.2KB | 远程公告获取 |
| `updateToast.ts` | 883B | 更新提示 Toast |

#### 4.5.3 Prompt 模板

| 文件 | 大小 | 功能 |
|------|------|------|
| `prompts/analysisPrompts.ts` | 1.9KB | 废标项提取 Prompt |
| `prompts/jsonRepairPrompts.ts` | 943B | JSON 修复 Prompt |
| `prompts/outlinePrompts.ts` | 11.6KB | 目录生成 Prompt（7 个构建函数） |
| `prompts/rejectionPrompts.ts` | 9.8KB | 废标检查 Prompt（三轮方法） |
| `prompts/index.ts` | 610B | 导出 |

#### 4.5.4 类型定义

| 文件 | 大小 | 功能 |
|------|------|------|
| `types/ai.ts` | 663B | AI 类型：ChatMessage, ChatCompletionRequest, JsonCompletionRequest |
| `types/bid.ts` | 5.8KB | 标书查重类型 |
| `types/config.ts` | 1.7KB | 配置类型：6 种文本模型 + 4 种图片模型 + 3 种文件解析器 |
| `types/ipc.ts` | 7.8KB | **IPC 契约**：YibiaoBridge 完整接口定义 |
| `types/navigation.ts` | 279B | 导航类型：SectionId (8 种) |
| `types/outline.ts` | 541B | 目录类型：OutlineItem, OutlineMode, TechnicalRequirementGroup |
| `types/index.ts` | 1.9KB | 统一导出 |

#### 4.5.5 UI 组件

| 文件 | 大小 | 功能 |
|------|------|------|
| `ui/ToastProvider.tsx` | 4.2KB | Radix Toast 通知系统 |
| `ui/FloatingToolbar.tsx` | 6.8KB | 可拖拽浮动工具栏 |
| `ui/MarkdownEditor.tsx` | 2.6KB | Markdown 编辑器（带格式工具栏） |
| `ui/MarkdownRenderer.tsx` | 2.2KB | Markdown 渲染器（GFM + HTML 支持） |
| `ui/InputWithAction.tsx` | 2.0KB | 带操作按钮的输入框 |
| `ui/DetailHelpLink.tsx` | 1.2KB | 帮助链接弹窗 |
| `ui/DocumentParseNoticeProvider.tsx` | 3.1KB | LibreOffice 需求通知 |
| `ui/index.ts` | 1.1KB | 统一导出 |

#### 4.5.6 工具函数

| 文件 | 大小 | 功能 |
|------|------|------|
| `utils/ids.ts` | ~100B | `createId(prefix)` - 唯一 ID 生成 |
| `utils/wordCount.ts` | ~2KB | 中文感知字数统计 |

---

## 五、数据库 Schema 索引

### 5.1 技术方案相关表（v1）

| 表名 | 用途 |
|------|------|
| `technical_plan_meta` | 技术方案元数据 |
| `technical_plan_tasks` | 任务状态 |
| `technical_plan_bid_items` | 招标解析结果 |
| `technical_plan_outline_nodes` | 目录节点 |
| `technical_plan_content_sections` | 内容章节 |
| `technical_plan_content_plans` | 内容规划 |
| `technical_plan_global_fact_groups` | 全局事实变量组 |

### 5.2 标书查重相关表（v2）

| 表名 | 用途 |
|------|------|
| `duplicate_check_meta` | 查重元数据 |
| `duplicate_check_files` | 文件信息 |
| `duplicate_check_tasks` | 任务状态 |
| `duplicate_check_analysis_sections` | 分析章节 |
| `duplicate_check_content_files` | 内容文件 |
| `duplicate_check_metadata_items` | 元数据项 |
| `duplicate_check_outline_items` | 大纲项 |
| `duplicate_check_groups` | 分组 |
| `duplicate_check_pairwise` | 两两对比 |
| `duplicate_check_content_duplicates` | 内容重复 |
| `duplicate_check_occurrences` | 出现位置 |
| `duplicate_check_image_files` | 图片文件 |
| `duplicate_check_duplicate_images` | 重复图片 |
| `duplicate_check_image_occurrences` | 图片出现位置 |

### 5.3 废标检查相关表（v2）

| 表名 | 用途 |
|------|------|
| `rejection_check_meta` | 检查元数据 |
| `rejection_check_documents` | 文档信息 |
| `rejection_check_tasks` | 任务状态 |
| `rejection_check_extraction` | 提取结果 |
| `rejection_check_results` | 检查结果 |
| `rejection_check_risk_findings` | 风险发现 |
| `rejection_check_typo_findings` | 错别字发现 |
| `rejection_check_logic_findings` | 逻辑错误发现 |

### 5.4 知识库相关表（v3）

| 表名 | 用途 |
|------|------|
| `knowledge_folders` | 知识库文件夹 |
| `knowledge_documents` | 知识库文档 |
| `knowledge_blocks` | 文档分块 |
| `knowledge_candidate_items` | 候选知识条目 |
| `knowledge_items` | 最终知识条目 |
| `knowledge_item_blocks` | 条目-分块关联 |
| `knowledge_discarded_groups` | 丢弃的分组 |
| `knowledge_reports` | 分析报告 |

---

## 六、IPC Channel 完整清单

### 6.1 AI 相关

| Channel | 方向 | 服务 |
|---|---|---|
| `ai:chat` | renderer→main | aiService.chat() |
| `ai:request-json` | renderer→main | aiService.requestJson() |
| `ai:test-image-model` | renderer→main | aiService.testImageModel() |

### 6.2 配置相关

| Channel | 方向 | 服务 |
|---|---|---|
| `config:load` | renderer→main | configStore.load() |
| `config:save` | renderer→main | configStore.save() |
| `config:list-models` | renderer→main | aiService.listModels() |
| `config:open-config-folder` | renderer→main | 打开配置文件夹 |

### 6.3 文件相关

| Channel | 方向 | 服务 |
|---|---|---|
| `file:select-duplicate-check-files` | renderer→main | fileService |

### 6.4 导出相关

| Channel | 方向 | 服务 |
|---|---|---|
| `export:word` | renderer→main | exportService.exportWord() |
| `export:word-progress` | main→renderer | 导出进度推送 |

### 6.5 技术方案相关（10 个）

| Channel | 方向 | 服务 |
|---|---|---|
| `technical-plan:load-state` | renderer→main | technicalPlanStore |
| `technical-plan:save-state` | renderer→main | technicalPlanStore |
| `technical-plan:save-tender-markdown` | renderer→main | technicalPlanStore |
| `technical-plan:read-tender-markdown` | renderer→main | technicalPlanStore |
| `technical-plan:update` | renderer→main | technicalPlanStore |
| ... | ... | ... |

### 6.6 知识库相关（13 个）

| Channel | 方向 | 服务 |
|---|---|---|
| `knowledge-base:list-folders` | renderer→main | knowledgeBaseService |
| `knowledge-base:create-folder` | renderer→main | knowledgeBaseService |
| `knowledge-base:delete-folder` | renderer→main | knowledgeBaseService |
| `knowledge-base:upload-documents` | renderer→main | knowledgeBaseService |
| `knowledge-base:start-matching` | renderer→main | knowledgeBaseService |
| ... | ... | ... |

### 6.7 任务相关

| Channel | 方向 | 服务 |
|---|---|---|
| `tasks:start` | renderer→main | taskService |
| `tasks:subscribe` | renderer→main | taskService |
| `tasks:unsubscribe` | renderer→main | taskService |
| `tasks:pause` | renderer→main | taskService |
| `tasks:recover` | renderer→main | taskService |
| `tasks:event` | main→renderer | 任务事件推送 |

### 6.8 应用相关

| Channel | 方向 | 服务 |
|---|---|---|
| `app:get-version` | renderer→main | 版本号 |
| `app:check-update` | renderer→main | 检查更新 |
| `app:install-update` | renderer→main | 安装更新 |
| `app:open-external` | renderer→main | 打开外部链接 |
| `app:get-platform` | renderer→main | 获取平台信息 |

---

## 七、二开改造清单

### 7.1 需删除的文件/代码

| 文件/代码 | 操作 | 原因 |
|-----------|------|------|
| `analytics/` 整个目录 | 删除 | 埋点服务 |
| `client/src/shared/analytics/analytics.ts` | 删除 | 前端埋点 |
| `client/src/shared/remoteNotice.ts` | 删除 | 远程公告 |
| `client/src/app/UpdateNotifier.tsx` | 修改 | 移除远程公告逻辑 |
| `client/electron/services/aiService.cjs` | 修改 | 删除埋点代码（约 10 行） |
| `client/electron/services/configStore.cjs` | 修改 | 删除 analytics_client_id |
| `AGENTS.md` | 修改 | 删除埋点保护条款 |
| `NOTICE` | 修改 | 更新版权信息 |
| `README.md` | 修改 | 删除广告内容 |

### 7.2 需新增的模块

| 模块 | 说明 | 参考来源 |
|------|------|---------|
| 报价核算引擎 | 纯 Python/JS 公式计算 | Pandas + openpyxl |
| 报价脱敏模块 | 正则识别金额 → 占位符替换 | 自研 |
| 行业检测模块 | 关键词匹配算法 | BiaoShu-SKILL |
| 评分标准提取 | 正则 + 关键词匹配 | BiaoShu-SKILL |
| 关键要求提取 | 正则 + 关键词匹配 | BiaoShu-SKILL |
| AI 去痕处理 | 词汇替换 + 同义词轮换 | BiaoShu-SKILL |
| 字数检查模块 | 公式化计算 | BiaoShu-SKILL |
| 封面生成模块 | python-docx / docx 库 | BiaoShu-SKILL |
| 目录生成模块 | Word 域代码 / 手动生成 | BiaoShu-SKILL |
| 格式规范化模块 | 三套格式标准 | BiaoShu-SKILL |
| Prompt 模板库 | 行业专属 Prompt | BiaoShu-SKILL + 自研 |

### 7.3 需改造的模块

| 模块 | 改造内容 |
|------|---------|
| 数据库 Schema | 新增报价相关表、行业配置表 |
| 任务调度 | 新增报价核算、行业检测等任务类型 |
| 目录生成 | 集成 BiaoShu 的基于评分结构生成逻辑 |
| 正文生成 | 集成 BiaoShu 的 14 步流水线 |
| 配置管理 | 移除默认 API 绑定，新增行业配置 |
| IPC 层 | 新增报价、行业相关 channel |

---

## 八、技术发现记录摘要（findings.md）

项目包含 197 条技术发现，覆盖以下关键领域：

### 8.1 架构决策
- SQLite 存储改造（v1→v2→v3）
- 技术方案 Store 边界
- 大文本文件化策略

### 8.2 AI 集成
- JSON 修复链路（三重容错）
- 流式请求
- Prompt 缓存优化
- 知识库分批匹配策略

### 8.3 文件解析
- DOC/WPS 多后端自动识别
- MinerU API 集成
- 扫描版 PDF 检测

### 8.4 标书查重
- 正文分句结构化
- 表格边界处理
- 句首序号归一化

### 8.5 Word 导出
- Markdown AST 到 docx 对象模型转换
- 表格/列表/HTML 容器递归导出

### 8.6 Electron 特殊问题
- **SQLite ABI 问题**: better-sqlite3 需要 Electron ABI 145，不是 Node ABI 137
- native 依赖需要 `npm run postinstall` 重建

---

## 九、开发验证流程

### 9.1 验证三板斧

```bash
# 1. CJS 语法检查
node --check electron/**/*.cjs

# 2. TypeScript + Vite 构建
cd client && npm run build

# 3. 代码规范检查
git diff --check
```

### 9.2 开发启动

```bash
cd client
npm ci                    # 安装依赖
npm run postinstall       # 重建 Electron native 依赖
npm run dev               # 启动开发服务器（Vite 端口 5173）
```

### 9.3 构建发布

```bash
cd client
npm run build             # 构建 Renderer
electron-builder --win    # 打包 Windows 客户端
electron-builder --mac    # 打包 macOS 客户端
```

---

## 十、依赖关系图

```
main.tsx
  └── App.tsx
       ├── app/AppRouter.tsx → 所有 feature 页面
       ├── app/UpdateNotifier.tsx → shared/remoteNotice, shared/ui
       ├── components/AppShell.tsx
       │    └── components/Sidebar.tsx → app/menuConfig.ts
       └── shared/analytics
  └── app/providers/AppProviders.tsx
       └── shared/ui (ToastProvider, DocumentParseNoticeProvider)

Feature 页面 → shared/ui, shared/analytics, shared/types, shared/ai, shared/prompts, shared/utils

shared/ai → window.yibiao.ai (IPC bridge)
shared/types/ipc.ts → 定义 YibiaoBridge（完整 IPC 契约）
shared/prompts → shared/types (ChatMessage, OutlineItem 等)
shared/ui → @radix-ui/react-tooltip, @radix-ui/react-toast, @radix-ui/react-dialog, react-markdown
```

---

## 十一、文件大小 TOP 10

| 排名 | 文件 | 大小 | 说明 |
|------|------|------|------|
| 1 | `electron/services/contentGenerationTask.cjs` | 162.6KB | 正文生成（最大文件） |
| 2 | `src/styles.css` | 158.7KB | 全局样式 |
| 3 | `electron/services/duplicateCheckService.cjs` | 96.8KB | 标书查重 |
| 4 | `features/rejection-check/pages/RejectionCheckPage.tsx` | 79.0KB | 废标检查页面 |
| 5 | `features/knowledge-base/pages/KnowledgeBasePage.tsx` | 57.3KB | 知识库页面 |
| 6 | `features/technical-plan/pages/ContentEditPage.tsx` | 58.5KB | 正文编辑页面 |
| 7 | `features/settings/pages/SettingsPage.tsx` | 52.6KB | 设置页面 |
| 8 | `electron/services/outlineGenerationTask.cjs` | 47.5KB | 目录生成 |
| 9 | `electron/services/knowledgeBaseService.cjs` | 45.7KB | 知识库服务 |
| 10 | `electron/services/knowledgeBaseStore.cjs` | 45.7KB | 知识库存储 |

---

## 十二、二开优先级建议

### P0 - 必须立即处理
1. 删除埋点系统（analytics 相关）
2. 删除远程公告系统
3. 修改默认 API 绑定
4. 更新 LICENSE/NOTICE/README

### P1 - 核心功能开发
1. 新增报价核算模块
2. 新增报价脱敏模块
3. 集成 BiaoShu-SKILL 的行业检测
4. 集成 BiaoShu-SKILL 的评分标准提取

### P2 - 功能增强
1. 集成 BiaoShu-SKILL 的 AI 去痕
2. 集成 BiaoShu-SKILL 的字数检查
3. 扩充行业模板库
4. 优化 Prompt 模板

### P3 - 长期规划
1. PDF 导出支持
2. 多项目管理
3. 协作功能
4. Web 版本

---

*文档完成。本文档可作为 OpenBidKit_Yibiao 二次开发的完整索引和参考手册。*
