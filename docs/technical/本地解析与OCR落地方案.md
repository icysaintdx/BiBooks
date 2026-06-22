# 本地解析与 OCR 落地方案

## 1. 安全边界

招标文件、报价文件、资质证书、合同扫描件默认按涉密文件处理。

默认解析链路只允许使用本地能力，不自动上传文件到远程解析 API。历史配置中如果残留 MinerU API 解析方式，客户端会归一化为本地智能路由，后端也会拦截并转为本地解析。

最终保留的解析主力只有四类：

1. `local`：本地基础解析，Word 主要走 mammoth，PDF 走本地 PDF 解析。
2. `opendataloader`：OpenDataLoader PDF 本地增强解析。
3. `mineru-local`：MinerU 本地解析。
4. `paddleocr-local`：PaddleOCR 本地 OCR。

其他远程解析 API 不进入桌面版默认能力，后续也不作为主线维护。

## 2. OCR 方案取舍

### PaddleOCR

定位：桌面版主线 OCR。

适用场景：
- 中文证照、营业执照、资质证书、合同扫描页。
- 图片型招标文件或图片型 PDF 的文字识别。
- 后续企业知识库中证书编号、发证单位、有效期、项目名称、合同金额等字段自动回填。

原因：
- 中文 OCR 生态成熟。
- 本地运行，不需要上传文件。
- 后续可扩展版面分析、表格识别和结构化抽取。

当前落地：
- 已加入 `paddleocr-local` 本地解析器入口。
- 已加入环境检测：`paddleocr`、`pdf2image`。
- 扫描 PDF 使用 PaddleOCR 时需要 `pdf2image` 和本机 Poppler 支持。

### OCRmyPDF

定位：扫描 PDF 预处理辅助。

适用场景：
- 把扫描 PDF 转成带隐藏文字层的可搜索 PDF。
- 后续可作为 PDF 解析前置步骤，提高本地解析器成功率。

暂不作为第一入口：
- 依赖 Tesseract、Ghostscript 等系统组件，Windows 安装和诊断成本较高。
- 更适合 PDF 预处理，不适合证照字段结构化。

### EasyOCR

定位：轻量备用 OCR。

适用场景：
- 少量图片 OCR 兜底。
- 多语言图片识别。

暂不作为主线：
- PyTorch 依赖较重。
- 中文证照和行业文档结构化生态不如 PaddleOCR。

### DeepSeek-OCR

定位：后续本地大模型 OCR/文档理解增强。

适用场景：
- 高压缩文档视觉理解。
- 复杂版面、图文混排、需要 VLM 理解的文档。

暂不直接集成：
- 本地部署门槛高，对显存、模型权重、推理框架要求更高。
- 更适合作为“本地大模型增强版”能力，而不是桌面版基础 OCR。
- 后续如果桌面版部署本地模型，可作为增强层重新评估。

## 3. 当前默认解析策略

`auto` 本地智能路由：

- PDF：优先 OpenDataLoader PDF 本地解析。
- 图片：优先 PaddleOCR 本地 OCR。
- Word/WPS/Markdown：优先本地解析。
- Office/图片等增强格式：可使用 MinerU 本地解析。
- 远程 API：默认不进入流程。
- 已舍弃远程解析 API：不再提供 MinerU API 解析入口，不保留上传实现。

## 4. 后续任务

1. 增加独立 OCR 安装器，不与普通解析依赖混装。
2. 增加 OCR 诊断页，显示 PaddleOCR、pdf2image、Poppler、Python 版本。
3. 企业知识库接入证照 OCR：识别、字段校验、人工确认锁、附件绑定。
4. 技术方案 STEP 01 增加“扫描件 OCR 兜底解析”按钮。
5. 解析质量报告增加 OCR 覆盖率、疑似缺页、图片型表格提示。
