const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { app } = require('electron');
const { createSqliteDatabase } = require('../electron/services/sqliteDatabase.cjs');
const { createProjectWorkspaceStore } = require('../electron/services/projectWorkspaceStore.cjs');

const sourcePath = process.argv[2];

if (!sourcePath) {
  console.error('Usage: electron scripts/project-tender-file-smoke.cjs <tender-file>');
  app.exit(1);
}

const tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'bibooks-tender-smoke-'));
app.setPath('userData', tempUserData);

app.whenReady().then(() => {
  const sqliteDatabase = createSqliteDatabase(app);
  const technicalPlanStore = {
    exportTechnicalPlanSnapshot: () => ({ state: { step: 'document-analysis' }, markdown: '' }),
    restoreTechnicalPlanSnapshot: () => undefined,
  };
  try {
    const store = createProjectWorkspaceStore({ app, db: sqliteDatabase.db, technicalPlanStore });
    const state = store.create({
      name: `真实招标文件复制烟测 ${Date.now()}`,
      tenderSourcePath: sourcePath,
    });
    const project = state.project;
    assert.ok(project?.tenderFilePath, 'project should store tender file path');
    assert.ok(fs.existsSync(project.tenderFilePath), 'copied tender file should exist');
    assert.equal(fs.statSync(project.tenderFilePath).size, fs.statSync(sourcePath).size, 'copied file size should match source');
    assert.ok(project.tenderFilePath.includes(`${path.sep}source${path.sep}`), 'copied tender file should live in project source directory');
    console.log(JSON.stringify({
      ok: true,
      projectDir: project.projectDir,
      tenderFileName: project.tenderFileName,
      copiedBytes: fs.statSync(project.tenderFilePath).size,
    }, null, 2));
  } finally {
    sqliteDatabase.close?.();
    fs.rmSync(tempUserData, { recursive: true, force: true });
  }
  app.quit();
}).catch((error) => {
  console.error(error);
  try {
    fs.rmSync(tempUserData, { recursive: true, force: true });
  } catch {}
  app.exit(1);
});
