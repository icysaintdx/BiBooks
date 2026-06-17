const assert = require('node:assert/strict');
const { app } = require('electron');
const { createSqliteDatabase } = require('../electron/services/sqliteDatabase.cjs');
const { createProjectWorkspaceStore } = require('../electron/services/projectWorkspaceStore.cjs');

app.whenReady().then(() => {
  const sqliteDatabase = createSqliteDatabase(app);
  let technicalPlanState = { tenderFile: { fileName: 'electron-smoke.pdf' }, step: 'document-analysis' };
  let markdown = '# electron smoke';
  const technicalPlanStore = {
    loadTechnicalPlan: () => technicalPlanState,
    exportTechnicalPlanSnapshot: () => ({ state: technicalPlanState, markdown }),
    restoreTechnicalPlanSnapshot: (snapshot) => {
      technicalPlanState = snapshot.state || { step: 'document-analysis' };
      markdown = snapshot.markdown || '';
    },
    clearTechnicalPlan: () => {
      technicalPlanState = { step: 'document-analysis' };
      markdown = '';
    },
  };
  const store = createProjectWorkspaceStore({ db: sqliteDatabase.db, technicalPlanStore });
  const state = store.list();
  assert.ok(Array.isArray(state.projects));
  assert.ok(state.projects.length >= 1);
  const created = store.create({ name: `Electron 项目烟测 ${Date.now()}` });
  assert.ok(created.currentProjectId);
  assert.ok(created.projects.some((project) => project.id === created.currentProjectId));
  store.saveLastSection('pricing');
  assert.equal(store.getCurrent().lastSection, 'pricing');
  sqliteDatabase.close?.();
  console.log('project-workspace electron smoke ok');
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
