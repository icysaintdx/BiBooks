const { app } = require('electron');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createRepairTaskStore } = require('../electron/services/repairTaskStore.cjs');

app.whenReady().then(() => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE project_repair_tasks (
      task_id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      source_module TEXT NOT NULL,
      source_record_id TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'warning',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      suggestion TEXT NOT NULL DEFAULT '',
      patch_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'open',
      decision TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  let currentProject = { id: 'project-a' };
  const projectWorkspaceStore = { getCurrent: () => currentProject };
  const store = createRepairTaskStore({ db, projectWorkspaceStore });

  const task = store.save({
    title: '报价单金额未脱敏',
    sourceModule: 'pricing',
    targetType: 'pricing_sheet',
    severity: 'critical',
    description: '报价内容出现明文金额。',
    suggestion: '回到报价页处理金额隔离。',
  });

  assert.equal(task.bidProjectId, 'project-a');
  assert.equal(store.list().length, 1);
  assert.equal(store.list({ status: 'open' }).length, 1);

  const updated = store.update(task.id, { status: 'fixed', decision: '已完成脱敏' });
  assert.equal(updated.status, 'fixed');
  assert.equal(store.list().length, 1);
  assert.equal(store.list({ status: 'fixed' }).length, 1);

  currentProject = { id: 'project-b' };
  assert.equal(store.list().length, 0);

  const taskB = store.save({
    title: '合规项待检查',
    sourceModule: 'compliance',
    targetType: 'document',
  });
  assert.equal(taskB.bidProjectId, 'project-b');
  assert.equal(store.list().length, 1);

  db.close();
  console.log('repair-task store smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
