'use strict';

const {
  createPricingSheet,
  calculatePricingSummary,
  generatePricingTableMarkdown,
} = require('./pricingService.cjs');

function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSheet(input = {}) {
  const base = input.id ? input : createPricingSheet(input);
  return {
    ...base,
    projectName: String(base.projectName || ''),
    bidProjectId: String(base.bidProjectId || ''),
    currency: base.currency || 'CNY',
    taxRate: Number(base.taxRate ?? 0.13) || 0,
    discountRate: Number(base.discountRate ?? 0) || 0,
    items: Array.isArray(base.items) ? base.items.map((item) => ({
      id: String(item.id || makeId()),
      category: String(item.category || ''),
      name: String(item.name || ''),
      specification: String(item.specification || ''),
      unit: String(item.unit || ''),
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      subtotal: Number(item.subtotal) || 0,
      notes: String(item.notes || ''),
    })) : [],
    notes: String(base.notes || ''),
    createdAt: base.createdAt || new Date().toISOString(),
    updatedAt: base.updatedAt || new Date().toISOString(),
  };
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToSheet(row) {
  if (!row) return null;
  return {
    id: row.id,
    bidProjectId: row.bid_project_id || '',
    projectName: row.project_name || '',
    currency: row.currency || 'CNY',
    taxRate: Number(row.tax_rate) || 0,
    discountRate: Number(row.discount_rate) || 0,
    items: safeParseJson(row.items_json, []),
    notes: row.notes || '',
    summary: safeParseJson(row.summary_json, undefined),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createPricingStore({ db, projectWorkspaceStore }) {
  function getCurrentProjectId() {
    return projectWorkspaceStore?.getCurrent?.()?.id || '';
  }

  function claimLegacyRows(projectId) {
    if (!projectId) return;
    db.prepare("UPDATE pricing_sheets SET bid_project_id = ? WHERE bid_project_id = ''").run(projectId);
  }

  function list() {
    const projectId = getCurrentProjectId();
    claimLegacyRows(projectId);
    if (projectId) {
      return db.prepare(`
        SELECT * FROM pricing_sheets
        WHERE bid_project_id = ?
        ORDER BY updated_at DESC
      `).all(projectId).map(rowToSheet);
    }
    return db.prepare(`
      SELECT * FROM pricing_sheets
      ORDER BY updated_at DESC
    `).all().map(rowToSheet);
  }

  function get(id) {
    return rowToSheet(db.prepare('SELECT * FROM pricing_sheets WHERE id = ?').get(id));
  }

  function save(sheetInput) {
    const sheet = normalizeSheet(sheetInput);
    const projectId = getCurrentProjectId();
    if (projectId && !sheet.bidProjectId) sheet.bidProjectId = projectId;
    const summary = calculatePricingSummary(sheet);
    const now = new Date().toISOString();
    const existing = get(sheet.id);
    const createdAt = existing?.createdAt || sheet.createdAt || now;
    sheet.createdAt = createdAt;
    sheet.updatedAt = now;

    db.prepare(`
      INSERT INTO pricing_sheets (
        id, bid_project_id, project_name, currency, tax_rate, discount_rate,
        items_json, notes, summary_json, created_at, updated_at
      ) VALUES (
        @id, @bid_project_id, @project_name, @currency, @tax_rate, @discount_rate,
        @items_json, @notes, @summary_json, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        bid_project_id = excluded.bid_project_id,
        project_name = excluded.project_name,
        currency = excluded.currency,
        tax_rate = excluded.tax_rate,
        discount_rate = excluded.discount_rate,
        items_json = excluded.items_json,
        notes = excluded.notes,
        summary_json = excluded.summary_json,
        updated_at = excluded.updated_at
    `).run({
      id: sheet.id,
      bid_project_id: sheet.bidProjectId,
      project_name: sheet.projectName,
      currency: sheet.currency,
      tax_rate: sheet.taxRate,
      discount_rate: sheet.discountRate,
      items_json: JSON.stringify(sheet.items),
      notes: sheet.notes,
      summary_json: JSON.stringify(summary),
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    });

    return { ...sheet, summary };
  }

  function remove(id) {
    db.prepare('DELETE FROM pricing_sheets WHERE id = ?').run(id);
    return { success: true };
  }

  function calculate(sheetInput) {
    const sheet = normalizeSheet(sheetInput);
    return calculatePricingSummary(sheet);
  }

  function exportMarkdown(sheetInput) {
    const sheet = normalizeSheet(sheetInput);
    return generatePricingTableMarkdown(sheet);
  }

  return {
    list,
    get,
    save,
    remove,
    calculate,
    exportMarkdown,
  };
}

module.exports = {
  createPricingStore,
};
