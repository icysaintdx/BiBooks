# 桌面版稳定化与 AI 证据边界落地记录

更新时间：2026-06-16
适用目录：`D:\businessPPA\BiBooks-desktop`

## 当前方向

先把桌面本地版稳定成可用、可测试、可商业演示的版本，再进入平台版大重构。平台版的多人协同、权限、审计、部署和集中模型服务后置处理，避免在桌面版尚未稳定前扩大架构风险。

## 已落地

### 1. 本地报价基础持久化

已新增 SQLite 报价表 `pricing_sheets`，报价管理页面不再只依赖前端内存状态。

已落地能力：
- 报价单列表、读取、新建、保存、删除。
- 税率、折扣、明细小计、汇总金额由本地确定性代码计算。
- 报价 Markdown 导出。
- `smoke:pricing` 覆盖保存、计算、导出和删除。

仍未完成：
- Excel 导入/导出。
- 控制价/预算对比。
- 漏项检查。
- 标书正文金额与报价表金额一致性检查。
- 可配置取费、税费、报价规则引擎。
- `pandas + openpyxl` 报价核算脚本层。

### 2. AI 证据边界提示词

新增 `client/electron/services/promptPolicy.cjs`，统一约束 AI 行为。

核心规则：
- AI 不得无依据猜测、编造项目事实、资质、人员、业绩、金额、工期、地点、设备参数、标准编号和服务承诺。
- 只能基于招标文件、项目数据库、企业资料、知识库、历史案例、全局事实变量和用户明确提供内容展开。
- 资料不足必须标记为“需人工补充”“原文未提及”“需核验”。
- 报价、预算、税费、统计、数量计算、金额一致性不得交给 AI 推断，必须走本地确定性计算或人工确认。
- 正式导出的标书正文不得包含内部来源标注、审批提示和风险标签。

已接入流程：
- 招标文件解析：`bidAnalysisTask.cjs`
- 正文生成：`contentGenerationTask.cjs`
- 评分分析：`scoringAnalysisTask.cjs`

特别修正：评分分析原有“如果原文没有明确分值，根据内容重要性合理推断”已改为“不推断，填 0，并标记需人工核验”。

### 3. 项目级来源标注与审批底座

新增 SQLite 表 `project_source_annotations`，数据库版本升至 v8。

字段覆盖：
- 目标对象：`project_scope`、`target_type`、`target_id`
- 来源类型：`tender_file`、`database`、`case_history`、`knowledge_base`、`private_kb`、`web`、`manual`、`ai_generated`
- 来源标题、引用、摘录、主张、风险等级
- 是否需要审批、审批状态、审批人、审批时间

新增服务：`client/electron/services/sourceAnnotationStore.cjs`

新增 IPC：
- `technical-plan:list-source-annotations`
- `technical-plan:save-source-annotation`
- `technical-plan:approve-source-annotation`
- `technical-plan:reject-source-annotation`
- `technical-plan:delete-source-annotation`

新增 smoke：`smoke:source-annotations`

默认规则：互联网来源 `sourceType=web` 自动 `requiresApproval=true` 且 `approvalStatus=pending`。人工确认前不得作为正式正文依据。

### 4. 正文生成来源记录

正文生成成功后，会为章节自动记录内部来源摘要：
- 招标文件解析与章节上下文。
- 本章节引用的全局事实变量。
- 本章节吸收的知识库条目。

这些记录只用于项目内部审查，不进入正式 Word/PDF 导出。

### 5. 正文页内部来源面板

正文编辑页新增“内部标注 / 来源与审批”面板。

当前能力：
- 选中叶子章节时读取该章节来源标注。
- 展示来源类型、风险等级、审批状态、来源引用和摘录。
- 对需要人工确认的来源执行“确认可用 / 拒绝使用”。

### 6. 表格链路核查

当前代码并不是完全不支持真表格：
- 前端通用 `MarkdownRenderer` 已启用 `remark-gfm`，Markdown 管道表可渲染为 HTML 表格。
- Word 导出 `exportService.cjs` 已支持 Markdown 表格节点转 DOCX 真表格。
- 导出服务还包含对压缩/异常 Markdown 表格行的修复逻辑。
- 新增 `smoke:export-table`，会生成包含 Markdown 表格的 DOCX，并检查 `word/document.xml` 中存在 `<w:tbl>`，证明导出结果是 Word 真表格。
- 正式导出已移除“内容由 AI 生成”这类内部标记。

当前判断：
- 用户看到“像 Markdown 图形表格”的主要原因更可能是解析结果和编辑器阶段仍以 Markdown 源格式保存/编辑，而不是 Word 导出完全不能生成真表格。
- 解析阶段目前缺少结构化表格元数据保存，表格只作为 Markdown 内容进入后续流程。

