const { app } = require('electron');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { createCommercialBidStore } = require('../electron/services/commercialBidStore.cjs');
const { createBidOpportunityStore } = require('../electron/services/bidOpportunityStore.cjs');

app.whenReady().then(() => {
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE commercial_bids (
    id TEXT PRIMARY KEY,
    bid_project_id TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL,
    company_name TEXT NOT NULL DEFAULT '',
    price_type TEXT NOT NULL DEFAULT 'lumpSum',
    sections_json TEXT NOT NULL DEFAULT '[]',
    result_json TEXT,
    report TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE bid_opportunities (
    id TEXT PRIMARY KEY,
    bid_project_id TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL,
    tender_no TEXT NOT NULL DEFAULT '',
    client_name TEXT NOT NULL DEFAULT '',
    budget REAL NOT NULL DEFAULT 0,
    deadline TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'discovered',
    decision_score REAL NOT NULL DEFAULT 0,
    decision_factors_json TEXT NOT NULL DEFAULT '{}',
    notes_json TEXT NOT NULL DEFAULT '[]',
    status_history_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

let currentProject = { id: 'project-a' };
const projectWorkspaceStore = { getCurrent: () => currentProject };
const commercialBidStore = createCommercialBidStore({ db, projectWorkspaceStore });
const bidOpportunityStore = createBidOpportunityStore({ db, projectWorkspaceStore });

const bidA = commercialBidStore.save({ id: 'bid-a', projectName: '项目A商务标', sections: ['price'] });
assert.equal(bidA.bidProjectId, 'project-a');
assert.deepEqual(commercialBidStore.list().map((item) => item.id), ['bid-a']);

const oppA = bidOpportunityStore.save({ id: 'opp-a', projectName: '项目A机会', tenderNo: 'A001' });
assert.equal(oppA.bidProjectId, 'project-a');
assert.deepEqual(bidOpportunityStore.list().map((item) => item.id), ['opp-a']);

currentProject = { id: 'project-b' };
assert.equal(commercialBidStore.list().length, 0);
assert.equal(bidOpportunityStore.list().length, 0);
commercialBidStore.save({ id: 'bid-b', projectName: '项目B商务标', sections: ['terms'] });
bidOpportunityStore.save({ id: 'opp-b', projectName: '项目B机会', tenderNo: 'B001' });
assert.deepEqual(commercialBidStore.list().map((item) => item.id), ['bid-b']);
assert.deepEqual(bidOpportunityStore.list().map((item) => item.id), ['opp-b']);

currentProject = { id: 'project-a' };
assert.deepEqual(commercialBidStore.list().map((item) => item.id), ['bid-a']);
assert.deepEqual(bidOpportunityStore.list().map((item) => item.id), ['opp-a']);

// Legacy rows without project id are claimed by the current project on first list.
db.prepare(`
  INSERT INTO commercial_bids (id, project_name, created_at, updated_at)
  VALUES ('legacy-bid', '旧商务标', '2026-01-01', '2026-01-01')
`).run();
db.prepare(`
  INSERT INTO bid_opportunities (id, project_name, created_at, updated_at)
  VALUES ('legacy-opp', '旧机会', '2026-01-01', '2026-01-01')
`).run();
assert.ok(commercialBidStore.list().some((item) => item.id === 'legacy-bid'));
assert.ok(bidOpportunityStore.list().some((item) => item.id === 'legacy-opp'));
assert.equal(db.prepare('SELECT bid_project_id FROM commercial_bids WHERE id = ?').get('legacy-bid').bid_project_id, 'project-a');
assert.equal(db.prepare('SELECT bid_project_id FROM bid_opportunities WHERE id = ?').get('legacy-opp').bid_project_id, 'project-a');

db.close();
console.log('project-scoped modules smoke ok');
app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
