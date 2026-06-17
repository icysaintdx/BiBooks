const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { getWorkspaceDatabasePath } = require('../utils/paths.cjs');

const schemaVersion = 15;

function createInitialSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS technical_plan_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      step TEXT NOT NULL DEFAULT 'document-analysis',
      tender_file_name TEXT,
      tender_markdown_path TEXT,
      tender_markdown_hash TEXT,
      tender_markdown_chars INTEGER NOT NULL DEFAULT 0,
      tender_parser_label TEXT,
      tender_imported_at TEXT,
      bid_analysis_mode TEXT NOT NULL DEFAULT 'key',
      outline_mode TEXT NOT NULL DEFAULT 'aligned',
      outline_project_name TEXT,
      outline_project_overview TEXT,
      content_generation_options_json TEXT,
      content_generation_runtime_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS technical_plan_tasks (
      type TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      logs_json TEXT,
      stats_json TEXT,
      error TEXT,
      pause_requested INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS technical_plan_bid_items (
      item_id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      error TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_bid_items_order
    ON technical_plan_bid_items(sort_order);

    CREATE TABLE IF NOT EXISTS technical_plan_reference_docs (
      document_id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_reference_docs_order
    ON technical_plan_reference_docs(sort_order);

    CREATE TABLE IF NOT EXISTS technical_plan_outline_nodes (
      node_id TEXT PRIMARY KEY,
      parent_node_id TEXT,
      sort_order INTEGER NOT NULL,
      level INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_requirement_id TEXT,
      source_requirement_title TEXT,
      knowledge_item_ids_json TEXT,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_node_id) REFERENCES technical_plan_outline_nodes(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_outline_parent_order
    ON technical_plan_outline_nodes(parent_node_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_technical_plan_outline_level
    ON technical_plan_outline_nodes(level);

    CREATE TABLE IF NOT EXISTS technical_plan_content_sections (
      node_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'idle',
      error TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES technical_plan_outline_nodes(node_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_content_sections_status
    ON technical_plan_content_sections(status);

    CREATE TABLE IF NOT EXISTS technical_plan_content_plans (
      node_id TEXT PRIMARY KEY,
      plan_json TEXT NOT NULL,
      illustration_type TEXT NOT NULL DEFAULT 'none',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (node_id) REFERENCES technical_plan_outline_nodes(node_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS technical_plan_global_fact_groups (
      group_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_global_fact_groups_order
    ON technical_plan_global_fact_groups(sort_order);
  `);
}

function createTechnicalPlanGlobalFactsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS technical_plan_global_fact_groups (
      group_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_technical_plan_global_fact_groups_order
    ON technical_plan_global_fact_groups(sort_order);
  `);
}

function createDuplicateCheckSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS duplicate_check_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      step TEXT NOT NULL DEFAULT 'upload',
      active_analysis_tab TEXT NOT NULL DEFAULT 'metadata',
      current_signature TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duplicate_check_files (
      file_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extension TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      modified_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      content_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_files_role_order
    ON duplicate_check_files(role, sort_order);

    CREATE TABLE IF NOT EXISTS duplicate_check_tasks (
      type TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      logs_json TEXT,
      stats_json TEXT,
      error TEXT,
      payload_signature TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duplicate_check_analysis_sections (
      section TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      signature TEXT,
      stats_json TEXT,
      started_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duplicate_check_content_files (
      file_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      content_path TEXT,
      content_length INTEGER NOT NULL DEFAULT 0,
      parser_label TEXT,
      error TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_content_files_status
    ON duplicate_check_content_files(status);

    CREATE TABLE IF NOT EXISTS duplicate_check_metadata_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      normalized TEXT,
      date_day TEXT,
      comparable INTEGER NOT NULL DEFAULT 0,
      date_comparable INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      UNIQUE(file_id, key)
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_metadata_file_order
    ON duplicate_check_metadata_items(file_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_metadata_key
    ON duplicate_check_metadata_items(key);

    CREATE TABLE IF NOT EXISTS duplicate_check_outline_items (
      item_id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      parent_item_id TEXT,
      level INTEGER NOT NULL,
      number TEXT,
      title TEXT NOT NULL,
      normalized_title TEXT NOT NULL,
      path_titles_json TEXT NOT NULL,
      normalized_path TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      from_tender INTEGER NOT NULL DEFAULT 0,
      matched_tender_sentence TEXT,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      FOREIGN KEY (parent_item_id) REFERENCES duplicate_check_outline_items(item_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_outline_file_order
    ON duplicate_check_outline_items(file_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_outline_normalized
    ON duplicate_check_outline_items(normalized_title, normalized_path);

    CREATE TABLE IF NOT EXISTS duplicate_check_outline_groups (
      group_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      file_ids_json TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      paths_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_outline_groups_order
    ON duplicate_check_outline_groups(sort_order);

    CREATE TABLE IF NOT EXISTS duplicate_check_outline_pairwise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_a_id TEXT NOT NULL,
      file_b_id TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      title_overlap REAL NOT NULL DEFAULT 0,
      path_overlap REAL NOT NULL DEFAULT 0,
      order_similarity REAL NOT NULL DEFAULT 0,
      shared_count INTEGER NOT NULL DEFAULT 0,
      risk TEXT NOT NULL DEFAULT 'none',
      FOREIGN KEY (file_a_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      FOREIGN KEY (file_b_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      UNIQUE(file_a_id, file_b_id)
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_outline_pairwise_score
    ON duplicate_check_outline_pairwise(score DESC);

    CREATE TABLE IF NOT EXISTS duplicate_check_content_duplicates (
      duplicate_id TEXT PRIMARY KEY,
      sentence TEXT NOT NULL,
      normalized TEXT NOT NULL,
      file_ids_json TEXT NOT NULL,
      first_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_content_duplicates_order
    ON duplicate_check_content_duplicates(first_order);

    CREATE TABLE IF NOT EXISTS duplicate_check_content_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      duplicate_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      occurrence_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (duplicate_id) REFERENCES duplicate_check_content_duplicates(duplicate_id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      UNIQUE(duplicate_id, file_id)
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_content_occ_file
    ON duplicate_check_content_occurrences(file_id);

    CREATE TABLE IF NOT EXISTS duplicate_check_image_files (
      file_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      image_count INTEGER NOT NULL DEFAULT 0,
      unique_image_count INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS duplicate_check_duplicate_images (
      image_id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      preview_url TEXT NOT NULL,
      file_ids_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_duplicate_images_hash
    ON duplicate_check_duplicate_images(hash);

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_duplicate_images_order
    ON duplicate_check_duplicate_images(sort_order);

    CREATE TABLE IF NOT EXISTS duplicate_check_image_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      occurrence_count INTEGER NOT NULL DEFAULT 0,
      locations_json TEXT,
      FOREIGN KEY (image_id) REFERENCES duplicate_check_duplicate_images(image_id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES duplicate_check_files(file_id) ON DELETE CASCADE,
      UNIQUE(image_id, file_id)
    );

    CREATE INDEX IF NOT EXISTS idx_duplicate_check_image_occ_file
    ON duplicate_check_image_occurrences(file_id);
  `);
}

function createRejectionCheckSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rejection_check_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      step TEXT NOT NULL DEFAULT 'documents',
      active_document_tab TEXT NOT NULL DEFAULT 'tender',
      active_result_tab TEXT NOT NULL DEFAULT 'analysis',
      active_check_result_tab TEXT NOT NULL DEFAULT 'rejection',
      custom_check_items TEXT NOT NULL DEFAULT '',
      check_options_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rejection_check_documents (
      role TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      file_name TEXT NOT NULL,
      markdown_path TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content_chars INTEGER NOT NULL DEFAULT 0,
      parser_label TEXT,
      imported_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rejection_check_tasks (
      type TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      logs_json TEXT,
      stats_json TEXT,
      error TEXT,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rejection_check_extraction (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      status TEXT NOT NULL DEFAULT 'idle',
      content TEXT NOT NULL DEFAULT '',
      source TEXT,
      tender_signature TEXT,
      error TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rejection_check_results (
      result_type TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'idle',
      input_signature TEXT,
      active_finding_id TEXT,
      progress_message TEXT,
      error TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS rejection_check_risk_findings (
      finding_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      requirement TEXT NOT NULL,
      bid_evidence TEXT NOT NULL,
      risk_reason TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rejection_check_risk_order
    ON rejection_check_risk_findings(sort_order);

    CREATE INDEX IF NOT EXISTS idx_rejection_check_risk_severity
    ON rejection_check_risk_findings(severity);

    CREATE TABLE IF NOT EXISTS rejection_check_typo_findings (
      finding_id TEXT PRIMARY KEY,
      wrong_text TEXT NOT NULL,
      correct_text TEXT NOT NULL,
      original_excerpt TEXT NOT NULL,
      reason TEXT NOT NULL,
      location_hint TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rejection_check_typo_order
    ON rejection_check_typo_findings(sort_order);

    CREATE TABLE IF NOT EXISTS rejection_check_logic_findings (
      finding_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_text TEXT NOT NULL,
      location_hint TEXT NOT NULL,
      fallacy_reason TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rejection_check_logic_order
    ON rejection_check_logic_findings(sort_order);
  `);
}

function createWorkspaceV2Schema(db) {
  createDuplicateCheckSchema(db);
  createRejectionCheckSchema(db);
}

function createKnowledgeBaseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_migration_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      legacy_index_hash TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      migrated_folder_count INTEGER NOT NULL DEFAULT 0,
      migrated_document_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      cleanup_completed_at TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_folders (
      folder_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_folders_order
    ON knowledge_folders(sort_order, created_at);

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      document_id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      document_dir TEXT NOT NULL,
      source_path TEXT NOT NULL,
      markdown_path TEXT NOT NULL,
      markdown_hash TEXT,
      markdown_chars INTEGER NOT NULL DEFAULT 0,
      source_extension TEXT,
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      error TEXT,
      item_count INTEGER NOT NULL DEFAULT 0,
      block_count INTEGER NOT NULL DEFAULT 0,
      filtered_block_count INTEGER NOT NULL DEFAULT 0,
      candidate_item_count INTEGER NOT NULL DEFAULT 0,
      discarded_block_count INTEGER NOT NULL DEFAULT 0,
      system_discarded_after_retry_count INTEGER NOT NULL DEFAULT 0,
      last_batch_size INTEGER,
      parser_label TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES knowledge_folders(folder_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_folder_order
    ON knowledge_documents(folder_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_knowledge_documents_status
    ON knowledge_documents(status);

    CREATE TABLE IF NOT EXISTS knowledge_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      type TEXT NOT NULL,
      heading_path_json TEXT,
      content TEXT NOT NULL,
      content_chars INTEGER NOT NULL DEFAULT 0,
      is_filtered INTEGER NOT NULL DEFAULT 0,
      filter_reason TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
      UNIQUE(document_id, block_id, is_filtered)
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_blocks_document_order
    ON knowledge_blocks(document_id, is_filtered, sort_order);

    CREATE INDEX IF NOT EXISTS idx_knowledge_blocks_block_id
    ON knowledge_blocks(document_id, block_id);

    CREATE TABLE IF NOT EXISTS knowledge_candidate_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      source TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
      UNIQUE(document_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_candidate_items_document_order
    ON knowledge_candidate_items(document_id, sort_order);

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      resume TEXT NOT NULL,
      content TEXT NOT NULL,
      source_file TEXT,
      content_chars INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
      UNIQUE(document_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_items_document_order
    ON knowledge_items(document_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_knowledge_items_title
    ON knowledge_items(title);

    CREATE TABLE IF NOT EXISTS knowledge_item_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE,
      UNIQUE(document_id, item_id, block_id)
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_item_blocks_item_order
    ON knowledge_item_blocks(document_id, item_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_knowledge_item_blocks_block
    ON knowledge_item_blocks(document_id, block_id);

    CREATE TABLE IF NOT EXISTS knowledge_discarded_groups (
      group_id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      source TEXT NOT NULL,
      reason TEXT NOT NULL,
      block_ids_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_discarded_document_order
    ON knowledge_discarded_groups(document_id, source, sort_order);

    CREATE TABLE IF NOT EXISTS knowledge_reports (
      document_id TEXT PRIMARY KEY,
      total_blocks INTEGER NOT NULL DEFAULT 0,
      filtered_blocks_count INTEGER NOT NULL DEFAULT 0,
      candidate_items_count INTEGER NOT NULL DEFAULT 0,
      final_items_count INTEGER NOT NULL DEFAULT 0,
      matched_blocks_count INTEGER NOT NULL DEFAULT 0,
      discarded_blocks_count INTEGER NOT NULL DEFAULT 0,
      system_discarded_after_retry_count INTEGER NOT NULL DEFAULT 0,
      new_items_from_recovery_count INTEGER NOT NULL DEFAULT 0,
      recovery_attempt_count INTEGER NOT NULL DEFAULT 0,
      batch_size INTEGER NOT NULL DEFAULT 20,
      coverage_rate REAL NOT NULL DEFAULT 0,
      matched_rate REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(document_id) ON DELETE CASCADE
    );
  `);
}

function createScoringAnalysisSchema(db) {
  db.exec(`
    ALTER TABLE technical_plan_meta ADD COLUMN scoring_analysis_json TEXT;
  `);
}

function createBidModulesSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bid_opportunities (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS commercial_bids (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      company_name TEXT NOT NULL DEFAULT '',
      price_type TEXT NOT NULL DEFAULT 'lumpSum',
      sections_json TEXT NOT NULL DEFAULT '[]',
      result_json TEXT,
      report TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function createPricingSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pricing_sheets (
      id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      project_name TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'CNY',
      tax_rate REAL NOT NULL DEFAULT 0.13,
      discount_rate REAL NOT NULL DEFAULT 0,
      items_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      summary_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pricing_sheets_updated_at
    ON pricing_sheets(updated_at DESC);
  `);
}

function createSourceAnnotationSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_source_annotations (
      annotation_id TEXT PRIMARY KEY,
      project_scope TEXT NOT NULL DEFAULT 'technical_plan',
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL,
      source_title TEXT NOT NULL DEFAULT '',
      source_ref TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      claim TEXT NOT NULL DEFAULT '',
      risk_level TEXT NOT NULL DEFAULT 'low',
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      approved_by TEXT NOT NULL DEFAULT '',
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_source_annotations_target
    ON project_source_annotations(project_scope, target_type, target_id);

    CREATE INDEX IF NOT EXISTS idx_project_source_annotations_approval
    ON project_source_annotations(project_scope, approval_status, requires_approval);

    CREATE INDEX IF NOT EXISTS idx_project_source_annotations_source_type
    ON project_source_annotations(project_scope, source_type);
  `);
}

function createTenderParseQualitySchema(db) {
  db.exec(`
    ALTER TABLE technical_plan_meta ADD COLUMN tender_parse_quality_json TEXT;
  `);
}

function createProjectWorkspaceSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_projects (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tender_file_name TEXT NOT NULL DEFAULT '',
      tender_file_path TEXT NOT NULL DEFAULT '',
      project_dir TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      last_section TEXT NOT NULL DEFAULT 'technical-plan',
      notes TEXT NOT NULL DEFAULT '',
      password_salt TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      deleted_at TEXT NOT NULL DEFAULT '',
      purge_after TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_app_projects_updated_at
    ON app_projects(updated_at DESC);

    CREATE TABLE IF NOT EXISTS app_project_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_project_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_project_snapshots (
      project_id TEXT PRIMARY KEY,
      technical_plan_state_json TEXT,
      technical_plan_markdown TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES app_projects(project_id) ON DELETE CASCADE
    );
  `);
}

function createProjectScopedBidModuleSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_project_snapshots (
      project_id TEXT PRIMARY KEY,
      technical_plan_state_json TEXT,
      technical_plan_markdown TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES app_projects(project_id) ON DELETE CASCADE
    );

    ALTER TABLE commercial_bids ADD COLUMN bid_project_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE bid_opportunities ADD COLUMN bid_project_id TEXT NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_commercial_bids_project_updated
    ON commercial_bids(bid_project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bid_opportunities_project_updated
    ON bid_opportunities(bid_project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pricing_sheets_project_updated
    ON pricing_sheets(bid_project_id, updated_at DESC);
  `);
}

function createProjectAnalysisRecordSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_analysis_records (
      record_id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      analysis_type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      input_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_analysis_records_project_type_updated
    ON project_analysis_records(bid_project_id, analysis_type, updated_at DESC);
  `);
}

function createProjectSecurityAndRecycleSchema(db) {
  const existingColumns = new Set(db.prepare('PRAGMA table_info(app_projects)').all().map((column) => column.name));
  const addColumn = (name, definition) => {
    if (!existingColumns.has(name)) db.exec(`ALTER TABLE app_projects ADD COLUMN ${definition}`);
  };
  addColumn('tender_file_path', "tender_file_path TEXT NOT NULL DEFAULT ''");
  addColumn('project_dir', "project_dir TEXT NOT NULL DEFAULT ''");
  addColumn('password_salt', "password_salt TEXT NOT NULL DEFAULT ''");
  addColumn('password_hash', "password_hash TEXT NOT NULL DEFAULT ''");
  addColumn('deleted_at', "deleted_at TEXT NOT NULL DEFAULT ''");
  addColumn('purge_after', "purge_after TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_app_projects_deleted_purge
    ON app_projects(deleted_at, purge_after);
  `);
}

function createProjectRepairTaskSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_repair_tasks (
      task_id TEXT PRIMARY KEY,
      bid_project_id TEXT NOT NULL DEFAULT '',
      source_module TEXT NOT NULL,
      source_record_id TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'warning',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      suggestion TEXT NOT NULL DEFAULT '',
      patch_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'open',
      decision TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_project_repair_tasks_project_status_updated
    ON project_repair_tasks(bid_project_id, status, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_project_repair_tasks_source
    ON project_repair_tasks(bid_project_id, source_module, source_record_id);

    CREATE INDEX IF NOT EXISTS idx_project_repair_tasks_target
    ON project_repair_tasks(bid_project_id, target_type, target_id);
  `);
}

function createProjectRepairPatchSchema(db) {
  const existingColumns = new Set(db.prepare('PRAGMA table_info(project_repair_tasks)').all().map((column) => column.name));
  if (!existingColumns.has('patch_json')) {
    db.exec(`ALTER TABLE project_repair_tasks ADD COLUMN patch_json TEXT NOT NULL DEFAULT '{}'`);
  }
}

function tableExists(db, tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function ensureColumn(db, tableName, columnName, definition) {
  if (!tableExists(db, tableName)) return;
  const existingColumns = new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
  if (!existingColumns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

function ensureRuntimeSchemaCompatibility(db) {
  createPricingSchema(db);
  ensureColumn(db, 'pricing_sheets', 'bid_project_id', "bid_project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'pricing_sheets', 'project_name', "project_name TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'pricing_sheets', 'currency', "currency TEXT NOT NULL DEFAULT 'CNY'");
  ensureColumn(db, 'pricing_sheets', 'tax_rate', 'tax_rate REAL NOT NULL DEFAULT 0.13');
  ensureColumn(db, 'pricing_sheets', 'discount_rate', 'discount_rate REAL NOT NULL DEFAULT 0');
  ensureColumn(db, 'pricing_sheets', 'items_json', "items_json TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'pricing_sheets', 'notes', "notes TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'pricing_sheets', 'summary_json', "summary_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, 'pricing_sheets', 'created_at', "created_at TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'pricing_sheets', 'updated_at', "updated_at TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'commercial_bids', 'bid_project_id', "bid_project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'bid_opportunities', 'bid_project_id', "bid_project_id TEXT NOT NULL DEFAULT ''");
  db.prepare("UPDATE pricing_sheets SET created_at = COALESCE(NULLIF(created_at, ''), datetime('now')) WHERE created_at = ''").run();
  db.prepare("UPDATE pricing_sheets SET updated_at = COALESCE(NULLIF(updated_at, ''), datetime('now')) WHERE updated_at = ''").run();
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_sheets_project_updated
    ON pricing_sheets(bid_project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_commercial_bids_project_updated
    ON commercial_bids(bid_project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_bid_opportunities_project_updated
    ON bid_opportunities(bid_project_id, updated_at DESC);
  `);
}

const migrations = [
  {
    version: 1,
    description: '创建技术方案 SQLite 初始表结构',
    up: createInitialSchema,
  },
  {
    version: 2,
    description: '新增标书查重和废标项检查 SQLite 表结构',
    up: createWorkspaceV2Schema,
  },
  {
    version: 3,
    description: '新增知识库 SQLite 表结构',
    up: createKnowledgeBaseSchema,
  },
  {
    version: 4,
    description: '新增技术方案全局事实表结构',
    up: createTechnicalPlanGlobalFactsSchema,
  },
  {
    version: 5,
    description: '新增评分分析 JSON 字段',
    up: createScoringAnalysisSchema,
  },
  {
    version: 6,
    description: '新增投标机会和商务标持久化表',
    up: createBidModulesSchema,
  },
  {
    version: 7,
    description: '新增报价管理持久化表',
    up: createPricingSchema,
  },
  {
    version: 8,
    description: '新增项目来源标注和人工审批记录表',
    up: createSourceAnnotationSchema,
  },
  {
    version: 9,
    description: '新增招标文件解析质量报告字段',
    up: createTenderParseQualitySchema,
  },
  {
    version: 10,
    description: '新增投标项目工作区列表和当前项目指针',
    up: createProjectWorkspaceSchema,
  },
  {
    version: 11,
    description: '新增商务标、投标机会和报价的项目维度索引',
    up: createProjectScopedBidModuleSchema,
  },
  {
    version: 12,
    description: 'Add project scoped competitive and compliance analysis records',
    up: createProjectAnalysisRecordSchema,
  },
  {
    version: 13,
    description: 'Add project file directory, password lock, and recycle bin fields',
    up: createProjectSecurityAndRecycleSchema,
  },
  {
    version: 14,
    description: 'Add project repair task center',
    up: createProjectRepairTaskSchema,
  },
  {
    version: 15,
    description: 'Add repair task patch payload',
    up: createProjectRepairPatchSchema,
  },
];

function timestampForFileName() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/T/, '-').replace(/\..*$/, '');
}

function copyIfExists(source, target) {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, target);
  }
}

function backupDatabaseFiles(db, databasePath) {
  if (!fs.existsSync(databasePath)) {
    return;
  }

  db.pragma('wal_checkpoint(TRUNCATE)');
  const suffix = `backup-${timestampForFileName()}`;
  copyIfExists(databasePath, `${databasePath}.${suffix}`);
  copyIfExists(`${databasePath}-wal`, `${databasePath}-wal.${suffix}`);
  copyIfExists(`${databasePath}-shm`, `${databasePath}-shm.${suffix}`);
}

function applyMigrations(db, databasePath) {
  const currentVersion = Number(db.pragma('user_version', { simple: true }) || 0);
  if (currentVersion > schemaVersion) {
    throw new Error(`本地数据库版本 ${currentVersion} 高于当前客户端支持版本 ${schemaVersion}，请升级客户端后再使用技术方案功能。`);
  }
  if (currentVersion === schemaVersion) {
    return;
  }

  if (currentVersion > 0) {
    backupDatabaseFiles(db, databasePath);
  }

  const runMigration = db.transaction((migration) => {
    migration.up(db);
    db.pragma(`user_version = ${migration.version}`);
  });

  for (const migration of migrations.filter((item) => item.version > currentVersion).sort((a, b) => a.version - b.version)) {
    try {
      runMigration(migration);
    } catch (error) {
      throw new Error(`数据库升级失败（v${migration.version} ${migration.description}）：${error.message || String(error)}`);
    }
  }
}

function createSqliteDatabase(app) {
  const databasePath = getWorkspaceDatabasePath(app);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  applyMigrations(db, databasePath);
  ensureRuntimeSchemaCompatibility(db);

  const close = () => {
    if (db.open) {
      db.close();
    }
  };

  app.once('before-quit', close);

  return {
    db,
    path: databasePath,
    schemaVersion,
    close,
  };
}

module.exports = {
  createSqliteDatabase,
  schemaVersion,
};
