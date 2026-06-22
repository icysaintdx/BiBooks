const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { dialog } = require('electron');
const { formatDocumentParseError, isLibreOfficeMissingError, normalizeDocumentParseError } = require('./documentParseErrors.cjs');
const { compactLogError, createDeveloperLogger, textMetrics } = require('../utils/developerLog.cjs');
const { getImportedImagesDir } = require('../utils/paths.cjs');
const { parseWithPython } = require('./pythonParserService.cjs');

const parserLabels = {
  local: '本地解析',
  'opendataloader': 'OpenDataLoader PDF（本地）',
  'mineru-local': 'MinerU 本地解析',
  'paddleocr-local': 'PaddleOCR 本地识别',
  'auto': '智能路由（推荐）',
};

// auto 模式：默认只走本地能力；不会自动调用任何远程解析 API。
const PDF_EXTS = new Set(['.pdf']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp']);
const MINERU_LOCAL_EXTS = new Set(['.ppt', '.pptx', '.xlsx', '.xls']);
const DISABLED_REMOTE_PARSER_PROVIDERS = new Set(['mineru-accurate-api', 'mineru-agent-api']);

function resolveAutoProvider(ext) {
  if (PDF_EXTS.has(ext)) return 'opendataloader';
  if (IMAGE_EXTS.has(ext)) return 'paddleocr-local';
  if (MINERU_LOCAL_EXTS.has(ext)) return 'mineru-local';
  return 'local';
}

const localSupportedExtensions = new Set(['.txt', '.md', '.markdown', '.docx', '.pdf', '.doc', '.wps']);
const pythonLocalSupportedExtensions = new Set(['.pdf', '.docx', '.doc', '.ppt', '.pptx', '.png', '.jpg', '.jpeg']);
const paddleOcrSupportedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.bmp', '.tif', '.tiff', '.webp']);
const duplicateCheckSupportedExtensions = new Set(['.doc', '.docx', '.wps', '.pdf', '.md', '.markdown']);
const remoteImageTimeoutMs = 10000;
const markdownImagePattern = /!\[(?<alt>[^\]]*)\]\((?<target><[^>]+>|[^)\s]+)(?<title>\s+"[^"]*")?\)/gi;
const htmlImageSrcPattern = /(<img\b[^>]*?\bsrc=["'])(?<src>[^"']+)(["'][^>]*>)/gi;

function getSupportedExtensions(provider) {
  if (provider === 'opendataloader' || provider === 'mineru-local') {
    return pythonLocalSupportedExtensions;
  }
  if (provider === 'paddleocr-local') {
    return paddleOcrSupportedExtensions;
  }
  if (provider === 'auto') {
    return new Set([...PDF_EXTS, ...IMAGE_EXTS, ...MINERU_LOCAL_EXTS, ...localSupportedExtensions]);
  }
  return localSupportedExtensions;
}

function getSelectableExtensions(provider) {
  if (provider === 'local') {
    return localSupportedExtensions;
  }
  return new Set([...getSupportedExtensions(provider), ...localSupportedExtensions]);
}

function resolveFileParser(config, filePath) {
  const requestedProvider = config.file_parser?.provider || 'local';
  const ext = path.extname(filePath).toLowerCase();

  // 历史配置里如果残留远程 API，涉密安全模式下也强制转为本地解析。
  if (DISABLED_REMOTE_PARSER_PROVIDERS.has(requestedProvider)) {
    const actualProvider = IMAGE_EXTS.has(ext) ? 'paddleocr-local' : 'local';
    return {
      provider: actualProvider,
      requestedProvider,
      ext,
      supported: getSupportedExtensions(actualProvider).has(ext),
      fallbackToLocal: true,
      remoteBlocked: true,
    };
  }

  // auto 模式：按扩展名分发到最佳解析器
  if (requestedProvider === 'auto') {
    const actualProvider = resolveAutoProvider(ext);
    return { provider: actualProvider, requestedProvider, ext, supported: true, fallbackToLocal: false, isAuto: true };
  }

  const requestedSupported = getSupportedExtensions(requestedProvider).has(ext);
  if (requestedSupported) {
    return { provider: requestedProvider, requestedProvider, ext, supported: true, fallbackToLocal: false };
  }

  if (requestedProvider !== 'local' && localSupportedExtensions.has(ext)) {
    return { provider: 'local', requestedProvider, ext, supported: true, fallbackToLocal: true };
  }

  return { provider: requestedProvider, requestedProvider, ext, supported: false, fallbackToLocal: false };
}

