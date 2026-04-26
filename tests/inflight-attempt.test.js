import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Inflight is now SQLite-backed (Phase 2.4); point it at a throwaway DB
// so tests do not touch the user's ~/.ima2/sessions.db.
const tmpDir = mkdtempSync(join(tmpdir(), "ima2-inflight-attempt-"));
process.env.IMA2_DB_PATH = join(tmpDir, "sessions.db");

const {
  startJob,
  setJobAttempt,
  setJobPhase,
  finishJob,
  listJobs,
  _resetForTests,
} = await import("../lib/inflight.js");
const { closeDb } = await import("../lib/db.js");

describe("inflight attempt tracking", () => {
  beforeEach(() => _resetForTests());
  after(() => {
    closeDb();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("startJob initializes attempt=1 and the requested maxAttempts", () => {
    startJob({ requestId: "r1", kind: "classic", prompt: "hello", maxAttempts: 3 });
    const [job] = listJobs();
    assert.equal(job.requestId, "r1");
    assert.equal(job.attempt, 1);
    assert.equal(job.maxAttempts, 3);
  });

  it("defaults maxAttempts to 1 when not given", () => {
    startJob({ requestId: "r2", kind: "classic", prompt: "hi" });
    const [job] = listJobs();
    assert.equal(job.maxAttempts, 1);
    assert.equal(job.attempt, 1);
  });

  it("clamps invalid maxAttempts to >= 1", () => {
    startJob({ requestId: "r3", kind: "classic", prompt: "x", maxAttempts: 0 });
    const [job] = listJobs();
    assert.equal(job.maxAttempts, 1);
  });

  it("setJobAttempt advances the attempt counter", () => {
    startJob({ requestId: "r4", kind: "classic", prompt: "x", maxAttempts: 3 });
    setJobAttempt("r4", 2);
    let [job] = listJobs();
    assert.equal(job.attempt, 2);
    setJobAttempt("r4", 3);
    [job] = listJobs();
    assert.equal(job.attempt, 3);
  });

  it("setJobAttempt cannot exceed maxAttempts", () => {
    startJob({ requestId: "r5", kind: "classic", prompt: "x", maxAttempts: 2 });
    setJobAttempt("r5", 5);
    const [job] = listJobs();
    assert.equal(job.attempt, 2);
  });

  it("setJobAttempt resets phase to queued (between-attempt grace state)", () => {
    startJob({ requestId: "r6", kind: "classic", prompt: "x", maxAttempts: 3 });
    setJobPhase("r6", "streaming");
    let [job] = listJobs();
    assert.equal(job.phase, "streaming");
    setJobAttempt("r6", 2);
    [job] = listJobs();
    assert.equal(job.phase, "queued");
  });

  it("setJobAttempt is a no-op for unknown ids", () => {
    setJobAttempt("nope", 2);
    assert.equal(listJobs().length, 0);
  });

  it("finishJob removes the entry", () => {
    startJob({ requestId: "r7", kind: "classic", prompt: "x", maxAttempts: 2 });
    assert.equal(listJobs().length, 1);
    finishJob("r7");
    assert.equal(listJobs().length, 0);
  });

  it("listJobs filters by kind", () => {
    startJob({ requestId: "a", kind: "classic", prompt: "x" });
    startJob({ requestId: "b", kind: "node", prompt: "y" });
    assert.equal(listJobs({ kind: "classic" }).length, 1);
    assert.equal(listJobs({ kind: "node" }).length, 1);
  });
});
