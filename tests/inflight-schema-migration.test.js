// Hotfix contract: a DB whose `inflight` table predates the Phase 2.4
// rollout (no owner / attempt / max_attempts columns) must be brought
// forward by ALTER on the next boot, not silently left behind.
//
// Reproduces the asrock prod state observed on 2026-04-26: inflight
// table existed with the old shape, schema_version was still '2', and
// CREATE TABLE IF NOT EXISTS could not add the new columns.

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "ima2-inflight-mig-"));
const dbPath = join(tmpDir, "sessions.db");

// Seed the temp DB with the OLD inflight schema (no owner/attempt/max_attempts).
{
  const seed = new Database(dbPath);
  seed.pragma("journal_mode = WAL");
  seed.exec(`
    CREATE TABLE _meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO _meta (key, value) VALUES ('schema_version', '2');
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Untitled',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      graph_version INTEGER NOT NULL DEFAULT 0, owner TEXT
    );
    CREATE TABLE nodes (
      session_id TEXT NOT NULL, id TEXT NOT NULL,
      x REAL NOT NULL DEFAULT 0, y REAL NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (session_id, id)
    );
    CREATE TABLE edges (
      session_id TEXT NOT NULL, id TEXT NOT NULL,
      source TEXT NOT NULL, target TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (session_id, id)
    );
    CREATE TABLE inflight (
      request_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      meta TEXT NOT NULL DEFAULT '{}',
      session_id TEXT,
      parent_node_id TEXT,
      client_node_id TEXT,
      started_at INTEGER NOT NULL,
      phase TEXT NOT NULL DEFAULT 'queued',
      phase_at INTEGER NOT NULL
    );
    CREATE INDEX idx_inflight_started ON inflight(started_at);
    CREATE INDEX idx_inflight_kind ON inflight(kind);
    CREATE INDEX idx_inflight_session ON inflight(session_id);
  `);
  seed.close();
}

// Now boot the real db.js against this seed — migrate() should ALTER.
process.env.IMA2_DB_PATH = dbPath;
const { getDb, closeDb } = await import("../lib/db.js");

describe("inflight schema migration (hotfix for the 2026-04-26 prod state)", () => {
  after(() => {
    closeDb();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("adds owner / attempt / max_attempts columns to a pre-existing inflight table", () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(inflight)").all().map((r) => r.name);
    assert.ok(cols.includes("owner"), "owner column should be added");
    assert.ok(cols.includes("attempt"), "attempt column should be added");
    assert.ok(cols.includes("max_attempts"), "max_attempts column should be added");
  });

  it("creates the idx_inflight_owner index alongside the new column", () => {
    const idx = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='inflight'")
      .all()
      .map((r) => r.name);
    assert.ok(idx.includes("idx_inflight_owner"), "owner index should exist");
  });

  it("bumps schema_version from 2 to 3", () => {
    const ver = getDb()
      .prepare("SELECT value FROM _meta WHERE key='schema_version'")
      .get();
    assert.equal(ver.value, "3");
  });

  it("startJob via the public API works against the migrated table", async () => {
    // Reset module cache effect: import the inflight module after the db
    // has been migrated so its prepared statements see the new columns.
    const { startJob, getJob } = await import("../lib/inflight.js");
    startJob({
      requestId: "r_post_migrate",
      kind: "classic",
      prompt: "hello",
      owner: "ree9622",
      maxAttempts: 3,
    });
    const job = getJob("r_post_migrate");
    assert.ok(job, "the job written through startJob should be readable");
    assert.equal(job.owner, "ree9622");
    assert.equal(job.attempt, 1);
    assert.equal(job.maxAttempts, 3);
  });
});