async function summarizeFileForLog(filePath) {
  const summary = {
    file_name: path.basename(filePath || ''),
    extension: path.extname(filePath || '').toLowerCase(),
  };
  try {
    const stats = await fs.stat(filePath);
    summary.size = stats.size;
    summary.modified_at = stats.mtime.toISOString();
  } catch {
    summary.size = null;
    summary.modified_at = '';
  }
  return summary;
}

function summarizeParserForLog(parser, options = {}) {
  return {
    provider: parser.provider,
    requested_provider: parser.requestedProvider,
    extension: parser.ext,
    supported: parser.supported,
    fallback_to_local: parser.fallbackToLocal,
    preserve_images: options.preserveImages === true,
    asset_scope: String(options.assetScope || 'documents'),
  };
}

async function parseLocalDocument(filePath, options = {}) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return fs.readFile(filePath, 'utf-8');
  }

  const { convertPathToMarkdown } = await import('./doc2markdown/convert.mjs');
  return convertPathToMarkdown(filePath, {
    includeImages: options.preserveImages,
    imageResolver: options.imageResolver,
  });
}

function formatImportError(error, filePath) {
  const normalized = normalizeDocumentParseError(error, filePath);
  if (isLibreOfficeMissingError(normalized)) {
    return normalized.message;
  }

  const rawMessage = formatDocumentParseError(normalized, filePath);
  if (/Can't find end of central directory|is this a zip file/i.test(rawMessage)) {
    return '文件解析失败：该文件不是有效的 DOCX 文档，请用 Word/WPS 另存为标准 DOCX 后重试';
  }
  return `文件解析失败：${rawMessage || '未知错误'}`;
}

async function createLocalFileSelection(filePath) {
  const stats = await fs.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  return {
    id: crypto.createHash('sha1').update(filePath).digest('hex'),
    file_name: path.basename(filePath),
    file_path: filePath,
    extension,
    size: stats.size,
    modified_at: stats.mtime.toISOString(),
  };
}

function stripMarkdownImages(text) {
  return String(text || '')
    .replace(markdownImagePattern, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n');
}

function createAssetContext(app, scope = 'documents') {
  if (!app?.getPath) return null;
  const safeScope = String(scope || 'documents').replace(/[^A-Za-z0-9._-]+/g, '_') || 'documents';
  const batchId = `${safeScope}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return {
    baseDir: path.join(getImportedImagesDir(app), batchId),
    urlPrefix: `yibiao-asset://imported-images/${encodeURIComponent(batchId)}`,
    index: 0,
  };
}

async function deleteImportedImageAssets(assets) {
  if (!assets?.baseDir) return;
  await fs.rm(assets.baseDir, { recursive: true, force: true });
}

function imageExtensionFromMime(mime) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('bmp')) return '.bmp';
  if (normalized.includes('webp')) return '.webp';
  return '';
}

