const crypto = require('node:crypto');

const SOURCE_TYPES = new Set(['tender_file', 'database', 'case_history', 'knowledge_base', 'private_kb', 'web', 'manual', 'ai_generated']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected']);

function now() {
  return new Date().toISOString();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeSourceType(value) {
  const sourceType = normalizeText(value);
  return SOURCE_TYPES.has(sourceType) ? sourceType : 'manual';
}

function normalizeRiskLevel(value) {
  const riskLevel = normalizeText(value);
  return RISK_LEVELS.has(riskLevel) ? riskLevel : 'low';
}

function normalizeApprovalStatus(value, requiresApproval) {
  const approvalStatus = normalizeText(value);
  if (APPROVAL_STATUSES.has(approvalStatus)) return approvalStatus;
  return requiresApproval ? 'pending' : 'approved';
}

function createAnnotationId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `source-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    annotationId: row.annotation_id,
    projectScope: row.project_scope,
    targetType: row.target_type,
    targetId: row.target_id,
    sourceType: row.source_type,
    sourceTitle: row.source_title,
    sourceRef: row.source_ref,
    excerpt: row.excerpt,
    claim: row.claim,
    riskLevel: row.risk_level,
    requiresApproval: Boolean(row.requires_approval),
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createSourceAnnotationStore({ db }) {
  function list(filter = {}) {
    const clauses = ['1=1'];
    const params = {};

    if (filter.projectScope) {
      clauses.push('project_scope = @projectScope');
      params.projectScope = normalizeText(filter.projectScope);
    }
    if (filter.targetType) {
      clauses.push('target_type = @targetType');
      params.targetType = normalizeText(filter.targetType);
    }
    if (filter.targetId) {
      clauses.push('target_id = @targetId');
      params.targetId = normalizeText(filter.targetId);
    }
    if (filter.sourceType) {
      clauses.push('source_type = @sourceType');
      params.sourceType = normalizeSourceType(filter.sourceType);
    }
    if (filter.approvalStatus) {
      clauses.push('approval_status = @approvalStatus');
      params.approvalStatus = normalizeApprovalStatus(filter.approvalStatus, true);
    }

    return db.prepare(`
      SELECT * FROM project_source_annotations
      WHERE ${clauses.join(' AND ')}
      ORDER BY updated_at DESC, created_at DESC
    `).all(params).map(mapRow);
  }

  function save(input = {}) {
    const timestamp = now();
    const annotationId = normalizeText(input.annotationId || input.annotation_id) || createAnnotationId();
    const sourceType = normalizeSourceType(input.sourceType || input.source_type);
    const requiresApproval = input.requiresApproval === true || input.requires_approval === true || sourceType === 'web';
    const approvalStatus = normalizeApprovalStatus(input.approvalStatus || input.approval_status, requiresApproval);

    const row = {
      annotation_id: annotationId,
      project_scope: normalizeText(input.projectScope || input.project_scope) || 'technical_plan',
      target_type: normalizeText(input.targetType || input.target_type) || 'global_fact',
      target_id: normalizeText(input.targetId || input.target_id),
      source_type: sourceType,
      source_title: normalizeText(input.sourceTitle || input.source_title),
      source_ref: normalizeText(input.sourceRef || input.source_ref),
      excerpt: normalizeText(input.excerpt),
      claim: normalizeText(input.claim),
      risk_level: normalizeRiskLevel(input.riskLevel || input.risk_level || (requiresApproval ? 'medium' : 'low')),
      requires_approval: requiresApproval ? 1 : 0,
      approval_status: approvalStatus,
      approved_by: normalizeText(input.approvedBy || input.approved_by),
      approved_at: input.approvedAt || input.approved_at || (approvalStatus === 'approved' && requiresApproval ? timestamp : null),
      created_at: input.createdAt || input.created_at || timestamp,
      updated_at: timestamp,
    };

    db.prepare(`
      INSERT INTO project_source_annotations (
        annotation_id, project_scope, target_type, target_id, source_type, source_title, source_ref,
        excerpt, claim, risk_level, requires_approval, approval_status, approved_by, approved_at, created_at, updated_at
      ) VALUES (
        @annotation_id, @project_scope, @target_type, @target_id, @source_type, @source_title, @source_ref,
        @excerpt, @claim, @risk_level, @requires_approval, @approval_status, @approved_by, @approved_at, @created_at, @updated_at
      )
      ON CONFLICT(annotation_id) DO UPDATE SET
        project_scope = excluded.project_scope,
        target_type = excluded.target_type,
        target_id = excluded.target_id,
        source_type = excluded.source_type,
        source_title = excluded.source_title,
        source_ref = excluded.source_ref,
        excerpt = excluded.excerpt,
        claim = excluded.claim,
        risk_level = excluded.risk_level,
        requires_approval = excluded.requires_approval,
        approval_status = excluded.approval_status,
        approved_by = excluded.approved_by,
        approved_at = excluded.approved_at,
        updated_at = excluded.updated_at
    `).run(row);

    return get(annotationId);
  }

  function get(annotationId) {
    const row = db.prepare('SELECT * FROM project_source_annotations WHERE annotation_id = ?').get(normalizeText(annotationId));
    return mapRow(row);
  }

  function approve(annotationId, approvedBy = 'local-user') {
    const timestamp = now();
    db.prepare(`
      UPDATE project_source_annotations
      SET approval_status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
      WHERE annotation_id = ?
    `).run(normalizeText(approvedBy) || 'local-user', timestamp, timestamp, normalizeText(annotationId));
    return get(annotationId);
  }

  function reject(annotationId, approvedBy = 'local-user') {
    const timestamp = now();
    db.prepare(`
      UPDATE project_source_annotations
      SET approval_status = 'rejected', approved_by = ?, approved_at = ?, updated_at = ?
      WHERE annotation_id = ?
    `).run(normalizeText(approvedBy) || 'local-user', timestamp, timestamp, normalizeText(annotationId));
    return get(annotationId);
  }

  function remove(annotationId) {
    db.prepare('DELETE FROM project_source_annotations WHERE annotation_id = ?').run(normalizeText(annotationId));
    return { success: true };
  }

  function replaceForTarget({ projectScope = 'technical_plan', targetType, targetId, annotations = [] }) {
    const normalizedScope = normalizeText(projectScope) || 'technical_plan';
    const normalizedType = normalizeText(targetType);
    const normalizedTargetId = normalizeText(targetId);
    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM project_source_annotations
        WHERE project_scope = ? AND target_type = ? AND target_id = ?
      `).run(normalizedScope, normalizedType, normalizedTargetId);
      for (const annotation of annotations) {
        save({ ...annotation, projectScope: normalizedScope, targetType: normalizedType, targetId: normalizedTargetId });
      }
    });
    transaction();
    return list({ projectScope: normalizedScope, targetType: normalizedType, targetId: normalizedTargetId });
  }

  return {
    list,
    get,
    save,
    approve,
    reject,
    remove,
    replaceForTarget,
  };
}

module.exports = {
  createSourceAnnotationStore,
};
