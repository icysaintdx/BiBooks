# BiBooks 整体规划方案

**日期**: 2026-06-06 16:00
**责任人**: BiBooks 开发团队
**版本**: v1.0

## 一、背景/问题描述

BiBooks 基于 OpenBidKit_Yibiao 二次开发，参考 BiaoShu-SKILL 的 14 步流水线规范，并计划集成 D:\businessPPA 目录下多个项目的可复用能力。当前已完成大部分核心功能，但仍有以下缺口需要补齐。

## 二、现状分析

### 2.1 BiaoShu-SKILL 14步流水线对齐率

- 完整对齐：10/14（71%）
- 部分对齐：2/14（14%）
- 未实现：2/14（14%）

### 2.2 未对齐步骤

| 步骤 | 名称 | 缺失内容 |
|------|------|----------|
| 0 | 通读模板知识 | 无独立步骤，知识库嵌入后续流程 |
| 9 | 插入占位符 | 无标书正文用户填写占位符功能 |
| 10 | 生成封面 | 无封面生成模块 |
| 11 | 生成目录 | 有大纲但无 Word 自动目录域 |

### 2.3 未集成项目

| 项目 | 核心可复用能力 |
|------|----------------|
| ProposalLLM | 产品文档拆分、需求对应表驱动模式 |
| Autobid | Prompt 设计、异步并发生成、大纲 JSON 结构 |
| python-docx-template | Word Jinja2 模板引擎 |
| xparse-sample-projects | 招标文件 6 模块解析设计 |

### 2.4 未完成功能模块

| 模块 | 当前状态 |
|------|----------|
| 商务标 | Demo 占位页面 |
| 投标机会 | Demo 占位页面 |
| SaaS 版本 | 未开始 |

## 三、解决方案

### 阶段一：补齐 BiaoShu-SKILL 流水线缺口（3天）

#### 3.1 生成封面模块（1天）

**新增文件**：
- `client/electron/services/coverGenerator.cjs`

**功能**：
- 根据项目名称、投标单位、日期生成标准封面
- 支持 3 种格式标准（government/enterprise/highway）
- 包含项目名称、"技术标"标题、投标单位、日期
- 集成到 exportService.cjs，Word 导出时自动添加封面页

**参考**：BiaoShu-SKILL 的 `generate_cover.py`

#### 3.2 生成目录模块（0.5天）

**修改文件**：
- `client/electron/services/exportService.cjs`

**功能**：
- Word 导出时在封面后插入自动目录
- 使用 Word TOC 域代码：`TOC \o "1-3" \h \z \u`
- 支持静态目录和自动更新目录两种模式

**参考**：BiaoShu-SKILL 的 `generate_toc.py`

#### 3.3 插入占位符模块（1天）

**新增文件**：
- `client/electron/services/placeholderService.cjs`

**功能**：
- 分析内容关键词，自动建议需要插入的占位符
- 3 种占位符类型：图片、表格、资质
- 预定义 10+ 种常用占位符模板（技术架构图、网络拓扑图、功能模块清单等）
- 在内容生成后自动执行占位符插入

**参考**：BiaoShu-SKILL 的 `generate_placeholder.py`

#### 3.4 模板知识独立步骤（0.5天）

**修改文件**：
- `client/electron/services/outlineGenerationTask.cjs`
- `client/src/features/technical-plan/pages/OutlineEditPage.tsx`

**功能**：
- 在大纲生成前增加"加载模板知识"步骤
- 独立展示已加载的模板知识内容
- 支持用户选择性启用/禁用特定模板

### 阶段二：集成外部项目能力（4天）

#### 3.5 集成 ProposalLLM 的文档拆分能力（2天）

**新增文件**：
- `client/electron/services/documentSplitter.cjs`

**功能**：
- 按标题层级拆分产品手册为可复用子文档
- 保留图片、表格、列表格式
- 自动建立知识库条目
- 支持需求对应表驱动的内容匹配

**参考**：ProposalLLM 的 `Extract_Word.py`

