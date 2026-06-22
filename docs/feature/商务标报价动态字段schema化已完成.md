# 商务标报价动态字段 schema 化已完成

## 日期
2026-06-22 20:00

## 责任人
AI 辅助开发

## 背景 / 问题描述
商务标和报价两个表单此前完全硬编码（useState + JSX），表单字段集固定，无法根据招标文件的实际要求动态调整。例如招标要求提供"ISO 认证""安全生产许可证"等特定资质时，表单不会自动提示；招标规定税率 6% 时，报价页面仍默认 13%。

本轮之前，`bidFileStructure` 解析项是纯 Markdown 有序列表（面向大纲骨架），机器无法可靠解析为结构化字段，因此表单联动仅限于项目名/质保期/响应时间等少数字段的初值注入。

## 解决方案
新增结构化 JSON 解析项 `bidFileStructureSchema`（`output:'json'`），与现有 `bidFileStructure`（markdown，面向大纲）互补——一个面向人读，一个面向机读。解析结果驱动商务标资质列表、服务字段、业绩要求以及报价配置（税率/币种/报价方式），缺失时回退硬编码默认值，保证渐进叠加、不破坏现有流程。

### 核心设计
1. **新增解析项** `bidFileStructureSchema`：prompt 要求模型区分 `commercial`（商务标）和 `pricing`（报价）两大块，输出结构化 JSON，含资质列表、业绩要求、服务字段、报价配置。
2. **schema 解析与兜底合并** `buildFormSchema()`：读取解析结果，与硬编码默认 schema 深合并，招标值优先、缺失回退。全程容错（status 守卫 + try/catch）。
3. **商务标表单叠加**：资质初值由 schema 驱动（招标清单优先，否则回退后端默认类型）；业绩 Panel 显示招标最低数量要求；售后区叠加 schema 动态服务字段（`extraServiceFields`）；招标参考块新增结构化字段清单展示。
4. **报价表单 schema 化**：配置型字段（税率/币种/报价方式）由 schema 驱动默认值；税率 select 标注招标建议值；招标参考块显示结构化报价配置。核心明细表 `PricingItem[]`/分类/大写金额计算不动。

### 关键约束（不可破坏的后端契约）
- 商务标 `commercialBid.generate` 的 5 个 `*Options` payload 结构不变。
- 商务标草稿协议 `sections:[{id:'form', form:formSnapshot}]` 保留，`extraServiceFields` 追加进 formSnapshot。
- 报价 `PricingItem[]` 完整字段集 + `calculatePricingSummary` 不动。
- bid analysis JSON 零校验 → 前端读取必 guard + try/catch。

## 代码示例

### 新增解析项（bidAnalysisTask.cjs）
```javascript
{
  id: 'bidFileStructureSchema', label: '投标文件字段结构（机读）', required: false, output: 'json',
  description: '把招标对商务标、报价部分的字段要求整理为结构化 JSON，用于动态生成商务标 / 报价表单字段。',
  prompt: () => `任务：根据招标文件原文，整理出投标人编制"商务标"和"报价部分"时需要填写或提交的字段要求...`,
}
```

### schema 解析与兜底合并（tenderLinkage.ts）
```typescript
export function buildFormSchema(state: TechnicalPlanState | null | undefined): BidFormSchema {
  const root = parseBidFileStructureSchema(state);
  if (!root) return DEFAULT_FORM_SCHEMA;
  // 招标值优先，缺失回退硬编码默认
  const commercial = asObject(root.commercial);
  const pricing = asObject(root.pricing);
  return {
    fromTender: true,
    commercial: {
      qualifications: parseQualifications(commercial?.qualifications).length
        ? parseQualifications(commercial?.qualifications)
        : DEFAULT_FORM_SCHEMA.commercial.qualifications,
      // ...
    },
    pricing: {
      currency: cleanText(pricing?.currency) || DEFAULT_FORM_SCHEMA.pricing.currency,
      taxRate: normalizeTaxRate(pricing?.tax_rate) ?? DEFAULT_FORM_SCHEMA.pricing.taxRate,
      // ...
    },
  };
}
```

### 商务标表单叠加（BusinessBidPage.tsx）
```tsx
// 资质初值：schema 有招标清单时优先用
if (schema.commercial.qualifications.length > 0) {
  setQualifications(schema.commercial.qualifications.map((qual, index) => ({
    id: `schema_${index}`, name: qual.name, required: qual.required,
    status: 'pending', certificateNo: '', validFrom: '', validTo: '',
  })));
} else if (qualData) {
  setQualifications((qualData as QualType[]).map((item) => ({ ...item, status: 'pending', ... })));
}
```

## 测试结果
- `tsc --noEmit`：无类型错误
- `npm run build`：构建成功（20.55s）
- `outline-tender-format-smoke.cjs`：3 场景全部通过（未受影响）
- `project-scoped-modules-smoke.cjs`：需要 Electron 运行时（预期行为）

## 相关文件
- `client/electron/services/bidAnalysisTask.cjs`（新增 bidFileStructureSchema 解析项）
- `client/src/features/technical-plan/services/bidAnalysisWorkflow.ts`（前端镜像）
- `client/src/shared/utils/tenderLinkage.ts`（schema 解析 + 兜底合并 + 类型定义）
- `client/src/features/business-bid/pages/BusinessBidPage.tsx`（商务标表单叠加）
- `client/src/features/pricing/pages/PricingPage.tsx`（报价表单配置型字段 schema 化）

## 版本信息
- 关联版本：v0.15.0（招标驱动表单版）
- 发布状态：已提交