### 7. 解析质量规则检查

新增 `client/electron/services/documentQuality.cjs`，导入招标文件后自动生成 `tenderParseQuality`。

当前检查项：
- 解析字符数、中文占比、标题数量。
- Markdown 表格数量、表格行数、最大列数、疑似断裂表格行。
- 图片数量。
- 疑似乱码。
- 空内容、扫描件/OCR 不完整、表格未标准化等风险提示。

上传招标文件页面已显示解析质量摘要；新增 `smoke:document-quality` 覆盖表格识别、乱码提示和空内容提示。

## 已明确不应在桌面版重点推进

### 1. 真多人协同

桌面版已有协同相关服务和页面，但目前不是生产级多人协同：WebSocket 未绑定真实 HTTP 服务，多用户同步、权限、锁、审计都不完整。

桌面版处理建议：
- 降级为本地草稿/版本辅助功能或隐藏弱化。
- 真协同放到平台版实现。

### 2. 一键本地模型部署

桌面版短期先支持 OpenAI-compatible 的本地模型配置，例如 Ollama、LM Studio、llama.cpp server、vLLM。

短期桌面版目标：
- 配置检测。
- 连接测试。
- 本地模型使用说明。
- 不把 Ollama/Docker/模型权重打包成桌面版强依赖。

平台版再做服务器/Docker 化的一键部署和集中管理。

## 未完成但必须继续推进

### 1. 行业针对性增强

当前已有行业检测、行业知识库和模板参考，但行业颗粒度仍弱。

下一步要做：
- 扩展工程、政府采购、信息化、运维服务、医疗教育、设备采购等行业模板。
- 按行业建立项目级提示词边界：常见章节、评分关注点、常用证据、禁写内容、风险项。
- 行业模板只作为内部参考，不允许替代招标文件事实。

### 2. 互联网补充流程

当前已完成数据结构和审批规则，但尚未接入实际网络搜索工作流。

后续流程应为：
1. AI 或用户提出需要补充的外部信息。
2. 网络检索只生成内部候选记录，`sourceType=web`，`approvalStatus=pending`。
3. UI 明显标识“互联网来源，未批准不可写入”。
4. 用户确认后，内容才可作为正文素材，但内部仍保留来源链接和风险标注。
5. 正式导出不出现内部标注。

### 3. 解析质量完善

已支持本地解析、MinerU API、MinerU 本地、OpenDataLoader 等路径，但仍缺：
- xParse/TextIn 招投标专项结构化抽取集成。
- 解析后质量检查层。
- 表格结构化元数据保存。
- 扫描件/OCR 质量提示。
- 解析覆盖率、缺页、乱码、表格丢失的自动报告。

### 4. 脱敏规则增强

现有 AI 服务已接入请求脱敏和响应复原，价格相关字段已有基础规则。

后续要核查和增强：
- 折扣率、付款比例、保证金、控制价、预算价是否都归入敏感规则。
- 企业敏感信息、联系人、电话、账号、证书编号的可配置脱敏。
- 开发日志、请求日志、错误日志中不得泄露真实敏感数据。

### 5. 本地确定性计算脚本

当前只有 JS 报价计算基础层。还没有完整 Python `pandas + openpyxl` 报价核算脚本。

适用场景：
- Excel 报价清单读取。
- 分项汇总、税费、折扣、大小写金额。
- 漏项和重复项检查。
- 控制价/预算偏差分析。
- 标书正文金额与报价表总价一致性核验。

## 验证记录

已通过：
- `npm run build`
- `npm run smoke:electron-native`
- `npm run smoke:pricing`
- `npm run smoke:source-annotations`
- `npm run smoke:export-table`
- `npm run smoke:document-quality`
- 关键 `.cjs` 文件 `node --check`

Vite 构建仍有大 chunk 警告，属于既有打包体积问题，不影响本轮功能正确性。

## 下一步执行顺序

1. 做桌面版端到端手工测试：导入招标文件、解析、生成目录、生成正文、查看来源标注、导出 Word。
2. 修复测试中发现的可用性问题，尤其是解析表格、导出表格、正文来源标注是否按章节正确刷新。
3. 增强行业模板和项目级提示词：把行业边界、证据要求、禁写内容、需人工核验项做成可配置模块。
4. 做解析质量检查层：先规则检查，再接小模型或本地模型做质量判断。
5. 完成报价 Excel 脚本和金额一致性检查。
6. 再考虑桌面版本地模型检测/配置向导。
7. 桌面版稳定后，再切到平台版做真实协同、权限、审计、服务端模型和多租户架构。
