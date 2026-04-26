// Phase 2.4 contract: inflight registry survives a process restart so the
// UI can reconcile a requestId after the user navigates back. Simulating
// "restart" by closing and re-opening the SQLite handle is sufficient
// because that is exactly what happens on the next process boot — the
// rows persist, only the in-memory db handle is fresh.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "ima2-inflight-persist-"));
process.env.IMA2_DB_PATH = join(tmpDir, "sessions.db");
process.env.IMA2_INFLIGHT_TTL_MS = String(60 * 60 * 1000); // 1h, well above test timing

const { startJob, setJobPhase, listJobs, getJob, purgeStaleJobs, _resetForTests } =
  await import("../lib/inflight.js");
const { closeDb } = await import("../lib/db.js");

describe("inflight persistence across simulated restart", () => {
  before(() => _resetForTests());

  after(() => {
    closeDb();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("startJob writes a row that survives a closeDb()/reopen cycle", () => {
    startJob({
      requestId: "r_persist_1",
      kind: "classic",
      prompt: "hi there",
      meta: { sessionId: "s_abc", parentNodeId: "n_xyz" },
      maxAttempts: 3,
      owner: "ree9622",
    });
    setJobPhase("r_persist_1", "streaming");
    assert.equal(listJobs().length, 1);

    closeDb(); // simulate process exit

    const job = getJob("r_persist_1"); // reopens db lazily
    assert.ok(job, "job should be readable after restart");
    assert.equal(job.kind, "classic");
    assert.equal(job.phase, "streaming");
    assert.equal(job.maxAttempts, 3);
    assert.equal(job.owner, "ree9622");
    assert.equal(job.meta.sessionId, "s_abc");
    assert.equal(job.meta.parentNodeId, "n_xyz");
  });

  it("listJobs filter by sessionId/owner uses indexed columns and returns the same row", () => {
    const bySession = listJobs({ sessionId: "s_abc" });
    assert.equal(bySession.length, 1);
    assert.equal(bySession[0].requestId, "r_persist_1");

    const byOwner = listJobs({ owner: "ree9622" });
    assert.equal(byOwner.length, 1);

    const byOther = listJobs({ owner: "someone-else" });
    assert.equal(byOther.length, 0);
  });

  it("purgeStaleJobs(now) drops rows older than the TTL", () => {
    // pretend it is 2h in the future — TTL is 1h so the row is stale
    const future = Date.now() + 2 * 60 * 60 * 1000;
    const dropped = purgeStaleJobs(future);
    assert.equal(dropped, 1);
    assert.equal(listJobs().length, 0);
  });

  it("purgeStaleJobs is a no-op when nothing is past TTL", () => {
    startJob({ requestId: "r_fresh", kind: "node", prompt: "" });
    const dropped = purgeStaleJobs();
    assert.equal(dropped, 0);
    assert.equal(listJobs().length, 1);
  });
});
