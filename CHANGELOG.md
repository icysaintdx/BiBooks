# 更新日志

## [v0.12.0] - 2026-06-06 15:30
**版本代号**: 协同编辑版
**文档总数**: 5

### 🆕 新增功能
#### 协同编辑模块 ⭐
- **功能**: 多人实时协同编辑技术方案，支持多人同时编辑、实时同步、光标显示
- **后端**: `client/electron/services/collaborationService.cjs`
- **后端**: `client/electron/services/websocketService.cjs`
- **IPC**: `client/electron/ipc/collaborationIpc.cjs`
- **前端**: `client/src/features/technical-plan/pages/CollaborationPage.tsx`
- **集成**: 技术方案工具栏新增"协同"按钮，弹窗式协同编辑界面
- **特性**: 
  - WebSocket 实时双向通信
  - 操作转换（OT）冲突解决
  - 用户光标位置同步
  - 会话管理和统计
  - 操作历史记录

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.11.0] - 2026-06-06 04:30
**版本代号**: API服务化版
**文档总数**: 3

### 🆕 新增功能
#### API 服务化模块 ⭐
- **功能**: 提供 REST API 接口，支持外部系统集成调用
- **后端**: `client/electron/services/apiServer.cjs`
- **IPC**: `client/electron/ipc/apiServerIpc.cjs`
- **前端**: 设置页面新增"API 服务"标签页
- **特性**: 
  - HTTP REST API 服务器，支持启动/停止控制
  - API 密钥认证（可选）
  - 完整的招标分析、技术方案、知识库、AI 对话等 API 端点
  - CORS 跨域支持
  - 实时状态监控

### 📚 文档更新
- [API接口说明](docs/api/API接口说明.md) ⭐
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.10.0] - 2026-06-06 04:00
**版本代号**: 私有知识库版
**文档总数**: 3

### 🆕 新增功能
#### 私有知识库模块 ⭐
- **功能**: 企业专属标书知识库，支持存储企业简介、团队信息、案例库、中标方案、方案模板、可复用内容
- **后端**: `client/electron/services/privateKnowledgeBase.cjs`
- **前端**: `client/src/features/knowledge-base/pages/PrivateKnowledgeBasePage.tsx`
- **集成**: 导航菜单新增"企业知识库"入口
- **特性**: 6大知识分类、CRUD管理、搜索检索、行业推荐、批量导入导出

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.9.0] - 2026-06-06 03:30
**版本代号**: 合规检查版
**文档总数**: 3

### 🆕 新增功能
#### 合规性检查模块 ⭐
- **功能**: 检查投标文件是否符合招投标法规要求，包括格式合规、资质要求、时间节点、保证金等检查项
- **后端**: `client/electron/services/complianceCheck.cjs`
- **前端**: `client/src/features/technical-plan/pages/ComplianceCheckPage.tsx`
- **集成**: 技术方案工具栏新增"合规"按钮，弹窗式合规检查界面
- **特性**: 合规分数评估、分类检查、合规建议、详细检查报告

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.8.0] - 2026-06-06 03:00
**版本代号**: 字体与LLM增强版
**文档总数**: 3

### 🆕 新增功能
#### 公文字体配置 ⭐
- **功能**: 公文格式字体管理，支持方正小标宋/仿宋/楷体/黑体等标准字体
- **后端**: `client/electron/services/fontConfig.cjs`
- **集成**: `client/electron/services/exportService.cjs` Word导出使用标准公文字体
- **特性**: GB/T 9704-2012 公文格式参数、页面设置、字体回退机制

#### LLM 提供商增强 ⭐
- **功能**: 支持离线/在线提供商区分，新增 Ollama/LM Studio/llama.cpp/vLLM 本地模型支持
- **后端**: `client/electron/services/configStore.cjs` 提供商类型分组
- **前端**: `client/src/features/settings/pages/SettingsPage.tsx` 提供商分组选择
- **特性**: 在线/离线分组显示、本地模型默认配置、provider_type 字段

### 🔧 集成优化
- **字体集成**: exportService.cjs 导出 Word 时使用公文标准字体和页面设置
- **提供商分组**: 设置页面提供商下拉框按在线/离线分组显示

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.7.0] - 2026-06-06 02:30
**版本代号**: 竞品分析版
**文档总数**: 3

### 🆕 新增功能
#### 竞品分析模块 ⭐
- **功能**: 基于招标评分要求和行业知识，分析竞争策略、关键得分领域、差异化建议
- **后端**: `client/electron/services/competitiveAnalysis.cjs`
- **前端**: `client/src/features/technical-plan/pages/CompetitiveAnalysisPage.tsx`
- **集成**: 技术方案工具栏新增"竞品"按钮，弹窗式竞品分析界面
- **特性**: 评分权重分析、竞争策略生成、行业洞察、风险提醒

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.6.0] - 2026-06-06 02:00
**版本代号**: 智能排版版
**文档总数**: 3

### 🆕 新增功能
#### 智能排版模块 ⭐
- **功能**: 自动格式化技术方案内容，统一标题层级、段落间距、列表样式、表格格式、代码块标识
- **后端**: `client/electron/services/smartFormatter.cjs`
- **集成**: `client/electron/services/contentGenerationTask.cjs` 内容生成后自动排版
- **处理**: 标题层级标准化、段落间距规范化、列表标记统一、表格对齐、代码块语言标识补充

