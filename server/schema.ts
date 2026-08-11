import type Database from 'better-sqlite3';

const ensureColumn = (
  db: Database.Database,
  table: string,
  column: string,
  definition: string
): void => {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;
  if (columns.some((col) => col.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
};

export const initSchema = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS release_plan_snapshots (
      snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT NOT NULL,
      language TEXT NOT NULL,
      etag TEXT,
      hash TEXT NOT NULL,
      raw_payload TEXT NOT NULL,
      schema_version TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS release_plan_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_plan_id TEXT NOT NULL,
      release_plan_id TEXT,
      learn_url TEXT,
      app_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      feature_name TEXT NOT NULL,
      summary TEXT,
      investment_area TEXT,
      status TEXT NOT NULL,
      wave TEXT,
      availability_date TEXT,
      availability_date_full TEXT,
      first_available_date TEXT,
      last_updated_date TEXT,
      enabled_for TEXT,
      geography_html TEXT,
      language TEXT NOT NULL,
      source_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_plan_id, language)
    );

    CREATE TABLE IF NOT EXISTS release_plan_availability_types (
      item_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (item_id, type),
      FOREIGN KEY (item_id) REFERENCES release_plan_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS release_plan_tags (
      item_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (item_id, tag),
      FOREIGN KEY (item_id) REFERENCES release_plan_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS release_plan_history (
      history_id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      snapshot_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      diff TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES release_plan_items(id) ON DELETE CASCADE,
      FOREIGN KEY (snapshot_id) REFERENCES release_plan_snapshots(snapshot_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_release_plan_items_product
      ON release_plan_items(product_name);
    CREATE INDEX IF NOT EXISTS idx_release_plan_items_app
      ON release_plan_items(app_name);
    CREATE INDEX IF NOT EXISTS idx_release_plan_items_status
      ON release_plan_items(status);
    CREATE INDEX IF NOT EXISTS idx_release_plan_items_wave
      ON release_plan_items(wave);
    CREATE INDEX IF NOT EXISTS idx_release_plan_items_language
      ON release_plan_items(language);
    CREATE INDEX IF NOT EXISTS idx_release_plan_items_updated
      ON release_plan_items(last_updated_date);
  `);

  ensureColumn(db, 'release_plan_items', 'release_plan_id', 'release_plan_id TEXT');
  ensureColumn(db, 'release_plan_items', 'learn_url', 'learn_url TEXT');

  // Filter presets tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS filter_presets (
      preset_id TEXT PRIMARY KEY,
      owner_tenant_id TEXT NOT NULL,
      owner_object_id TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_name TEXT,
      name TEXT NOT NULL,
      description TEXT,
      filters_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      visibility_scope TEXT NOT NULL DEFAULT 'private',
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_tenant_id, owner_object_id, name)
    );

    CREATE TABLE IF NOT EXISTS filter_preset_shares (
      share_id TEXT PRIMARY KEY,
      preset_id TEXT NOT NULL,
      grantee_tenant_id TEXT,
      grantee_object_id TEXT,
      grantee_email TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'view',
      created_by_tenant_id TEXT NOT NULL,
      created_by_object_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (preset_id) REFERENCES filter_presets(preset_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_filter_presets_owner
      ON filter_presets(owner_tenant_id, owner_object_id);
    CREATE INDEX IF NOT EXISTS idx_filter_preset_shares_preset
      ON filter_preset_shares(preset_id);
    CREATE INDEX IF NOT EXISTS idx_filter_preset_shares_grantee_email
      ON filter_preset_shares(grantee_email);
    CREATE INDEX IF NOT EXISTS idx_filter_preset_shares_grantee
      ON filter_preset_shares(grantee_tenant_id, grantee_object_id);

    -- User management table for RBAC
    CREATE TABLE IF NOT EXISTS sharing_users (
      user_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by_tenant_id TEXT,
      created_by_object_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sharing_users_tenant_object
      ON sharing_users(tenant_id, object_id);
    CREATE INDEX IF NOT EXISTS idx_sharing_users_email
      ON sharing_users(email);
    CREATE INDEX IF NOT EXISTS idx_sharing_users_role
      ON sharing_users(role);

    -- CSS domain: customers, activities, meeting docs and proposals
    CREATE TABLE IF NOT EXISTS css_customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      aliases_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS css_activities (
      activity_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      css_owner TEXT,
      last_update TEXT,
      bl_bu TEXT,
      issue TEXT NOT NULL,
      list_status TEXT,
      issue_status TEXT NOT NULL,
      details TEXT,
      eos_owners TEXT,
      customer_owners TEXT,
      css_action TEXT,
      notes TEXT,
      customer_priority TEXT,
      css_priority TEXT,
      due_date TEXT,
      rating REAL,
      item_type TEXT,
      source_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES css_customers(customer_id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS css_meeting_documents (
      document_id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      mime_type TEXT,
      file_type TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      content_base64 TEXT NOT NULL,
      extracted_text TEXT,
      extraction_status TEXT NOT NULL DEFAULT 'pending',
      extraction_error TEXT,
      uploaded_by TEXT,
      uploaded_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS css_validation_batches (
      batch_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      ai_provider TEXT NOT NULL DEFAULT 'none',
      ai_model TEXT,
      extraction_notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      validated_at TEXT,
      validated_by TEXT,
      FOREIGN KEY (document_id) REFERENCES css_meeting_documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS css_activity_proposals (
      proposal_id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      target_activity_id TEXT,
      payload_json TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      decision_status TEXT NOT NULL DEFAULT 'pending',
      decision_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES css_validation_batches(batch_id) ON DELETE CASCADE,
      FOREIGN KEY (target_activity_id) REFERENCES css_activities(activity_id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_css_activities_customer
      ON css_activities(customer_id);
    CREATE INDEX IF NOT EXISTS idx_css_activities_status
      ON css_activities(issue_status);
    CREATE INDEX IF NOT EXISTS idx_css_activities_owner
      ON css_activities(css_owner);
    CREATE INDEX IF NOT EXISTS idx_css_documents_status
      ON css_meeting_documents(extraction_status);
    CREATE INDEX IF NOT EXISTS idx_css_proposals_batch
      ON css_activity_proposals(batch_id);
  `);

  // Backward-compatible migrations for css_activities columns imported from Excel/SharePoint
  ensureColumn(db, 'css_activities', 'list_status', 'list_status TEXT');
  ensureColumn(db, 'css_activities', 'eos_owners', 'eos_owners TEXT');
  ensureColumn(db, 'css_activities', 'customer_owners', 'customer_owners TEXT');
  ensureColumn(db, 'css_activities', 'css_action', 'css_action TEXT');
  ensureColumn(db, 'css_activities', 'notes', 'notes TEXT');
  ensureColumn(db, 'css_activities', 'customer_priority', 'customer_priority TEXT');
  ensureColumn(db, 'css_activities', 'css_priority', 'css_priority TEXT');
  ensureColumn(db, 'css_activities', 'due_date', 'due_date TEXT');
  ensureColumn(db, 'css_activities', 'rating', 'rating REAL');
  ensureColumn(db, 'css_activities', 'item_type', 'item_type TEXT');
};
