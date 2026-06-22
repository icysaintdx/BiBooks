const assert = require('node:assert/strict');
const path = require('node:path');
const { createFileService } = require('../electron/services/fileService.cjs');

const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node scripts/real-file-parser-smoke.cjs <file> [...file]');
  process.exit(1);
}

const service = createFileService({
  app: { getPath: () => path.join(process.cwd(), '.tmp-appdata') },
  configStore: { load: () => ({ file_parser: { provider: 'auto' } }) },
});

(async () => {
  const results = [];
  for (const filePath of files) {
    const result = await service.importDocument({ sourcePath: filePath });
    assert.equal(result.success, true, result.message || `failed to parse ${filePath}`);
    assert.ok((result.file_content || '').length > 1000, `parsed content too short for ${filePath}`);
    results.push({
      file: path.basename(filePath),
      chars: result.file_content.length,
      parser: result.parser_label,
    });
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
