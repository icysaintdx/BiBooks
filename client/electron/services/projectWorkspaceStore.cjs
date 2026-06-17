'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dialog } = require('electron');
const { getWorkspaceDir } = require('../utils/paths.cjs');

const DEFAULT_PROJECT_NAME = '默认投标项目';
const VALID_SECTIONS = new Set([
  'project-management',
  'technical-plan',
  'business-bid',
  'pricing',
  'knowledge-base',
  'private-knowledge-base',
  'duplicate-check',
  'rejection-check',
  'bid-opportunity',
  'competitive-analysis',
  'compliance-check',
  'settings',
]);
const TENDER_EXTENSIONS = ['pdf', 'doc', 'docx', 'wps', 'txt', 'md', 'markdown'];
const RECYCLE_DAYS = 7;

function now() {
  return new Date().toISOString();
}

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function createProjectId() {
  return `project-${crypto.randomUUID()}`;
}

function normalizeProjectName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ') || DEFAULT_PROJECT_NAME;
}

function normalizeSection(value) {
  return VALID_SECTIONS.has(value) ? value : 'project-management';
}

function sanitizePathPart(value) {
  return String(value || 'project')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'project';
}

function deriveProjectNameFromFile(fileName) {
  const base = path.basename(String(fileName || ''), path.extname(String(fileName || '')));
  return base.replace(/招标文件/g, '').replace(/采购文件/g, '').replace(/\s+/g, ' ').trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function rowToProject(row, unlockedProjects = new Set()) {
  if (!row) return null;
  const hasPassword = Boolean(row.password_hash);
  return {
    id: row.project_id,
    name: row.name,
    tenderFileName: row.tender_file_name || '',
    tenderFilePath: row.tender_file_path || '',
    projectDir: row.project_dir || '',
    status: row.status || 'active',
    lastSection: normalizeSection(row.last_section),
    notes: row.notes || '',
    hasPassword,
    isUnlocked: !hasPassword || unlockedProjects.has(row.project_id),
    deletedAt: row.deleted_at || '',
    purgeAfter: row.purge_after || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
  };
}

function createProjectWorkspaceStore({ app, db, technicalPlanStore }) {
  const unlockedProjects = new Set();

  function getProjectsRoot() {
    const workspaceRoot = app?.getPath ? getWorkspaceDir(app) : path.join(os.tmpdir(), 'bibooks-workspace');
    const root = path.join(workspaceRoot, 'projects');
    fs.mkdirSync(root, { recursive: true });
    return root;
  }

  function getCurrentProjectId() {
    const row = db.prepare('SELECT current_project_id FROM app_project_meta WHERE id = 1').get();
    return row?.current_project_id || '';
  }

  function setCurrentProjectId(projectId) {
    const timestamp = now();
    db.prepare(`
      INSERT INTO app_project_meta (id, current_project_id, updated_at)
      VALUES (1, @project_id, @updated_at)
      ON CONFLICT(id) DO UPDATE SET current_project_id = excluded.current_project_id, updated_at = excluded.updated_at
    `).run({ project_id: projectId || '', updated_at: timestamp });
  }

  function clearCurrent() {
    setCurrentProjectId('');
    if (technicalPlanStore?.clearTechnicalPlan) technicalPlanStore.clearTechnicalPlan();
    return list();
  }

  function saveTechnicalPlanSnapshot(projectId) {
    if (!projectId || !technicalPlanStore?.exportTechnicalPlanSnapshot) return;
    const snapshot = technicalPlanStore.exportTechnicalPlanSnapshot();
    const timestamp = now();
    db.prepare(`
      INSERT INTO app_project_snapshots (project_id, technical_plan_state_json, technical_plan_markdown, created_at, updated_at)
      VALUES (@project_id, @state_json, @markdown, @created_at, @updated_at)
      ON CONFLICT(project_id) DO UPDATE SET
        technical_plan_state_json = excluded.technical_plan_state_json,
        technical_plan_markdown = excluded.technical_plan_markdown,
        updated_at = excluded.updated_at
    `).run({
      project_id: projectId,
      state_json: JSON.stringify(snapshot.state || null),
      markdown: snapshot.markdown || '',
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  function restoreTechnicalPlanSnapshot(projectId) {
    if (!projectId || !technicalPlanStore?.restoreTechnicalPlanSnapshot) return;
    const row = db.prepare('SELECT * FROM app_project_snapshots WHERE project_id = ?').get(projectId);
    if (!row) {
      technicalPlanStore.clearTechnicalPlan?.();
      return;
    }
    let state = null;
    try {
      state = row.technical_plan_state_json ? JSON.parse(row.technical_plan_state_json) : null;
    } catch {
      state = null;
    }
    technicalPlanStore.restoreTechnicalPlanSnapshot({ state, markdown: row.technical_plan_markdown || '' });
  }

  function inferDefaultProjectName() {
    try {
      const state = technicalPlanStore?.loadTechnicalPlan?.();
      return state?.tenderFile?.fileName || DEFAULT_PROJECT_NAME;
    } catch {
      return DEFAULT_PROJECT_NAME;
    }
  }

  function ensureDefaultProject() {
    const count = db.prepare('SELECT COUNT(*) AS count FROM app_projects').get()?.count || 0;
    if (count > 0) return;
    const timestamp = now();
    const projectId = createProjectId();
    const fileName = inferDefaultProjectName();
    db.prepare(`
      INSERT INTO app_projects (
        project_id, name, tender_file_name, tender_file_path, project_dir, status, last_section, notes,
        password_salt, password_hash, deleted_at, purge_after, created_at, updated_at, last_opened_at
      ) VALUES (
        @project_id, @name, @tender_file_name, '', '', 'active', 'project-management', '', '', '', '', '', @timestamp, @timestamp, @timestamp
      )
    `).run({
      project_id: projectId,
      name: normalizeProjectName(fileName),
      tender_file_name: fileName === DEFAULT_PROJECT_NAME ? '' : fileName,
      timestamp,
    });
  }

  function purgeExpiredDeletedProjects() {
    const expired = db.prepare(`
      SELECT project_id FROM app_projects
      WHERE deleted_at <> '' AND purge_after <> '' AND purge_after <= ?
    `).all(now());
    for (const row of expired) destroy(row.project_id, { skipList: true });
  }

  function list(options = {}) {
    ensureDefaultProject();
    purgeExpiredDeletedProjects();
    const includeDeleted = options.includeDeleted === true;
    const rows = db.prepare(`
      SELECT * FROM app_projects
      WHERE ${includeDeleted ? '1 = 1' : "deleted_at = ''"}
      ORDER BY deleted_at ASC, last_opened_at DESC, updated_at DESC
    `).all();
    const projects = rows.map((row) => rowToProject(row, unlockedProjects));
    const currentProjectId = getCurrentProjectId();
    return {
      currentProjectId: projects.some((project) => project.id === currentProjectId) ? currentProjectId : '',
      projects,
    };
  }

  function getCurrent() {
    const state = list();
    return state.projects.find((project) => project.id === state.currentProjectId) || null;
  }

  function getNextProjectDirectory(projectId, projectName) {
    const count = db.prepare('SELECT COUNT(*) AS count FROM app_projects').get()?.count || 0;
    const serial = String(count + 1).padStart(6, '0');
    const dir = path.join(getProjectsRoot(), `P${serial}_${sanitizePathPart(projectName)}_${projectId.slice(-8)}`);
    fs.mkdirSync(path.join(dir, 'source'), { recursive: true });
    return dir;
  }

  function copyTenderFile(sourcePath, projectDir) {
    if (!sourcePath) return { tenderFileName: '', tenderFilePath: '' };
    const resolved = path.resolve(String(sourcePath));
    if (!fs.existsSync(resolved)) throw new Error('招标文件不存在或已移动');
    const fileName = path.basename(resolved);
    const targetDir = path.join(projectDir, 'source');
    fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, fileName);
    fs.copyFileSync(resolved, targetPath);
    return { tenderFileName: fileName, tenderFilePath: targetPath };
  }

  async function selectTenderFile() {
    const result = await dialog.showOpenDialog({
      title: '选择招标文件',
      properties: ['openFile'],
      filters: [
        { name: '招标文件', extensions: TENDER_EXTENSIONS },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    return {
      success: true,
      filePath,
      fileName,
      suggestedProjectName: deriveProjectNameFromFile(fileName),
    };
  }

  function create(input = {}) {
    const timestamp = now();
    const previousProjectId = getCurrentProjectId();
    if (previousProjectId) saveTechnicalPlanSnapshot(previousProjectId);

    const projectId = createProjectId();
    const name = normalizeProjectName(input.name);
    const projectDir = getNextProjectDirectory(projectId, name);
    const copiedTender = copyTenderFile(input.tenderSourcePath || '', projectDir);
    const password = String(input.password || '');
    const passwordData = password ? hashPassword(password) : { salt: '', hash: '' };

    db.prepare(`
      INSERT INTO app_projects (
        project_id, name, tender_file_name, tender_file_path, project_dir, status, last_section, notes,
        password_salt, password_hash, deleted_at, purge_after, created_at, updated_at, last_opened_at
      ) VALUES (
        @project_id, @name, @tender_file_name, @tender_file_path, @project_dir, @status, @last_section, @notes,
        @password_salt, @password_hash, '', '', @created_at, @updated_at, @last_opened_at
      )
    `).run({
      project_id: projectId,
      name,
      tender_file_name: copiedTender.tenderFileName || String(input.tenderFileName || '').trim(),
      tender_file_path: copiedTender.tenderFilePath,
      project_dir: projectDir,
      status: 'active',
      last_section: normalizeSection(input.lastSection || 'technical-plan'),
      notes: String(input.notes || '').trim(),
      password_salt: passwordData.salt,
      password_hash: passwordData.hash,
      created_at: timestamp,
      updated_at: timestamp,
      last_opened_at: timestamp,
    });

    if (passwordData.hash) unlockedProjects.add(projectId);
    setCurrentProjectId(projectId);
    restoreTechnicalPlanSnapshot(projectId);
    return { project: rowToProject(db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId), unlockedProjects), ...list() };
  }

  function update(projectId, patch = {}) {
    ensureDefaultProject();
    const existing = db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId);
    if (!existing) throw new Error('投标项目不存在');
    if (existing.deleted_at) throw new Error('回收站中的项目需先恢复后再编辑');
    const timestamp = now();
    let tenderFileName = patch.tenderFileName === undefined ? existing.tender_file_name : String(patch.tenderFileName || '').trim();
    let tenderFilePath = existing.tender_file_path || '';
    if (patch.tenderSourcePath) {
      const projectDir = existing.project_dir || getNextProjectDirectory(projectId, patch.name || existing.name);
      const copied = copyTenderFile(patch.tenderSourcePath, projectDir);
      tenderFileName = copied.tenderFileName;
      tenderFilePath = copied.tenderFilePath;
    }
    let passwordSalt = existing.password_salt || '';
    let passwordHash = existing.password_hash || '';
    if (patch.password !== undefined) {
      const password = String(patch.password || '');
      const data = password ? hashPassword(password) : { salt: '', hash: '' };
      passwordSalt = data.salt;
      passwordHash = data.hash;
      if (!passwordHash) unlockedProjects.delete(projectId);
      else unlockedProjects.add(projectId);
    }

    db.prepare(`
      UPDATE app_projects SET
        name = @name,
        tender_file_name = @tender_file_name,
        tender_file_path = @tender_file_path,
        project_dir = @project_dir,
        status = @status,
        last_section = @last_section,
        notes = @notes,
        password_salt = @password_salt,
        password_hash = @password_hash,
        updated_at = @updated_at
      WHERE project_id = @project_id
    `).run({
      project_id: projectId,
      name: patch.name === undefined ? existing.name : normalizeProjectName(patch.name),
      tender_file_name: tenderFileName,
      tender_file_path: tenderFilePath,
      project_dir: existing.project_dir || '',
      status: patch.status === undefined ? existing.status : String(patch.status || 'active'),
      last_section: patch.lastSection === undefined ? existing.last_section : normalizeSection(patch.lastSection),
      notes: patch.notes === undefined ? existing.notes : String(patch.notes || '').trim(),
      password_salt: passwordSalt,
      password_hash: passwordHash,
      updated_at: timestamp,
    });
    return { project: rowToProject(db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId), unlockedProjects), ...list() };
  }

  function verifyPassword(row, password) {
    if (!row.password_hash) return true;
    const candidate = hashPassword(password, row.password_salt || '').hash;
    return timingSafeEqualHex(candidate, row.password_hash);
  }

  function select(projectId, options = {}) {
    ensureDefaultProject();
    const previousProjectId = getCurrentProjectId();
    const existing = db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId);
    if (!existing || existing.deleted_at) throw new Error('投标项目不存在');
    if (existing.password_hash && !unlockedProjects.has(projectId)) {
      if (!verifyPassword(existing, options.password || '')) throw new Error('项目密码不正确');
      unlockedProjects.add(projectId);
    }
    if (previousProjectId && previousProjectId !== projectId) saveTechnicalPlanSnapshot(previousProjectId);
    const timestamp = now();
    db.prepare('UPDATE app_projects SET last_opened_at = ?, updated_at = ? WHERE project_id = ?').run(timestamp, timestamp, projectId);
    setCurrentProjectId(projectId);
    if (previousProjectId !== projectId) restoreTechnicalPlanSnapshot(projectId);
    return { project: rowToProject(db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId), unlockedProjects), ...list() };
  }

  function saveLastSection(section) {
    const current = getCurrent();
    if (!current) return list();
    update(current.id, { lastSection: normalizeSection(section) });
    return list();
  }

  function remove(projectId) {
    ensureDefaultProject();
    const existing = db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId);
    if (!existing || existing.deleted_at) throw new Error('投标项目不存在');
    const timestamp = now();
    db.prepare(`
      UPDATE app_projects SET status = 'deleted', deleted_at = ?, purge_after = ?, updated_at = ?
      WHERE project_id = ?
    `).run(timestamp, addDaysIso(RECYCLE_DAYS), timestamp, projectId);
    if (getCurrentProjectId() === projectId) clearCurrent();
    unlockedProjects.delete(projectId);
    return list({ includeDeleted: true });
  }

  function restore(projectId) {
    const existing = db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId);
    if (!existing || !existing.deleted_at) throw new Error('回收站中未找到该项目');
    db.prepare(`
      UPDATE app_projects SET status = 'active', deleted_at = '', purge_after = '', updated_at = ?
      WHERE project_id = ?
    `).run(now(), projectId);
    return list({ includeDeleted: true });
  }

  function destroy(projectId, options = {}) {
    const existing = db.prepare('SELECT * FROM app_projects WHERE project_id = ?').get(projectId);
    if (!existing) return options.skipList ? undefined : list({ includeDeleted: true });
    db.transaction(() => {
      db.prepare('DELETE FROM app_project_snapshots WHERE project_id = ?').run(projectId);
      db.prepare('DELETE FROM project_analysis_records WHERE bid_project_id = ?').run(projectId);
      db.prepare('DELETE FROM pricing_sheets WHERE bid_project_id = ?').run(projectId);
      db.prepare('DELETE FROM commercial_bids WHERE bid_project_id = ?').run(projectId);
      db.prepare('DELETE FROM bid_opportunities WHERE bid_project_id = ?').run(projectId);
      db.prepare('DELETE FROM app_projects WHERE project_id = ?').run(projectId);
    })();
    if (existing.project_dir && fs.existsSync(existing.project_dir)) {
      fs.rmSync(existing.project_dir, { recursive: true, force: true });
    }
    if (getCurrentProjectId() === projectId) clearCurrent();
    unlockedProjects.delete(projectId);
    return options.skipList ? undefined : list({ includeDeleted: true });
  }

  clearCurrent();

  return {
    list,
    getCurrent,
    create,
    update,
    select,
    saveLastSection,
    remove,
    restore,
    destroy,
    clearCurrent,
    selectTenderFile,
  };
}

module.exports = {
  createProjectWorkspaceStore,
  deriveProjectNameFromFile,
};
