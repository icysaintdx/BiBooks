'use strict';

const crypto = require('node:crypto');

const STATUSES = new Set(['open', 'in_progress', 'fixed', 'ignored', 'needs_review']);
const SEVERITIES = new Set(['critical', 'major', 'warning', 'info']);
const SOURCE_MODULES = new Set([
  'delivery_check',
  'pricing',
  'duplicate_check',
  'rejection_check',
  'compliance',
  'commercial_bid',
  'competitive_analysis',
  'manual',
]);
const TARGET_TYPES = new Set([
  'technical_section',
  'pricing_sheet',
  'commercial_section',
  'qualification',
  'project',
  'document',
]);

function now() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = normalizeText(value);
  return allowed.has(normalized) ? normalized : fallback;
}

function createTaskId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `repair-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.task_id,
    bidProjectId: row.bid_project_id || '',
    sourceModule: row.source_module,
    sourceRecordId: row.source_record_id || '',
    targetType: row.target_type,
    targetId: row.target_id || '',
    severity: row.severity,
    title: row.title,
    description: row.description || '',
    suggestion: row.suggestion || '',
    patch: safeJsonParse(row.patch_json, {}),
    status: row.status,
    decision: row.decision || '',
    metadata: safeJsonParse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
  };
}

function createRepairTaskStore({ db, projectWorkspaceStore }) {
  function getCurrentProjectId() {
    return projectWorkspaceStore?.getCurrent?.()?.id || '';
  }

  function list(filter = {}) {
    const projectId = normalizeText(filter.bidProjectId) || getCurrentProjectId();
    const clauses = [];
    const params = {};

    if (projectId) {
      clauses.push('bid_project_id = @bidProjectId');
      params.bidProjectId = projectId;
    }
    if (filter.status) {
      clauses.push('status = @status');
      params.status = normalizeEnum(filter.status, STATUSES, 'open');
    }
    if (filter.sourceModule) {
      clauses.push('source_module = @sourceModule');
      params.sourceModule = normalizeEnum(filter.sourceModule, SOURCE_MODULES, 'manual');
    }
    if (filter.targetType) {
      clauses.push('target_type = @targetType');
      params.targetType = normalizeEnum(filter.targetType, TARGET_TYPES, 'project');
    }
    if (filter.targetId) {
      clauses.push('target_id = @targetId');
      params.targetId = normalizeText(filter.targetId);
    }

    return db.prepare(`
      SELECT * FROM project_repair_tasks
      ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
      ORDER BY
        CASE status
          WHEN 'open' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'needs_review' THEN 2
          WHEN 'fixed' THEN 3
          ELSE 4
        END,
        updated_at DESC
    `).all(params).map(rowToTask);
  }

  function get(taskId) {
    return rowToTask(db.prepare('SELECT * FROM project_repair_tasks WHERE task_id = ?').get(normalizeText(taskId)));
  }

  function save(input = {}) {
    const timestamp = now();
    const taskId = normalizeText(input.id || input.taskId || input.task_id) || createTaskId();
    const existing = get(taskId);
    const status = normalizeEnum(input.status || existing?.status, STATUSES, 'open');
    const row = {
      task_id: taskId,
      bid_project_id: normalizeText(input.bidProjectId || input.bid_project_id) || existing?.bidProjectId || getCurrentProjectId(),
      source_module: normalizeEnum(input.sourceModule || input.source_module || existing?.sourceModule, SOURCE_MODULES, 'manual'),
      source_record_id: normalizeText(input.sourceRecordId || input.source_record_id || existing?.sourceRecordId),
      target_type: normalizeEnum(input.targetType || input.target_type || existing?.targetType, TARGET_TYPES, 'project'),
      target_id: normalizeText(input.targetId || input.target_id || existing?.targetId),
      severity: normalizeEnum(input.severity || existing?.severity, SEVERITIES, 'warning'),
      title: normalizeText(input.title || existing?.title),
      description: normalizeText(input.description || existing?.description),
      suggestion: normalizeText(input.suggestion || existing?.suggestion),
      patch_json: JSON.stringify(input.patch || existing?.patch || {}),
      status,
      decision: normalizeText(input.decision || existing?.decision),
      metadata_json: JSON.stringify(input.metadata || existing?.metadata || {}),
      created_at: existing?.createdAt || input.createdAt || input.created_at || timestamp,
      updated_at: timestamp,
      resolved_at: input.resolvedAt || input.resolved_at || (['fixed', 'ignored'].includes(status) ? timestamp : null),
    };

    if (!row.title) {
      throw new Error('Repair task title is required');
    }

    db.prepare(`
      INSERT INTO project_repair_tasks (
        task_id, bid_project_id, source_module, source_record_id, target_type, target_id,
        severity, title, description, suggestion, status, decision, metadata_json,
        patch_json, created_at, updated_at, resolved_at
      ) VALUES (
        @task_id, @bid_project_id, @source_module, @source_record_id, @target_type, @target_id,
        @severity, @title, @description, @suggestion, @status, @decision, @metadata_json,
        @patch_json,
        @created_at, @updated_at, @resolved_at
      )
      ON CONFLICT(task_id) DO UPDATE SET
        bid_project_id = excluded.bid_project_id,
        source_module = excluded.source_module,
        source_record_id = excluded.source_record_id,
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        severity = excluded.severity,
        title = excluded.title,
        description = excluded.description,
        suggestion = excluded.suggestion,
        patch_json = excluded.patch_json,
        status = excluded.status,
        decision = excluded.decision,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at,
        resolved_at = excluded.resolved_at
    `).run(row);

    return get(taskId);
  }

  function update(taskId, patch = {}) {
    const existing = get(taskId);
    if (!existing) {
      return null;
    }
    return save({ ...existing, ...patch, id: existing.id });
  }

  function bulkUpdateStatus(taskIds = [], status, decision = '') {
    const normalizedIds = Array.from(new Set((Array.isArray(taskIds) ? taskIds : []).map((taskId) => normalizeText(taskId)).filter(Boolean)));
    if (!normalizedIds.length) {
      return { success: true, updated: 0 };
    }
    const normalizedStatus = normalizeEnum(status, STATUSES, 'open');
    const timestamp = now();
    const resolvedAt = ['fixed', 'ignored'].includes(normalizedStatus) ? timestamp : null;
    const statement = db.prepare(`
      UPDATE project_repair_tasks
      SET status = ?, decision = ?, updated_at = ?, resolved_at = ?
      WHERE task_id = ?
    `);
    const transaction = db.transaction((ids) => {
      for (const id of ids) {
        statement.run(normalizedStatus, normalizeText(decision), timestamp, resolvedAt, id);
      }
    });
    transaction(normalizedIds);
    return { success: true, updated: normalizedIds.length };
  }

  function remove(taskId) {
    db.prepare('DELETE FROM project_repair_tasks WHERE task_id = ?').run(normalizeText(taskId));
    return { success: true };
  }

  return {
    list,
    get,
    save,
    update,
    bulkUpdateStatus,
    remove,
  };
}

module.exports = {
  createRepairTaskStore,
};
