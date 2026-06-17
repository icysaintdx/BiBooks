import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import { MarkdownRenderer } from '../../../shared/ui';
import type { LayoutTemplateConfig } from '../../../shared/types';
import { normalizeMarkdownTables } from '../../../shared/utils/markdownTables';

interface PagedDocumentPreviewProps {
  markdown: string;
  layoutTemplate?: LayoutTemplateConfig | null;
  projectName?: string;
  bidderName?: string;
  toolbarActions?: ReactNode;
}

interface PreviewPage {
  id: string;
  kind: 'cover' | 'toc' | 'body';
  markdown: string;
  tocItems?: Array<{ level: number; title: string; page: number }>;
  pageNumber?: number;
}

const A4_SIZE = { width: 210, height: 297 };
const A3_SIZE = { width: 297, height: 420 };
const PAGE_SCALE = 3.35;
const PAGE_CONTENT_SPLIT_CHARS = 2600;

function pageSizeFor(template?: LayoutTemplateConfig | null) {
  return template?.page?.size === 'A3' ? A3_SIZE : A4_SIZE;
}

function replaceTemplateVariables(value = '', projectName = '', bidderName = '') {
  return String(value)
    .replace(/\{项目名称\}|\{椤圭洰鍚嶇О\}/g, projectName)
    .replace(/\{投标单位\}|\{鎶曟爣鍗曚綅\}/g, bidderName)
    .replace(/\{日期\}|\{鏃ユ湡\}/g, new Date().toLocaleDateString('zh-CN'));
}

function tocLeaderClass(leader?: LayoutTemplateConfig['toc']['leader']) {
  if (leader === 'hyphen') return 'leader-hyphen';
  if (leader === 'underscore') return 'leader-underscore';
  if (leader === 'middleDot') return 'leader-middle-dot';
  if (leader === 'none') return 'leader-none';
  return 'leader-dot';
}

function splitMarkdownIntoPages(markdown: string) {
  const source = normalizeMarkdownTables(markdown).trim();
  if (!source) return [''];
  const blocks = source.split(/\n{2,}/);
  const pages: string[] = [];
  let current = '';

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (current && next.length > PAGE_CONTENT_SPLIT_CHARS) {
      pages.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);
  return pages;
}

function extractHeadings(markdown: string) {
  return normalizeMarkdownTables(markdown)
    .split('\n')
    .map((line) => /^(#{1,4})\s+(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .slice(0, 40)
    .map((match) => ({ level: Math.min(match[1].length, 3), title: match[2].trim() }));
}

function buildPreviewPages(markdown: string, projectName = '', bidderName = '', template?: LayoutTemplateConfig | null): PreviewPage[] {
  const bodyPages = splitMarkdownIntoPages(markdown);
  const headings = extractHeadings(markdown);
  const maxTocLevel = Number(template?.toc?.max_level || 3);
  const tocItems = headings
    .filter((heading) => heading.level <= maxTocLevel)
    .map((heading, index) => ({
      level: heading.level,
      title: heading.title,
      page: Math.max(1, Math.min(bodyPages.length || 1, index + 1)),
    }));
  const coverTitle = replaceTemplateVariables(template?.cover?.title || '{项目名称}', projectName, bidderName) || projectName || '投标文件';
  const coverSubtitle = replaceTemplateVariables(template?.cover?.subtitle || '投标文件', projectName, bidderName) || '投标文件';
  const bidderLabel = template?.cover?.bidder_label || '投标单位';
  const dateLabel = template?.cover?.date_label || '日期';

  return [
    {
      id: 'cover',
      kind: 'cover',
      markdown: `# ${coverTitle}\n\n## ${coverSubtitle}\n\n${bidderLabel}：${bidderName || '未填写'}\n\n${dateLabel}：${new Date().toLocaleDateString('zh-CN')}`,
    },
    {
      id: 'toc',
      kind: 'toc',
      markdown: '# 目录',
      tocItems,
      pageNumber: template?.toc?.show_page_numbers ? 1 : undefined,
    },
    ...bodyPages.map((pageMarkdown, index) => ({
      id: `body-${index + 1}`,
      kind: 'body' as const,
      markdown: pageMarkdown,
      pageNumber: index + 1,
    })),
  ];
}

function pageNumberText(format: string | undefined, page: number, pages: number) {
  const source = format || '第 {page} 页 / 共 {pages} 页';
  return source.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages));
}

