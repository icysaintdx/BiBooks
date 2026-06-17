const assert = require('node:assert/strict');
const { createProjectWorkspaceStore } = require('../electron/services/projectWorkspaceStore.cjs');

function createMemoryDb() {
  const rows = {
    app_projects: new Map(),
    current_project_id: '',
    snapshots: new Map(),
    project_analysis_records: new Map(),
    pricing_sheets: new Map(),
    commercial_bids: new Map(),
    bid_opportunities: new Map(),
  };

  function sortedProjects(includeDeleted = true) {
    return [...rows.app_projects.values()]
      .filter((project) => includeDeleted || !project.deleted_at)
      .sort((a, b) => String(b.last_opened_at || b.updated_at).localeCompare(String(a.last_opened_at || a.updated_at)));
  }

  return {
    rows,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      return {
        get(...params) {
          if (normalized.startsWith('SELECT current_project_id FROM app_project_meta')) return rows.current_project_id ? { current_project_id: rows.current_project_id } : undefined;
          if (normalized.startsWith('SELECT COUNT(*) AS count FROM app_projects')) return { count: rows.app_projects.size };
          if (normalized.startsWith('SELECT * FROM app_projects WHERE project_id = ?')) return rows.app_projects.get(params[0]);
          if (normalized.startsWith('SELECT * FROM app_project_snapshots WHERE project_id = ?')) return rows.snapshots.get(params[0]);
          if (normalized.startsWith('SELECT project_id FROM app_projects ORDER BY')) {
            const [project] = sortedProjects(false);
            return project ? { project_id: project.project_id } : undefined;
          }
          throw new Error(`Unsupported get: ${normalized}`);
        },
        all(...params) {
          if (normalized.startsWith('SELECT project_id FROM app_projects WHERE deleted_at')) {
            const threshold = params[0];
            return [...rows.app_projects.values()]
              .filter((project) => project.deleted_at && project.purge_after && project.purge_after <= threshold)
              .map((project) => ({ project_id: project.project_id }));
          }
          if (normalized.includes('SELECT * FROM app_projects') && normalized.includes("deleted_at = ''")) return sortedProjects(false);
          if (normalized.includes('SELECT * FROM app_projects') && normalized.includes('1 = 1')) return sortedProjects(true);
          if (normalized.startsWith('SELECT * FROM app_projects ORDER BY')) return sortedProjects(true);
          throw new Error(`Unsupported all: ${normalized}`);
        },
        run(paramsOrA, paramsB, paramsC, paramsD) {
          if (normalized.startsWith('INSERT INTO app_project_meta')) {
            rows.current_project_id = paramsOrA.project_id;
            return;
          }
          if (normalized.startsWith('INSERT INTO app_projects')) {
            rows.app_projects.set(paramsOrA.project_id, {
              project_id: paramsOrA.project_id,
              name: paramsOrA.name,
              tender_file_name: paramsOrA.tender_file_name || '',
              tender_file_path: paramsOrA.tender_file_path || '',
              project_dir: paramsOrA.project_dir || '',
              status: paramsOrA.status || 'active',
              last_section: paramsOrA.last_section || 'technical-plan',
              notes: paramsOrA.notes || '',
              password_salt: paramsOrA.password_salt || '',
              password_hash: paramsOrA.password_hash || '',
              deleted_at: paramsOrA.deleted_at || '',
              purge_after: paramsOrA.purge_after || '',
              created_at: paramsOrA.created_at || paramsOrA.timestamp,
              updated_at: paramsOrA.updated_at || paramsOrA.timestamp,
              last_opened_at: paramsOrA.last_opened_at || paramsOrA.timestamp,
            });
            return;
          }
          if (normalized.startsWith('UPDATE app_projects SET name =')) {
            const existing = rows.app_projects.get(paramsOrA.project_id);
            Object.assign(existing, {
              name: paramsOrA.name,
              tender_file_name: paramsOrA.tender_file_name,
              tender_file_path: paramsOrA.tender_file_path,
              project_dir: paramsOrA.project_dir,
              status: paramsOrA.status,
              last_section: paramsOrA.last_section,
              notes: paramsOrA.notes,
              password_salt: paramsOrA.password_salt,
              password_hash: paramsOrA.password_hash,
              updated_at: paramsOrA.updated_at,
            });
            return;
          }
          if (normalized.startsWith('UPDATE app_projects SET last_opened_at')) {
            const existing = rows.app_projects.get(paramsC);
            existing.last_opened_at = paramsOrA;
            existing.updated_at = paramsB;
            return;
          }
          if (normalized.startsWith("UPDATE app_projects SET status = 'deleted'")) {
            const existing = rows.app_projects.get(paramsD);
            Object.assign(existing, { status: 'deleted', deleted_at: paramsOrA, purge_after: paramsB, updated_at: paramsC });
            return;
          }
          if (normalized.startsWith("UPDATE app_projects SET status = 'active'")) {
            const existing = rows.app_projects.get(paramsB);
            Object.assign(existing, { status: 'active', deleted_at: '', purge_after: '', updated_at: paramsOrA });
            return;
          }
          if (normalized.startsWith('INSERT INTO app_project_snapshots')) {
            rows.snapshots.set(paramsOrA.project_id, {
              project_id: paramsOrA.project_id,
              technical_plan_state_json: paramsOrA.state_json,
              technical_plan_markdown: paramsOrA.markdown,
              created_at: paramsOrA.created_at,
              updated_at: paramsOrA.updated_at,
            });
            return;
          }
          if (normalized.startsWith('DELETE FROM app_project_snapshots WHERE project_id = ?')) {
            rows.snapshots.delete(paramsOrA);
            return;
          }
          if (normalized.startsWith('DELETE FROM project_analysis_records WHERE bid_project_id = ?')) {
            for (const [key, value] of rows.project_analysis_records) if (value.bid_project_id === paramsOrA) rows.project_analysis_records.delete(key);
            return;
          }
          if (normalized.startsWith('DELETE FROM pricing_sheets WHERE bid_project_id = ?')) {
            for (const [key, value] of rows.pricing_sheets) if (value.bid_project_id === paramsOrA) rows.pricing_sheets.delete(key);
            return;
          }
          if (normalized.startsWith('DELETE FROM commercial_bids WHERE bid_project_id = ?')) {
            for (const [key, value] of rows.commercial_bids) if (value.bid_project_id === paramsOrA) rows.commercial_bids.delete(key);
            return;
          }
          if (normalized.startsWith('DELETE FROM bid_opportunities WHERE bid_project_id = ?')) {
            for (const [key, value] of rows.bid_opportunities) if (value.bid_project_id === paramsOrA) rows.bid_opportunities.delete(key);
            return;
          }
          if (normalized.startsWith('DELETE FROM app_projects WHERE project_id = ?')) {
            rows.app_projects.delete(paramsOrA);
            return;
          }
          throw new Error(`Unsupported run: ${normalized}`);
        },
      };
    },
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };
}

