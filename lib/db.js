import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

const DEFAULT_DB_DIR = join(homedir(), ".ima2");
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, "sessions.db");

let db = null;

export function getDbPath() {
  return process.env.IMA2_DB_PATH || DEFAULT_DB_PATH;
}

export function getDb() {
  if (db) return db;
  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      graph_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS nodes (
      session_id  TEXT NOT NULL,
      id          TEXT NOT NULL,
      x           REAL NOT NULL DEFAULT 0,
      y           REAL NOT NULL DEFAULT 0,
      data        TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (session_id, id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS edges (
      session_id  TEXT NOT NULL,
      id          TEXT NOT NULL,
      source      TEXT NOT NULL,
      target      TEXT NOT NULL,
      data        TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (session_id, id),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id);
    CREATE INDEX IF NOT EXISTS idx_edges_session ON edges(session_id);
  `);

  const sessionColumns = database
    .prepare("PRAGMA table_info(sessions)")
    .all()
    .map((row) => row.name);
  if (!sessionColumns.includes("graph_version")) {
    database.exec(
      "ALTER TABLE sessions ADD COLUMN graph_version INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!sessionColumns.includes("style_sheet")) {
    database.exec("ALTER TABLE sessions ADD COLUMN style_sheet TEXT");
  }
  if (!sessionColumns.includes("style_sheet_enabled")) {
    database.exec(
      "ALTER TABLE sessions ADD COLUMN style_sheet_enabled INTEGER NOT NULL DEFAULT 0",
    );
  }

  const row = database.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
  if (!row) {
    database.prepare("INSERT INTO _meta (key, value) VALUES ('schema_version', '2')").run();
  } else if (row.value !== "2") {
    database
      .prepare("UPDATE _meta SET value = '2' WHERE key = 'schema_version'")
      .run();
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
