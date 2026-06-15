/**
 * 商务标持久化 Store
 */

function createCommercialBidStore({ db }) {
  function _row2bid(row) {
    return {
      id: row.id,
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
        (id, project_name, company_name, price_type, sections_json, result_json, report, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_name = excluded.project_name,
        company_name = excluded.company_name,
        price_type = excluded.price_type,
        sections_json = excluded.sections_json,
        result_json = excluded.result_json,
        report = excluded.report,
        updated_at = excluded.updated_at
    `).run(
      bid.id,
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
