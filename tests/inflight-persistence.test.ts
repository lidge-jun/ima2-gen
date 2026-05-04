import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "ima2-inflight-persist-"));
process.env.IMA2_CONFIG_DIR = TEST_DIR;
process.env.IMA2_DB_PATH = join(TEST_DIR, "sessions.db");

const inflight = await import("../lib/inflight.ts");
const db = await import("../lib/db.ts");

beforeEach(() => {
  inflight._resetForTests();
});

after(() => {
  db.closeDb();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

test("active inflight metadata survives database close and reopen", () => {
  inflight.startJob({
    requestId: "req_persist",
    kind: "node",
    prompt: "persist me",
    meta: {
      kind: "node",
      sessionId: "s_1",
      parentNodeId: "n_parent",
      clientNodeId: "nc_1",
    },
  });
  inflight.setJobPhase("req_persist", "streaming");

  db.closeDb();

  const jobs = inflight.listJobs({ kind: "node", sessionId: "s_1" });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].requestId, "req_persist");
  assert.equal(jobs[0].prompt, "persist me");
  assert.equal(jobs[0].phase, "streaming");
  assert.equal(jobs[0].meta.sessionId, "s_1");
  assert.equal(jobs[0].meta.parentNodeId, "n_parent");
  assert.equal(jobs[0].meta.clientNodeId, "nc_1");
});

test("stale inflight jobs are purged by ttl", () => {
  inflight.startJob({
    requestId: "req_stale",
    kind: "classic",
    prompt: "stale",
    meta: {},
  });

  inflight.purgeStaleJobs(Date.now() + 20 * 60 * 1000);

  assert.equal(inflight.listJobs({ kind: "classic" }).length, 0);
});

test("migration records schema version 4", () => {
  const row = db
    .getDb()
    .prepare("SELECT value FROM _meta WHERE key = 'schema_version'")
    .get();
  assert.equal(row.value, "4");
});
