# 更新日志

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
