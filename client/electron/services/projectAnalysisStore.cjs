'use strict';

function makeId(prefix = 'analysis') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeType(type) {
  return type === 'compliance' ? 'compliance' : 'competitive';
}

function rowToRecord(row) {
  if (!row) return null;
  return {
    id: row.record_id,
    bidProjectId: row.bid_project_id || '',
    type: normalizeType(row.analysis_type),
    title: row.title || '',
    input: safeParseJson(row.input_json, {}),
    result: safeParseJson(row.result_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createProjectAnalysisStore({ db, projectWorkspaceStore }) {
  function getCurrentProjectId() {
    return projectWorkspaceStore?.getCurrent?.()?.id || '';
  }

  function list(type) {
    const projectId = getCurrentProjectId();
    const analysisType = normalizeType(type);
    if (projectId) {
      return db.prepare(`
        SELECT * FROM project_analysis_records
        WHERE bid_project_id = ? AND analysis_type = ?
        ORDER BY updated_at DESC
      `).all(projectId, analysisType).map(rowToRecord);
    }
    return db.prepare(`
      SELECT * FROM project_analysis_records
      WHERE analysis_type = ?
      ORDER BY updated_at DESC
    `).all(analysisType).map(rowToRecord);
  }

  function getLatest(type) {
    const projectId = getCurrentProjectId();
    const analysisType = normalizeType(type);
    if (projectId) {
      return rowToRecord(db.prepare(`
        SELECT * FROM project_analysis_records
        WHERE bid_project_id = ? AND analysis_type = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(projectId, analysisType));
    }
    return rowToRecord(db.prepare(`
      SELECT * FROM project_analysis_records
      WHERE analysis_type = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(analysisType));
  }

  function save(record) {
    const now = new Date().toISOString();
    const type = normalizeType(record?.type);
    const id = record?.id || makeId(type);
    const projectId = record?.bidProjectId || getCurrentProjectId();
    const title = String(record?.title || '');
    const existing = db.prepare('SELECT created_at FROM project_analysis_records WHERE record_id = ?').get(id);
    const createdAt = existing?.created_at || record?.createdAt || now;

    db.prepare(`
      INSERT INTO project_analysis_records (
        record_id, bid_project_id, analysis_type, title, input_json, result_json, created_at, updated_at
      ) VALUES (
        @record_id, @bid_project_id, @analysis_type, @title, @input_json, @result_json, @created_at, @updated_at
      )
      ON CONFLICT(record_id) DO UPDATE SET
        bid_project_id = excluded.bid_project_id,
        analysis_type = excluded.analysis_type,
        title = excluded.title,
        input_json = excluded.input_json,
        result_json = excluded.result_json,
        updated_at = excluded.updated_at
    `).run({
      record_id: id,
      bid_project_id: projectId,
      analysis_type: type,
      title,
      input_json: JSON.stringify(record?.input || {}),
      result_json: JSON.stringify(record?.result ?? null),
      created_at: createdAt,
      updated_at: now,
    });

    return rowToRecord(db.prepare('SELECT * FROM project_analysis_records WHERE record_id = ?').get(id));
  }

  function remove(id) {
    db.prepare('DELETE FROM project_analysis_records WHERE record_id = ?').run(id);
    return { success: true };
  }

  return {
    list,
    getLatest,
    save,
    remove,
  };
}

module.exports = { createProjectAnalysisStore };
