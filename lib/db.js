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

    CREATE TABLE IF NOT EXISTS inflight (
      request_id     TEXT PRIMARY KEY,
      kind           TEXT NOT NULL,
      prompt         TEXT NOT NULL DEFAULT '',
      meta           TEXT NOT NULL DEFAULT '{}',
      session_id     TEXT,
      parent_node_id TEXT,
      client_node_id TEXT,
      owner          TEXT,
      attempt        INTEGER NOT NULL DEFAULT 1,
      max_attempts   INTEGER NOT NULL DEFAULT 1,
      started_at     INTEGER NOT NULL,
      phase          TEXT NOT NULL DEFAULT 'queued',
      phase_at       INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inflight_started ON inflight(started_at);
    CREATE INDEX IF NOT EXISTS idx_inflight_kind ON inflight(kind);
    CREATE INDEX IF NOT EXISTS idx_inflight_session ON inflight(session_id);
    CREATE INDEX IF NOT EXISTS idx_inflight_owner ON inflight(owner);
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
  if (!sessionColumns.includes("owner")) {
    const legacy = process.env.IMA2_LEGACY_OWNER || "ree9622";
    database.exec("ALTER TABLE sessions ADD COLUMN owner TEXT");
    database.prepare("UPDATE sessions SET owner = ? WHERE owner IS NULL").run(legacy);
    database.exec("CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner)");
  }

  const row = database.prepare("SELECT value FROM _meta WHERE key = 'schema_version'").get();
  if (!row) {
    database.prepare("INSERT INTO _meta (key, value) VALUES ('schema_version', '3')").run();
  } else if (row.value !== "3") {
    database
      .prepare("UPDATE _meta SET value = '3' WHERE key = 'schema_version'")
      .run();
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