function rulerMarks(sizeMm: number, step = 10) {
  const count = Math.floor(sizeMm / step);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

function buildMarkdownComponents(template?: LayoutTemplateConfig | null): Components {
  const bodyFont = template?.typography?.body_font || 'FangSong, SimSun, serif';
  const tableHeaderFill = `#${(template?.tables?.header_fill || 'F1F6FF').replace(/^#/, '')}`;
  const tableBorder = `#${(template?.tables?.border_color || 'DCDFF6').replace(/^#/, '')}`;
  const imageAlign = template?.images?.align === 'left' ? 'flex-start' : 'center';
  const imageWidth = `${template?.images?.max_width_percent || 92}%`;
  const headingByLevel = new Map((template?.headings || []).map((heading) => [heading.level, heading]));

  return {
    h1({ children }) {
      const heading = headingByLevel.get(1);
      return <h1 style={{ fontFamily: heading?.font || 'SimHei, sans-serif', fontSize: `${heading?.size_pt || 22}pt`, textAlign: heading?.alignment || 'center', fontWeight: heading?.bold === false ? 500 : 800 }}>{children}</h1>;
    },
    h2({ children }) {
      const heading = headingByLevel.get(2);
      return <h2 style={{ fontFamily: heading?.font || 'SimHei, sans-serif', fontSize: `${heading?.size_pt || 16}pt`, textAlign: heading?.alignment || 'left', fontWeight: heading?.bold === false ? 500 : 800 }}>{children}</h2>;
    },
    h3({ children }) {
      const heading = headingByLevel.get(3);
      return <h3 style={{ fontFamily: heading?.font || bodyFont, fontSize: `${heading?.size_pt || 14}pt`, textAlign: heading?.alignment || 'left', fontWeight: heading?.bold === false ? 500 : 800 }}>{children}</h3>;
    },
    h4({ children }) {
      const heading = headingByLevel.get(4);
      return <h4 style={{ fontFamily: heading?.font || bodyFont, fontSize: `${heading?.size_pt || 12}pt`, textAlign: heading?.alignment || 'left', fontWeight: heading?.bold === false ? 500 : 800 }}>{children}</h4>;
    },
    table({ children }) {
      return <table className="paged-preview-table" style={{ borderColor: tableBorder }}>{children}</table>;
    },
    th({ children }) {
      return <th style={{ background: tableHeaderFill, borderColor: tableBorder }}>{children}</th>;
    },
    td({ children }) {
      return <td style={{ borderColor: tableBorder }}>{children}</td>;
    },
    img({ src, alt }) {
      return (
        <span className="paged-preview-image-wrap" style={{ justifyContent: imageAlign }}>
          <img src={src || ''} alt={alt || ''} style={{ maxWidth: imageWidth }} />
          {template?.images?.caption_enabled !== false && alt && <small>{alt}</small>}
        </span>
      );
    },
  };
}

function PagedDocumentPreview({ markdown, layoutTemplate, projectName, bidderName, toolbarActions }: PagedDocumentPreviewProps) {
  const size = pageSizeFor(layoutTemplate);
  const pages = useMemo(() => buildPreviewPages(markdown, projectName, bidderName, layoutTemplate), [bidderName, layoutTemplate, markdown, projectName]);
  const components = useMemo(() => buildMarkdownComponents(layoutTemplate), [layoutTemplate]);
  const pageWidth = Math.round(size.width * PAGE_SCALE);
  const pageHeight = Math.round(size.height * PAGE_SCALE);
  const page = layoutTemplate?.page;
  const header = layoutTemplate?.header;
  const footer = layoutTemplate?.footer;
  const typography = layoutTemplate?.typography;
  const marginStyle = {
    '--preview-margin-top': `${(page?.margin_top_mm || 25) * PAGE_SCALE}px`,
    '--preview-margin-bottom': `${(page?.margin_bottom_mm || 25) * PAGE_SCALE}px`,
    '--preview-margin-left': `${(page?.margin_left_mm || 28) * PAGE_SCALE}px`,
    '--preview-margin-right': `${(page?.margin_right_mm || 25) * PAGE_SCALE}px`,
    '--preview-gutter': `${(page?.gutter_mm || 0) * PAGE_SCALE}px`,
  } as CSSProperties;
  const bodyPageCount = pages.filter((previewPage) => previewPage.kind === 'body').length || 1;

  return (
    <div className="paged-preview-shell">
      <div className="paged-preview-toolbar">
        <div className="paged-preview-toolbar-info">
          <span>{layoutTemplate?.name || '当前版式模板'}</span>
          <span>{page?.size || 'A4'} · {page?.margin_top_mm || 25}/{page?.margin_bottom_mm || 25}/{page?.margin_left_mm || 28}/{page?.margin_right_mm || 25} mm</span>
          <span>{typography?.body_font || '正文默认字体'} · {typography?.body_size_pt || 12} pt · {typography?.line_spacing || 1.5} 倍行距</span>
        </div>
        {toolbarActions && <div className="paged-preview-toolbar-actions">{toolbarActions}</div>}
      </div>
      <div className="paged-preview-scroll">
        {pages.map((previewPage) => {
          const isBody = previewPage.kind === 'body';
          const isToc = previewPage.kind === 'toc';
          const headerText = isBody && header?.enabled ? replaceTemplateVariables(header.text, projectName, bidderName) : '';
          const footerText = isBody && footer?.enabled ? replaceTemplateVariables(footer.text, projectName, bidderName) : '';
          const pageText = isBody && footer?.enabled
            ? pageNumberText(footer.page_number_format, previewPage.pageNumber || 1, bodyPageCount)
            : isToc && layoutTemplate?.toc?.show_page_numbers
              ? pageNumberText(layoutTemplate.toc.page_number_format, previewPage.pageNumber || 1, 1)
              : '';

          return (
            <div className={`paged-preview-page-wrap is-${previewPage.kind}`} key={previewPage.id}>
              {layoutTemplate?.preview?.show_rulers !== false && (
                <div className="paged-preview-ruler-horizontal" style={{ width: pageWidth }}>
                  {rulerMarks(size.width).map((mark) => <span key={mark} style={{ left: `${mark * PAGE_SCALE}px` }}>{mark}</span>)}
                </div>
              )}
              <div className="paged-preview-page-row">
                {layoutTemplate?.preview?.show_rulers !== false && (
                  <div className="paged-preview-ruler-vertical" style={{ height: pageHeight }}>
                    {rulerMarks(size.height).map((mark) => <span key={mark} style={{ top: `${mark * PAGE_SCALE}px` }}>{mark}</span>)}
                  </div>
                )}
                <article
                  className="paged-preview-page"
                  style={{
                    ...marginStyle,
                    width: pageWidth,
                    minHeight: pageHeight,
                    fontFamily: typography?.body_font || 'FangSong, SimSun, serif',
                    fontSize: `${typography?.body_size_pt || 12}pt`,
                    lineHeight: typography?.line_spacing || 1.5,
                  }}
                >
                  {layoutTemplate?.preview?.show_guides !== false && <div className="paged-preview-margin-guide" />}
                  {headerText && <header>{headerText}</header>}
                  <main className="paged-preview-content">
                    <MarkdownRenderer components={components}>{previewPage.markdown || '暂无可预览内容。'}</MarkdownRenderer>
                    {previewPage.kind === 'toc' && (
                      <div className="paged-preview-toc-list">
                        {previewPage.tocItems?.length ? previewPage.tocItems.map((item) => (
                          <div className={`paged-preview-toc-row level-${item.level} ${tocLeaderClass(layoutTemplate?.toc?.leader)}`} key={`${item.level}-${item.title}`}>
                            <span>{item.title}</span>
                            <i aria-hidden="true" />
                            <em>{item.page}</em>
                          </div>
                        )) : <p>暂无目录内容</p>}
                      </div>
                    )}
                  </main>
                  {(footerText || pageText) && (
                    <footer>
                      {footerText && <span>{footerText}</span>}
                      {pageText && <span>{pageText}</span>}
                    </footer>
                  )}
                </article>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PagedDocumentPreview;
