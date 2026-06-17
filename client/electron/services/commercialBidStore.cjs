/**
 * 商务标持久化 Store
 */

function createCommercialBidStore({ db, projectWorkspaceStore }) {
  function getCurrentProjectId() {
    return projectWorkspaceStore?.getCurrent?.()?.id || '';
  }

  function claimLegacyRows(projectId) {
    if (!projectId) return;
    db.prepare("UPDATE commercial_bids SET bid_project_id = ? WHERE bid_project_id = ''").run(projectId);
  }

  function _row2bid(row) {
    return {
      id: row.id,
      bidProjectId: row.bid_project_id || '',
      projectName: row.project_name,
      companyName: row.company_name,
      priceType: row.price_type,
      sections: JSON.parse(row.sections_json || '[]'),
      result: row.result_json ? JSON.parse(row.result_json) : null,
      report: row.report || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function list() {
    const projectId = getCurrentProjectId();
    claimLegacyRows(projectId);
    if (projectId) {
      return db.prepare('SELECT * FROM commercial_bids WHERE bid_project_id = ? ORDER BY created_at DESC').all(projectId).map(_row2bid);
    }
    return db.prepare('SELECT * FROM commercial_bids ORDER BY created_at DESC').all().map(_row2bid);
  }

  function get(id) {
    const row = db.prepare('SELECT * FROM commercial_bids WHERE id = ?').get(id);
    return row ? _row2bid(row) : null;
  }

  function save(bid) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO commercial_bids
        (id, bid_project_id, project_name, company_name, price_type, sections_json, result_json, report, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        bid_project_id = excluded.bid_project_id,
        project_name = excluded.project_name,
        company_name = excluded.company_name,
        price_type = excluded.price_type,
        sections_json = excluded.sections_json,
        result_json = excluded.result_json,
        report = excluded.report,
        updated_at = excluded.updated_at
    `).run(
      bid.id,
      bid.bidProjectId || getCurrentProjectId(),
      bid.projectName,
      bid.companyName || '',
      bid.priceType || 'lumpSum',
      JSON.stringify(bid.sections || []),
      bid.result ? JSON.stringify(bid.result) : null,
      bid.report || null,
      bid.createdAt || now,
      now,
    );
    return get(bid.id);
  }

  function remove(id) {
    db.prepare('DELETE FROM commercial_bids WHERE id = ?').run(id);
  }

  return { list, get, save, remove };
}

module.exports = { createCommercialBidStore };
