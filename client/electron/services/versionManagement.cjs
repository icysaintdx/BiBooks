/**
 * 版本管理服务
 * 支持技术方案的版本快照、历史查看、差异对比和版本恢复
 */

const crypto = require('node:crypto');

function now() {
  return new Date().toISOString();
}

function createVersionManagementStore({ db }) {
  function ensureTable() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS technical_plan_versions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        snapshot_json TEXT NOT NULL,
        step TEXT,
        outline_node_count INTEGER NOT NULL DEFAULT 0,
        content_word_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  ensureTable();

  function countOutlineNodes(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + 1 + countOutlineNodes(item.children), 0);
  }

  function countContentWords(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => {
      const words = String(item.content || '').replace(/\s+/g, '').length;
      return sum + words + countContentWords(item.children);
    }, 0);
  }

  function createSnapshot(technicalPlan) {
    return {
      step: technicalPlan.step,
      tenderFile: technicalPlan.tenderFile,
      projectOverview: technicalPlan.projectOverview,
      techRequirements: technicalPlan.techRequirements,
      bidAnalysisMode: technicalPlan.bidAnalysisMode,
      bidAnalysisTasks: technicalPlan.bidAnalysisTasks,
      outlineMode: technicalPlan.outlineMode,
      outlineData: technicalPlan.outlineData,
      globalFacts: technicalPlan.globalFacts,
      scoringAnalysis: technicalPlan.scoringAnalysis,
      contentGenerationSections: technicalPlan.contentGenerationSections,
      contentGenerationPlans: technicalPlan.contentGenerationPlans,
      snapshotDate: now(),
    };
  }

  function saveVersion({ name, description, technicalPlan }) {
    const id = crypto.randomUUID();
    const snapshot = createSnapshot(technicalPlan);
    const snapshotJson = JSON.stringify(snapshot);
    const outlineNodeCount = countOutlineNodes(snapshot.outlineData?.outline || []);
    const contentWordCount = countContentWords(snapshot.outlineData?.outline || []);
    const timestamp = now();

    db.prepare(`
      INSERT INTO technical_plan_versions (id, name, description, snapshot_json, step, outline_node_count, content_word_count, created_at, updated_at)
      VALUES (@id, @name, @description, @snapshot_json, @step, @outline_node_count, @content_word_count, @created_at, @updated_at)
    `).run({
      id,
      name: name || `版本 ${new Date().toLocaleString('zh-CN')}`,
      description: description || '',
      snapshot_json: snapshotJson,
      step: snapshot.step,
      outline_node_count: outlineNodeCount,
      content_word_count: contentWordCount,
      created_at: timestamp,
      updated_at: timestamp,
    });

    return { id, name, outlineNodeCount, contentWordCount, createdAt: timestamp };
  }

  function listVersions() {
    const rows = db.prepare(`
      SELECT id, name, description, step, outline_node_count, content_word_count, created_at, updated_at
      FROM technical_plan_versions
      ORDER BY created_at DESC
    `).all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      step: row.step,
      outlineNodeCount: row.outline_node_count,
      contentWordCount: row.content_word_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  function loadVersion(id) {
    const row = db.prepare('SELECT * FROM technical_plan_versions WHERE id = ?').get(id);
    if (!row) return null;

    let snapshot;
    try {
      snapshot = JSON.parse(row.snapshot_json);
    } catch {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      snapshot,
      createdAt: row.created_at,
    };
  }

  function deleteVersion(id) {
    const result = db.prepare('DELETE FROM technical_plan_versions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  function updateVersionMeta(id, { name, description }) {
    const updates = [];
    const params = { id, updated_at: now() };

    if (name !== undefined) {
      updates.push('name = @name');
      params.name = name;
    }
    if (description !== undefined) {
      updates.push('description = @description');
      params.description = description;
    }

    if (!updates.length) return false;

    const result = db.prepare(`
      UPDATE technical_plan_versions SET ${updates.join(', ')}, updated_at = @updated_at WHERE id = @id
    `).run(params);
    return result.changes > 0;
  }

  function getVersionCount() {
    const row = db.prepare('SELECT COUNT(*) as count FROM technical_plan_versions').get();
    return row?.count || 0;
  }

  function diffOutlines(oldOutline, newOutline, path = '') {
    const changes = [];

    const oldMap = new Map();
    const newMap = new Map();

    function buildMap(items, map, prefix) {
      (items || []).forEach((item, index) => {
        const key = item.id || `${prefix}[${index}]`;
        map.set(key, item);
        if (item.children?.length) {
          buildMap(item.children, map, key);
        }
      });
    }

    buildMap(oldOutline, oldMap, '');
    buildMap(newOutline, newMap, '');

    // 检查修改和删除
    for (const [id, oldItem] of oldMap) {
      const newItem = newMap.get(id);
      if (!newItem) {
        changes.push({ type: 'removed', id, title: oldItem.title });
        continue;
      }

      const fieldChanges = [];
      if (oldItem.title !== newItem.title) {
        fieldChanges.push({ field: 'title', old: oldItem.title, new: newItem.title });
      }
      if (oldItem.description !== newItem.description) {
        fieldChanges.push({ field: 'description', old: oldItem.description, new: newItem.description });
      }
      if ((oldItem.content || '') !== (newItem.content || '')) {
        const oldLen = String(oldItem.content || '').length;
        const newLen = String(newItem.content || '').length;
        fieldChanges.push({ field: 'content', oldLength: oldLen, newLength: newLen });
      }

      if (fieldChanges.length) {
        changes.push({ type: 'modified', id, title: newItem.title, fields: fieldChanges });
      }
    }

    // 检查新增
    for (const [id, newItem] of newMap) {
      if (!oldMap.has(id)) {
        changes.push({ type: 'added', id, title: newItem.title });
      }
    }

    return changes;
  }

  function compareVersions(versionId1, versionId2) {
    const v1 = loadVersion(versionId1);
    const v2 = loadVersion(versionId2);

    if (!v1 || !v2) {
      throw new Error('版本不存在，无法对比');
    }

    const outlineChanges = diffOutlines(
      v1.snapshot.outlineData?.outline || [],
      v2.snapshot.outlineData?.outline || [],
    );

    const summary = {
      version1: { id: v1.id, name: v1.name, date: v1.createdAt },
      version2: { id: v2.id, name: v2.name, date: v2.createdAt },
      outlineChanges,
      totalChanges: outlineChanges.length,
      addedCount: outlineChanges.filter((c) => c.type === 'added').length,
      modifiedCount: outlineChanges.filter((c) => c.type === 'modified').length,
      removedCount: outlineChanges.filter((c) => c.type === 'removed').length,
    };

    return summary;
  }

  return {
    saveVersion,
    listVersions,
    loadVersion,
    deleteVersion,
    updateVersionMeta,
    getVersionCount,
    compareVersions,
  };
}

module.exports = { createVersionManagementStore };