### 🔧 集成优化
- **智能排版集成**: contentGenerationTask.cjs 内容生成后自动执行排版（在 AI 去痕之后）

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.5.0] - 2026-06-06 01:30
**版本代号**: 版本管理版
**文档总数**: 3

### 🆕 新增功能
#### 版本管理模块 ⭐
- **功能**: 技术方案版本快照、历史查看、版本对比、版本恢复
- **后端**: `client/electron/services/versionManagement.cjs`
- **前端**: `client/src/features/technical-plan/pages/VersionManagementPage.tsx`
- **集成**: 技术方案工具栏新增"版本"按钮，弹窗式版本管理界面
- **特性**: 支持版本名称/说明、目录节点统计、字数统计、双版本对比

#### 数据库升级 ⭐
- **版本**: schemaVersion 5（沿用 v0.4.0 的迁移）
- **变更**: 新增 technical_plan_versions 表存储版本快照

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.4.0] - 2026-06-06 00:30
**版本代号**: 智能评分分析版
**文档总数**: 3

### 🆕 新增功能
#### 智能评分分析模块 ⭐
- **功能**: 自动解析技术评分要求，提取评分大类、权重分布、子项详情，生成内容编写建议
- **后端**: `client/electron/services/scoringAnalysisTask.cjs`
- **前端**: `client/src/features/technical-plan/pages/ScoringAnalysisPage.tsx`
- **集成**: 招标文件解析页面新增"评分分析"按钮，弹窗展示分析结果
- **存储**: 评分分析结果持久化到 SQLite，支持跨会话查看

#### 数据库升级 ⭐
- **版本**: schemaVersion 4 → 5
- **变更**: technical_plan_meta 表新增 scoring_analysis_json 字段

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.3.0] - 2026-06-05 23:30
**版本代号**: 行业知识与报价管理版
**文档总数**: 3

### 🆕 新增功能
#### 行业知识库 ⭐
- **功能**: 行业专属评分权重、常见陷阱、写作要点、关键指标
- **位置**: `client/electron/services/industryKnowledgeBase.cjs`
- **支持**: 8个行业的完整知识体系，可生成行业指南Markdown

#### 报价管理前端页面 ⭐
- **功能**: 报价项CRUD、分类管理、税率计算、汇总统计、Markdown导出
- **位置**: `client/src/features/pricing/pages/PricingPage.tsx`
- **集成**: 导航菜单、路由配置完整接入

#### Prompt 模板优化 ⭐
- **功能**: 所有目录生成Prompt注入行业上下文信息和反AI写作约束
- **位置**: `client/src/shared/prompts/outlinePrompts.ts`
- **约束**: 禁用AI典型词汇（赋能、助力、驱动等），使用具体数据代替空泛描述

#### 目录生成行业增强 ⭐
- **功能**: 目录生成时自动加载行业知识库作为上下文参考
- **位置**: `client/electron/services/outlineGenerationTask.cjs`

### 🔧 集成优化
- **行业检测集成**: bidAnalysisTask.cjs 招标分析后自动检测行业
- **AI去痕集成**: contentGenerationTask.cjs 内容生成后自动去痕处理
- **报价脱敏集成**: aiService.cjs 所有AI调用自动脱敏敏感金额数据

### 📚 文档更新
- [项目进度总览](docs/summary/项目进度总览.md) ⭐

---

## [v0.2.0] - 2026-06-05 20:00
**版本代号**: 核心模块集成版
**文档总数**: 2

### 🆕 新增功能
#### 行业检测模块 ⭐
- **功能**: 基于关键词匹配自动识别招标文件所属行业（8个行业）
- **位置**: `client/electron/services/industryDetector.cjs`
- **支持行业**: IT/信息化、建筑工程、医疗健康、教育服务、制造业、物流运输、咨询服务、通用
- **输出**: 行业代码、置信度、章节结构、关键章节配置

#### AI 去痕模块 ⭐
- **功能**: 去除 AI 生成文本中的典型痕迹，使内容更自然
- **位置**: `client/electron/services/humanizer.cjs`
- **处理**: AI特征词汇替换、填充短语删除、长句拆分、重复表达变化

#### 报价计算模块 ⭐
- **功能**: 报价明细管理、公式计算、汇总统计、中文大写金额
- **位置**: `client/electron/services/pricingService.cjs`
- **特性**: 分类管理、税率计算、优惠折扣、Markdown表格生成

#### 报价脱敏中间件 ⭐
- **功能**: 调用 AI 前自动将报价/金额等敏感数据替换为占位符
- **位置**: `client/electron/services/desensitization.cjs`
- **安全**: 确保企业报价数据永远不会泄露到云端 AI

### 📚 文档更新
- [核心模块功能说明](docs/feature/核心模块功能说明.md) ⭐

---

## [v0.1.0] - 2026-06-05 19:00
**版本代号**: 项目分析索引版
**文档总数**: 1

### 📚 文档更新
- [OpenBidKit_Yibiao二开索引文档](docs/technical/OpenBidKit_Yibiao二开索引文档.md) ⭐
  - 完整目录结构树
  - Electron 主进程代码索引（21 个服务文件）
  - 前端代码索引（所有组件和模块）
  - 数据库 Schema 索引（4 个版本）
  - IPC Channel 完整清单（60+ 个）
  - 二开改造清单（删除/新增/改造）
  - 技术发现记录摘要
  - 开发验证流程
  - 依赖关系图
  - 二开优先级建议

---
