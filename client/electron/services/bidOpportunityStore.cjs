/**
 * 投标机会持久化 Store
 */

function createBidOpportunityStore({ db }) {
  function _row2opp(row) {
    return {
      id: row.id,
      projectName: row.project_name,
      tenderNo: row.tender_no,
      clientName: row.client_name,
      budget: row.budget,
      deadline: row.deadline,
      source: row.source,
      description: row.description,
      status: row.status,
      decisionScore: row.decision_score,
      decisionFactors: JSON.parse(row.decision_factors_json || '{}'),
      notes: JSON.parse(row.notes_json || '[]'),
      statusHistory: JSON.parse(row.status_history_json || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function list() {
    return db.prepare('SELECT * FROM bid_opportunities ORDER BY created_at DESC').all().map(_row2opp);
  }

  function get(id) {
    const row = db.prepare('SELECT * FROM bid_opportunities WHERE id = ?').get(id);
    return row ? _row2opp(row) : null;
  }

  function save(opp) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO bid_opportunities
        (id, project_name, tender_no, client_name, budget, deadline, source, description,
         status, decision_score, decision_factors_json, notes_json, status_history_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_name = excluded.project_name,
        tender_no = excluded.tender_no,
        client_name = excluded.client_name,
        budget = excluded.budget,
        deadline = excluded.deadline,
        source = excluded.source,
        description = excluded.description,
        status = excluded.status,
        decision_score = excluded.decision_score,
        decision_factors_json = excluded.decision_factors_json,
        notes_json = excluded.notes_json,
        status_history_json = excluded.status_history_json,
        updated_at = excluded.updated_at
    `).run(
      opp.id,
      opp.projectName,
      opp.tenderNo || '',
      opp.clientName || '',
      opp.budget || 0,
      opp.deadline || '',
      opp.source || 'other',
      opp.description || '',
      opp.status || 'discovered',
      opp.decisionScore || 0,
      JSON.stringify(opp.decisionFactors || {}),
      JSON.stringify(opp.notes || []),
      JSON.stringify(opp.statusHistory || []),
      opp.createdAt || now,
      now,
    );
    return get(opp.id);
  }

  function remove(id) {
    db.prepare('DELETE FROM bid_opportunities WHERE id = ?').run(id);
  }

  return { list, get, save, remove };
}

module.exports = { createBidOpportunityStore };