function imageExtensionFromPath(value) {
  const ext = path.extname(String(value || '').split(/[?#]/)[0]).toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(ext) ? (ext === '.jpeg' ? '.jpg' : ext) : '';
}

async function saveImportedImage(assets, buffer, sourceName, mime) {
  if (!assets || !buffer?.length) return null;
  const ext = imageExtensionFromMime(mime) || imageExtensionFromPath(sourceName) || '.png';
  assets.index += 1;
  const fileName = `image-${String(assets.index).padStart(4, '0')}${ext}`;
  await fs.mkdir(assets.baseDir, { recursive: true });
  await fs.writeFile(path.join(assets.baseDir, fileName), buffer);
  return `${assets.urlPrefix}/${encodeURIComponent(fileName)}`;
}

function createImageResolver(assets) {
  if (!assets) return null;
  return ({ buffer, mime, sourceName }) => saveImportedImage(assets, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer), sourceName, mime);
}

function cleanMarkdownImageTarget(target) {
  const value = String(target || '').trim();
  return value.startsWith('<') && value.endsWith('>') ? value.slice(1, -1) : value;
}

function parseDataUrl(value) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(String(value || ''));
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function loadRemoteImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remoteImageTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/^image\//i.test(contentType)) return null;
    return { buffer: Buffer.from(await response.arrayBuffer()), mime: contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function findZipEntryImage(zipEntries, imagePath, markdownEntryName) {
  let decodedPath = imagePath;
  try {
    decodedPath = decodeURIComponent(imagePath);
  } catch {
    decodedPath = imagePath;
  }
  const normalized = decodedPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const markdownDir = path.posix.dirname(String(markdownEntryName || '').replace(/\\/g, '/'));
  const candidates = [
    normalized,
    path.posix.normalize(path.posix.join(markdownDir === '.' ? '' : markdownDir, normalized)),
  ].map((item) => item.replace(/^\/+/, '').toLowerCase());
  const direct = zipEntries.find((entry) => candidates.includes(entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()));
  if (direct) return direct;
  const basename = path.posix.basename(normalized).toLowerCase();
  return zipEntries.find((entry) => path.posix.basename(entry.entryName.replace(/\\/g, '/')).toLowerCase() === basename);
}

function isPathInsideDirectory(baseDir, targetPath) {
  const relative = path.relative(baseDir, targetPath);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveImageToAssetUrl(source, assets, context = {}) {
  const value = cleanMarkdownImageTarget(source);
  if (!value) return null;
  if (/^yibiao-asset:\/\//i.test(value)) return value;

  const data = parseDataUrl(value);
  if (data) {
    return saveImportedImage(assets, data.buffer, 'data-image', data.mime);
  }

  if (/^https?:\/\//i.test(value) || context.baseUrl) {
    try {
      const url = /^https?:\/\//i.test(value) ? value : new URL(value, context.baseUrl).toString();
      const loaded = await loadRemoteImage(url);
      if (loaded) {
        return saveImportedImage(assets, loaded.buffer, url, loaded.mime);
      }
    } catch {
      return null;
    }
  }

  if (context.zipEntries) {
    const entry = findZipEntryImage(context.zipEntries, value, context.markdownEntryName);
    if (entry && !entry.isDirectory) {
      return saveImportedImage(assets, entry.getData(), entry.entryName, '');
    }
  }

  if (context.localBaseDir && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    try {
      let decodedValue = value;
      try {
        decodedValue = decodeURIComponent(value);
      } catch {
        decodedValue = value;
      }
      if (path.isAbsolute(decodedValue)) {
        return null;
      }
      const baseDir = path.resolve(context.localBaseDir);
      const localPath = path.resolve(baseDir, decodedValue);
      if (!isPathInsideDirectory(baseDir, localPath)) {
        return null;
      }
      const buffer = await fs.readFile(localPath);
      return saveImportedImage(assets, buffer, localPath, '');
    } catch {
      return null;
    }
  }

  return null;
}

async function rewriteMarkdownImages(markdown, assets, context = {}) {
  let result = await replaceMatchesAsync(String(markdown || ''), markdownImagePattern, async (match) => {
    const nextUrl = await resolveImageToAssetUrl(match.groups?.target || '', assets, context);
    const alt = match.groups?.alt || '';
    const title = match.groups?.title || '';
    return nextUrl ? `![${alt}](${nextUrl}${title})` : '';
  });

  result = await replaceMatchesAsync(result, htmlImageSrcPattern, async (match) => {
    const nextUrl = await resolveImageToAssetUrl(match.groups?.src || '', assets, context);
    return nextUrl ? `${match[1]}${nextUrl}${match[3]}` : '';
  });
  return result;
}

async function replaceMatchesAsync(text, pattern, createReplacement) {
  const matches = [...String(text || '').matchAll(pattern)];
  if (!matches.length) return text;

  const parts = [];
  let lastIndex = 0;
  for (const match of matches) {
    const index = match.index ?? 0;
    parts.push(text.slice(lastIndex, index));
    parts.push(await createReplacement(match));
    lastIndex = index + match[0].length;
  }
  parts.push(text.slice(lastIndex));
  return parts.join('');
}

async function parseDocumentWithConfig(app, filePath, config, options = {}) {
  const startedAt = Date.now();
  const parser = resolveFileParser(config, filePath);
  const developerLogger = createDeveloperLogger({
    app,
    config,
    moduleName: 'file-parser',
    name: path.basename(filePath || 'document'),
    meta: summarizeParserForLog(parser, options),
  });
  developerLogger.write('file.parse.started', {
    file: await summarizeFileForLog(filePath),
    parser: summarizeParserForLog(parser, options),
  });
  if (!parser.supported) {
    const error = new Error(`当前${parserLabels[parser.requestedProvider] || '解析方式'}不支持该文件格式`);
    developerLogger.write('file.parse.error', {
      duration_ms: Date.now() - startedAt,
      parser: summarizeParserForLog(parser, options),
      error: compactLogError(error),
    });
    throw error;
  }
  const provider = parser.provider;
  const preserveImages = options.preserveImages === true;
  const assets = preserveImages ? createAssetContext(app, options.assetScope || 'documents') : null;
  const parseOptions = { preserveImages, assets, imageResolver: createImageResolver(assets) };
  let markdown = '';
  try {    if (provider === 'opendataloader' || provider === 'mineru-local' || provider === 'paddleocr-local') {
      markdown = await parseWithPython(provider, filePath);
    } else {
      markdown = await parseLocalDocument(filePath, parseOptions);
      markdown = preserveImages ? await rewriteMarkdownImages(markdown, assets, { localBaseDir: path.dirname(filePath) }) : stripMarkdownImages(markdown);
    }
  } catch (error) {
    await deleteImportedImageAssets(assets).catch(() => undefined);
    developerLogger.write('file.parse.error', {
      duration_ms: Date.now() - startedAt,
      parser: summarizeParserForLog(parser, options),
      asset_count: assets?.index || 0,
      error: compactLogError(error),
    });
    throw normalizeDocumentParseError(error, filePath);
  }
  const result = preserveImages ? markdown : stripMarkdownImages(markdown);
  developerLogger.write('file.parse.completed', {
    duration_ms: Date.now() - startedAt,
    parser: summarizeParserForLog(parser, options),
    asset_count: assets?.index || 0,
    markdown_metrics: textMetrics(result),
  });
  return result;
}

async function importDocumentByPath(app, config, filePath) {
  if (!filePath) {
    return { success: false, message: '未选择文件' };
  }

  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return { success: false, message: '选择的路径不是有效文件' };
    }
  } catch {
    return { success: false, message: '项目绑定的招标文件不存在，请重新选择文件' };
  }

  const provider = config.file_parser?.provider || 'local';
  const supportedExtensions = getSelectableExtensions(provider);
  const ext = path.extname(filePath).toLowerCase();
  const parser = resolveFileParser(config, filePath);

  if (!supportedExtensions.has(ext)) {
    return { success: false, message: `当前${parserLabels[provider] || '解析方式'}不支持该文件格式` };
  }

  let fileContent = '';
  try {
    fileContent = (await parseDocumentWithConfig(app, filePath, config, { assetScope: 'technical-plan', preserveImages: false })).trim();
  } catch (error) {
    return {
      success: false,
      message: formatImportError(error, filePath),
      file_name: path.basename(filePath),
      parser_provider: parser.provider,
      parser_label: parserLabels[parser.provider] || '本地解析',
    };
  }

  if (!fileContent) {
    return { success: false, message: '未提取到有效 Markdown 内容，请检查文件内容' };
  }

  return {
    success: true,
    message: parser.fallbackToLocal ? '文件解析完成，当前格式已自动使用本地解析' : '文件解析完成',
    file_content: fileContent,
    file_name: path.basename(filePath),
    parser_provider: parser.provider,
    parser_label: parserLabels[parser.provider] || '本地解析',
  };
}

function createFileService({ app, configStore } = {}) {
  return {
    async importDocument(options = {}) {
      const config = configStore ? configStore.load() : { file_parser: { provider: 'local' } };
      if (options.sourcePath) {
        return importDocumentByPath(app, config, options.sourcePath);
      }
      const provider = config.file_parser?.provider || 'local';
      const supportedExtensions = getSelectableExtensions(provider);
      const result = await dialog.showOpenDialog({
        title: '选择招标文件',
        properties: ['openFile'],
        filters: [
          { name: parserLabels[provider] || '招标文件', extensions: [...supportedExtensions].map((item) => item.slice(1)) },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: '已取消选择' };
      }

      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      const parser = resolveFileParser(config, filePath);

      if (!supportedExtensions.has(ext)) {
        return { success: false, message: `当前${parserLabels[provider] || '解析方式'}不支持该文件格式` };
      }

      let fileContent = '';
      try {
        fileContent = (await parseDocumentWithConfig(app, filePath, config, { assetScope: 'technical-plan', preserveImages: false })).trim();
      } catch (error) {
        return {
          success: false,
          message: formatImportError(error, filePath),
          file_name: path.basename(filePath),
          parser_provider: parser.provider,
          parser_label: parserLabels[parser.provider] || '本地解析',
        };
      }

      if (!fileContent) {
        return { success: false, message: '未提取到有效 Markdown 内容，请检查文件内容' };
      }

      return {
        success: true,
        message: parser.fallbackToLocal ? '文件解析完成，当前格式已自动使用本地解析' : '文件解析完成',
        file_content: fileContent,
        file_name: path.basename(filePath),
        parser_provider: parser.provider,
        parser_label: parserLabels[parser.provider] || '本地解析',
      };
    },

    async importRejectionCheckDocument(role = 'tender') {
      const documentRole = role === 'bid' ? 'bid' : 'tender';
      const documentLabel = documentRole === 'bid' ? '投标文件' : '招标文件';
      const config = configStore ? configStore.load() : { file_parser: { provider: 'local' } };
      const provider = config.file_parser?.provider || 'local';
      const supportedExtensions = getSelectableExtensions(provider);
      const result = await dialog.showOpenDialog({
        title: `选择${documentLabel}`,
        properties: ['openFile'],
        filters: [
          { name: parserLabels[provider] || documentLabel, extensions: [...supportedExtensions].map((item) => item.slice(1)) },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: '已取消选择' };
      }

      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      const parser = resolveFileParser(config, filePath);

      if (!supportedExtensions.has(ext)) {
        return { success: false, message: `当前${parserLabels[provider] || '解析方式'}不支持该文件格式` };
      }

      let fileContent = '';
      try {
        fileContent = (await parseDocumentWithConfig(app, filePath, config, { assetScope: `rejection-check-${documentRole}`, preserveImages: false })).trim();
      } catch (error) {
        return {
          success: false,
          message: formatImportError(error, filePath),
          file_name: path.basename(filePath),
          parser_provider: parser.provider,
          parser_label: parserLabels[parser.provider] || '本地解析',
        };
      }

      if (!fileContent) {
        return { success: false, message: '未提取到有效 Markdown 内容，请检查文件内容' };
      }

      return {
        success: true,
        message: parser.fallbackToLocal ? '文件解析完成，当前格式已自动使用本地解析' : '文件解析完成',
        file_content: fileContent,
        file_name: path.basename(filePath),
        parser_provider: parser.provider,
        parser_label: parserLabels[parser.provider] || '本地解析',
      };
    },

    async selectDuplicateCheckFiles(options = {}) {
      const multiple = options?.multiple !== false;
      const result = await dialog.showOpenDialog({
        title: multiple ? '选择投标文件' : '选择招标文件',
        properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: [
          { name: '标书文档', extensions: [...duplicateCheckSupportedExtensions].map((item) => item.slice(1)) },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: '已取消选择', files: [] };
      }

      const supportedPaths = result.filePaths.filter((filePath) => duplicateCheckSupportedExtensions.has(path.extname(filePath).toLowerCase()));
      if (!supportedPaths.length) {
        return { success: false, message: '未选择支持的文件类型', files: [] };
      }

      const files = await Promise.all(supportedPaths.map(createLocalFileSelection));
      return {
        success: true,
        message: `已选择 ${files.length} 个文件`,
        files,
      };
    },
  };
}

module.exports = {
  createFileService,
  parseDocumentWithConfig,
  resolveFileParser,
};
