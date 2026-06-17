const { app } = require('electron');
const Database = require('better-sqlite3');
const { createSourceAnnotationStore } = require('../electron/services/sourceAnnotationStore.cjs');

app.whenReady().then(() => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE project_source_annotations (
      annotation_id TEXT PRIMARY KEY,
      project_scope TEXT NOT NULL DEFAULT 'technical_plan',
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL,
      source_title TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      claim TEXT NOT NULL DEFAULT '',
      risk_level TEXT NOT NULL DEFAULT 'low',
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      approved_by TEXT NOT NULL DEFAULT '',
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const store = createSourceAnnotationStore({ db });
  const saved = store.save({
    targetType: 'content_section',
    targetId: '1.1.1',
    sourceType: 'web',
    sourceTitle: '测试网页',
    sourceRef: 'https://example.com/source',
    claim: '互联网资料必须先人工确认。',
  });

  if (!saved.requiresApproval || saved.approvalStatus !== 'pending') {
    throw new Error(`web approval default failed: ${JSON.stringify(saved)}`);
  }
  if (store.list({ targetType: 'content_section', targetId: '1.1.1' }).length !== 1) {
    throw new Error('list by target failed');
  }
  const approved = store.approve(saved.annotationId, 'tester');
  if (approved.approvalStatus !== 'approved' || approved.approvedBy !== 'tester') {
    throw new Error('approve failed');
  }
  const rejected = store.reject(saved.annotationId, 'tester');
  if (rejected.approvalStatus !== 'rejected') {
    throw new Error('reject failed');
  }
  store.remove(saved.annotationId);
  if (store.list().length !== 0) {
    throw new Error('remove failed');
  }

  db.close();
  console.log('source-annotations smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
