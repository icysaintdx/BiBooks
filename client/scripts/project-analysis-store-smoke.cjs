const { app } = require('electron');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createProjectAnalysisStore } = require('../electron/services/projectAnalysisStore.cjs');

app.whenReady().then(() => {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE project_analysis_records (
      record_id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      analysis_type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      input_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  let currentProject = { id: 'project-a' };
  const projectWorkspaceStore = { getCurrent: () => currentProject };
  const store = createProjectAnalysisStore({ db, projectWorkspaceStore });

  const competitiveA = store.save({
    type: 'competitive',
    title: 'Project A competitive',
    input: { industryCode: 'construction' },
    result: { projectInfo: { projectName: 'A' } },
  });
  assert.equal(competitiveA.bidProjectId, 'project-a');
  assert.equal(store.getLatest('competitive').id, competitiveA.id);
  assert.deepEqual(store.list('competitive').map((item) => item.id), [competitiveA.id]);

  const complianceA = store.save({
    type: 'compliance',
    title: 'Project A compliance',
    input: { bidAnalysis: { projectInfo: { projectName: 'A' } } },
    result: { projectName: 'A', score: 95 },
  });
  assert.equal(complianceA.bidProjectId, 'project-a');
  assert.equal(store.getLatest('compliance').id, complianceA.id);

  currentProject = { id: 'project-b' };
  assert.equal(store.list('competitive').length, 0);
  assert.equal(store.getLatest('compliance'), null);

  const competitiveB = store.save({
    type: 'competitive',
    title: 'Project B competitive',
    input: { industryCode: 'it_information' },
    result: { projectInfo: { projectName: 'B' } },
  });
  assert.equal(competitiveB.bidProjectId, 'project-b');
  assert.deepEqual(store.list('competitive').map((item) => item.id), [competitiveB.id]);

  currentProject = { id: 'project-a' };
  assert.deepEqual(store.list('competitive').map((item) => item.id), [competitiveA.id]);
  assert.deepEqual(store.list('compliance').map((item) => item.id), [complianceA.id]);

  store.remove(competitiveA.id);
  assert.equal(store.getLatest('competitive'), null);

  db.close();
  console.log('project-analysis store smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