const db = createMemoryDb();
let technicalPlanState = { tenderFile: { fileName: 'Initial.pdf' }, step: 'document-analysis' };
let markdown = '# Initial';
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

const store = createProjectWorkspaceStore({ db, technicalPlanStore });
const initial = store.list();
assert.equal(initial.projects.length, 1);
assert.equal(initial.currentProjectId, '');
assert.equal(initial.projects[0].tenderFileName, '');

const projectA = store.create({ name: 'Project A' });
assert.equal(projectA.projects.length, 2);
assert.equal(technicalPlanState.step, 'document-analysis');
technicalPlanState = { tenderFile: { fileName: 'A.pdf' }, step: 'content-edit' };
markdown = '# A';

const projectB = store.create({ name: 'Project B' });
assert.equal(projectB.projects.length, 3);
technicalPlanState = { tenderFile: { fileName: 'B.pdf' }, step: 'bid-analysis' };
markdown = '# B';

store.select(projectA.currentProjectId);
assert.equal(technicalPlanState.tenderFile.fileName, 'A.pdf');
assert.equal(markdown, '# A');

store.select(projectB.currentProjectId);
assert.equal(technicalPlanState.tenderFile.fileName, 'B.pdf');
assert.equal(markdown, '# B');

store.saveLastSection('pricing');
const current = store.getCurrent();
assert.equal(current.lastSection, 'pricing');

const deleteTargetId = projectB.currentProjectId;
db.rows.project_analysis_records.set('analysis-b', { bid_project_id: deleteTargetId });
db.rows.pricing_sheets.set('pricing-b', { bid_project_id: deleteTargetId });
const afterDelete = store.remove(deleteTargetId);
assert.equal(afterDelete.projects.length, 3);
assert.equal(afterDelete.projects.find((project) => project.id === deleteTargetId).status, 'deleted');
assert.equal(afterDelete.projects.find((project) => project.id === deleteTargetId).deletedAt.length > 0, true);
assert.notEqual(afterDelete.currentProjectId, deleteTargetId);
assert.equal(db.rows.project_analysis_records.size, 1);
assert.equal(db.rows.pricing_sheets.size, 1);

const afterRestore = store.restore(deleteTargetId);
assert.equal(afterRestore.projects.find((project) => project.id === deleteTargetId).deletedAt, '');

store.remove(deleteTargetId);
const afterDestroy = store.destroy(deleteTargetId);
assert.equal(afterDestroy.projects.some((project) => project.id === deleteTargetId), false);
assert.equal(db.rows.project_analysis_records.size, 0);
assert.equal(db.rows.pricing_sheets.size, 0);

console.log('project-workspace smoke ok');
