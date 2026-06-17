const { app } = require('electron');
const Database = require('better-sqlite3');
const { createPricingStore } = require('../electron/services/pricingStore.cjs');

app.whenReady().then(() => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE pricing_sheets (
      id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'CNY',
      tax_rate REAL NOT NULL DEFAULT 0.13,
      discount_rate REAL NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      summary_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  let currentProject = { id: 'project-a' };
  const projectWorkspaceStore = { getCurrent: () => currentProject };
  const store = createPricingStore({ db, projectWorkspaceStore });
  const saved = store.save({
    id: 'sheet-test',
    projectName: '测试项目',
    taxRate: 0.13,
    discountRate: 0.1,
    items: [
      { id: 'i1', category: '设备费', name: '设备A', specification: '', unit: '台', quantity: 2, unitPrice: 1000, subtotal: 0, notes: '' },
    ],
    notes: '',
  });

  if (saved.bidProjectId !== 'project-a') throw new Error(`project binding failed: ${saved.bidProjectId}`);
  if (saved.summary.totalAmount !== 2034) throw new Error(`total mismatch: ${saved.summary.totalAmount}`);
  if (store.list().length !== 1) throw new Error('list failed');
  const md = store.exportMarkdown(saved);
  if (!md.includes('测试项目') || !md.includes('2,034.00')) throw new Error('markdown failed');

  currentProject = { id: 'project-b' };
  if (store.list().length !== 0) throw new Error('project filter failed');
  store.save({ id: 'sheet-b', projectName: '项目B', items: [] });
  if (store.list().length !== 1 || store.list()[0].id !== 'sheet-b') throw new Error('project b list failed');

  currentProject = { id: 'project-a' };
  if (store.list().length !== 1 || store.list()[0].id !== 'sheet-test') throw new Error('project a restore failed');
  db.prepare(`
    INSERT INTO pricing_sheets (
      id, bid_project_id, project_name, items_json, summary_json, created_at, updated_at
    ) VALUES (
      'sheet-bad-json', 'project-a', '坏 JSON 兼容测试', '{bad json', '{bad summary', '2026-01-01', '2026-01-01'
    )
  `).run();
  const recovered = store.list().find((item) => item.id === 'sheet-bad-json');
  if (!recovered || !Array.isArray(recovered.items)) throw new Error('bad json fallback failed');
  store.remove('sheet-test');
  store.remove('sheet-bad-json');
  if (store.list().length !== 0) throw new Error('delete failed');
  db.close();
  console.log('pricing-store smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
