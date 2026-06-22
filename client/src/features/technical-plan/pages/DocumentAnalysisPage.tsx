import { useEffect, useState } from 'react';
import { isLibreOfficeRequiredMessage, MarkdownRenderer, useDocumentParseNotice, useToast } from '../../../shared/ui';
import type { FileParserProvider } from '../../../shared/types';
import type { TechnicalPlanState, TechnicalPlanTenderFile, TenderParseQuality } from '../types';

const parserLabels: Record<FileParserProvider, string> = {
  local: '本地解析',
  opendataloader: 'OpenDataLoader PDF（本地）',
  'mineru-local': 'MinerU 本地解析',
  'paddleocr-local': 'PaddleOCR 本地 OCR',
  auto: '智能路由',
};

interface DocumentAnalysisPageProps {
  tenderFile: TechnicalPlanTenderFile | null;
  tenderMarkdown: string;
  parseQuality?: TenderParseQuality;
  projectTenderFile?: { fileName: string; filePath: string } | null;
  onFileImported: (state: TechnicalPlanState, markdown: string) => void;
}

function formatPercent(value: number | undefined) {
  return `${Math.round(Number(value || 0) * 100)}%`; 
}

function ParseQualityPanel({ quality }: { quality: TenderParseQuality }) {
  const hasWarnings = quality.warnings?.length > 0;
  return (
    <aside className={`parse-quality-panel${hasWarnings ? ' has-warnings' : ''}`} aria-label="解析质量检查">
      <div className="parse-quality-head">
        <div>
          <span className="section-kicker">解析质量</span>
          <strong>{quality.summary}</strong>
        </div>
        <span>{hasWarnings ? `${quality.warnings.length} 条提示` : '未见明显风险'}</span>
      </div>
      <div className="parse-quality-metrics">
        <span>表格 <strong>{quality.tableCount}</strong></span>
        <span>表格行 <strong>{quality.tableRowCount}</strong></span>
        <span>图片 <strong>{quality.imageCount}</strong></span>
        <span>标题 <strong>{quality.headingCount}</strong></span>
        <span>中文占比 <strong>{formatPercent(quality.chineseCharRatio)}</strong></span>
      </div>
      {hasWarnings && (
        <div className="parse-quality-warnings">
          {quality.warnings.map((warning) => (
            <p className={`is-${warning.level}`} key={`${warning.code}-${warning.message}`}>{warning.message}</p>
          ))}
        </div>
      )}
    </aside>
  );
}

function DocumentAnalysisPage({
  tenderFile,
  tenderMarkdown,
  parseQuality,
  projectTenderFile,
  onFileImported,
}: DocumentAnalysisPageProps) {
  const [parserLabel, setParserLabel] = useState(parserLabels.local);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const { showDocumentParseNotice } = useDocumentParseNotice();

  useEffect(() => {
    let mounted = true;

    const loadParserConfig = async () => {
      if (!window.yibiao) {
        return;
      }

      try {
        const config = await window.yibiao.config.load();
        if (mounted) {
          setParserLabel(parserLabels[config.file_parser.provider] || parserLabels.local);
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : '读取文件解析配置失败', 'error');
      }
    };

    loadParserConfig();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const importDocument = async (sourcePath?: string) => {
    try {
      setBusy(true);
      const result = await window.yibiao?.technicalPlan.importTenderDocument(sourcePath ? { sourcePath } : undefined);

      if (!result?.success || !result.markdown) {
        const message = result?.message || '未导入文件';
        if (isLibreOfficeRequiredMessage(message)) {
          showDocumentParseNotice(message);
          return;
        }
        showToast(message, message === '已取消选择' ? 'info' : 'error');
        return;
      }

      onFileImported(result.state, result.markdown);
      if (result.state.tenderFile?.parserLabel) {
        setParserLabel(result.state.tenderFile.parserLabel);
      }
      showToast(result.message || '招标文件已导入', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '文件解析失败';
      if (isLibreOfficeRequiredMessage(message)) {
        showDocumentParseNotice(message);
        return;
      }
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plan-step-body">
      <section className="analysis-import-card">
        <div>
          <span className="section-kicker">STEP 01</span>
          <strong>上传招标文件</strong>
          <p>当前解析方案：{parserLabel}</p>
        </div>
        <div className="analysis-actions">
          {projectTenderFile?.filePath && !tenderFile && (
            <button type="button" className="secondary-action" onClick={() => importDocument(projectTenderFile.filePath)} disabled={busy}>
              使用项目招标文件
            </button>
          )}
          <button type="button" className="primary-action" onClick={() => importDocument()} disabled={busy}>
            {busy ? '解析中...' : tenderFile ? '重新选择文件' : '选择文件'}
          </button>
        </div>
      </section>

      {projectTenderFile?.filePath && !tenderFile && (
        <section className="analysis-project-file-card">
          <div>
            <strong>当前项目已绑定招标文件</strong>
            <p>{projectTenderFile.fileName || projectTenderFile.filePath}</p>
          </div>
          <span>可直接使用项目创建时复制到项目目录中的文件，也可以重新选择文件替换本次解析。</span>
        </section>
      )}

      <section className="analysis-markdown-card">
        <div className="analysis-result-head">
          <strong>招标文件内容</strong>
          <span>{tenderFile ? `${tenderFile.fileName} · ${tenderFile.markdownChars} 字` : '等待上传'}</span>
        </div>

        {parseQuality && (
          <ParseQualityPanel quality={parseQuality} />
        )}

        {tenderMarkdown ? (
          <div className="markdown-viewer">
            <MarkdownRenderer>
              {tenderMarkdown}
            </MarkdownRenderer>
          </div>
        ) : (
          <div className="markdown-empty-state">
            <strong>尚未导入招标文件</strong>
            <p>当前步骤只负责把招标文件解析成 Markdown。下一步再基于这里的 Markdown 内容进行 AI 标书理解。</p>
          </div>
        )}
      </section>

    </div>
  );
}

export default DocumentAnalysisPage;