**集成方式**：
- 作为知识库导入的一种格式支持
- 用户上传产品手册 → 自动拆分 → 入库

#### 3.6 集成 Autobid 的异步并发模式（1天）

**修改文件**：
- `client/electron/services/contentGenerationTask.cjs`

**功能**：
- 优化内容生成的并发控制
- 参考 Autobid 的信号量控制并发模式
- 支持批量章节并行生成
- 进度报告优化

**参考**：Autobid 的 `bidding_workflow.py` 异步模式

#### 3.7 集成 python-docx-template 的模板引擎（1天）

**新增文件**：
- `client/electron/services/templateEngine.cjs`

**功能**：
- 支持 Word 模板 + Jinja2 标签
- 预定义标书模板（封面、目录、正文等）
- 数据渲染到模板生成最终文档
- 替代当前纯代码构建 Word 的方式

**参考**：python-docx-template 的 DocxTemplate 类

**集成方式**：
- 作为 exportService.cjs 的可选导出模式
- 用户可选择"模板模式"或"代码模式"导出

### 阶段三：完成功能模块（6天）

#### 3.8 商务标模块（3天）

**新增文件**：
- `client/electron/services/businessBidService.cjs`
- `client/electron/ipc/businessBidIpc.cjs`

**功能**：
- 商务条款识别（付款条件、履约保证金、报价有效期、偏离说明等）
- 响应矩阵生成（按条款输出响应、偏离和待补充材料）
- 报价附件编制（分项报价、付款节点、保函资料）
- 合同偏离分析

**修改文件**：
- `client/src/features/business-bid/pages/BusinessBidPage.tsx` - 替换 Demo 为实际功能

#### 3.9 投标机会模块（3天）

**新增文件**：
- `client/electron/services/bidOpportunityService.cjs`
- `client/electron/ipc/bidOpportunityIpc.cjs`

**功能**：
- 招标公告聚合（支持手动录入和 API 对接）
- 企业资质匹配（资质证书、业绩、人员）
- 机会评分算法（资质匹配度、预算规模、竞争强度、区域适配）
- 投前决策建议（是否值得投入标书资源）

**修改文件**：
- `client/src/features/bid-opportunity/pages/BidOpportunityPage.tsx` - 替换 Demo 为实际功能

## 四、工作量估算

| 阶段 | 任务 | 工期 | 优先级 |
|------|------|------|--------|
| 阶段一 | 补齐 BiaoShu-SKILL 流水线缺口 | 3天 | P1 |
| 阶段二 | 集成外部项目能力 | 4天 | P1 |
| 阶段三 | 商务标 + 投标机会模块 | 6天 | P2 |
| 合计 | | 13天 | |

## 五、实施顺序

```
第1天: 生成封面模块
第2天: 生成目录 + 模板知识步骤
第3天: 插入占位符模块
第4-5天: 集成 ProposalLLM 文档拆分
第6天: 集成 Autobid 异步并发
第7天: 集成 python-docx-template
第8-10天: 商务标模块
第11-13天: 投标机会模块
```

## 六、相关文件

### BiaoShu-SKILL 参考文件
- `D:\businessPPA\BiaoShu-SKILL\BiaoShu-writer-pro\scripts\generate_cover.py`
- `D:\businessPPA\BiaoShu-SKILL\BiaoShu-writer-pro\scripts\generate_toc.py`
- `D:\businessPPA\BiaoShu-SKILL\BiaoShu-writer-pro\scripts\generate_placeholder.py`

### ProposalLLM 参考文件
- `D:\businessPPA\ProposalLLM\Extract_Word.py`
- `D:\businessPPA\ProposalLLM\Generate.py`

### Autobid 参考文件
- `D:\businessPPA\autobid\bidding_workflow.py`
- `D:\businessPPA\autobid\prompts.py`

### python-docx-template 参考文件
- `D:\businessPPA\python-docx-template\docxtpl\template.py`

## 七、版本信息

- 关联版本: v0.13.0+
- 发布状态: 规划中
