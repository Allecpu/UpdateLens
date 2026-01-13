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
};
