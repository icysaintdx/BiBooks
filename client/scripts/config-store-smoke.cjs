const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createConfigStore } = require('../electron/services/configStore.cjs');

function createAppStub(rootDir) {
  return {
    getPath(name) {
      if (name === 'userData') return rootDir;
      if (name === 'documents') return path.join(rootDir, 'documents');
      return rootDir;
    },
  };
}

function main() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bibooks-config-smoke-'));
  const app = createAppStub(rootDir);
  const store = createConfigStore(app);

  const loaded = store.load();
  assert.ok(loaded.layout_template);
  assert.ok(Array.isArray(loaded.layout_templates));
  assert.ok(loaded.layout_templates.length >= 1);
  assert.equal(loaded.layout_template.id, loaded.layout_templates[0].id);

  const nextConfig = {
    ...loaded,
    layout_template: {
      ...loaded.layout_template,
      name: '测试模板',
      page: { ...loaded.layout_template.page, margin_left_mm: 30 },
    },
  };

  const saved = store.save(nextConfig);
  assert.equal(saved.success, true);
  const reloaded = store.load();
  assert.equal(reloaded.layout_template.name, '测试模板');
  assert.equal(reloaded.layout_template.page.margin_left_mm, 30);
  assert.ok(reloaded.layout_templates.some((item) => item.id === reloaded.layout_template.id));

  console.log('config-store smoke ok');
}

main();
