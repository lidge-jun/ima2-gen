import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  _resetForTests,
  finishJob,
  listJobs,
  listTerminalJobs,
  setJobPhase,
  startJob,
} from "../lib/inflight.js";

beforeEach(() => {
  _resetForTests();
});

test("finishJob moves active jobs into terminal history without polluting active list", () => {
  startJob({
    requestId: "req_active",
    kind: "node",
    prompt: "private prompt",
    meta: { sessionId: "s_1", clientNodeId: "nc_1" },
  });
  setJobPhase("req_active", "streaming");

  assert.equal(listJobs({ kind: "node", sessionId: "s_1" }).length, 1);
  finishJob("req_active", {
    status: "completed",
    httpStatus: 200,
    meta: { nodeId: "n_1" },
  });

  assert.equal(listJobs({ kind: "node", sessionId: "s_1" }).length, 0);
  const terminal = listTerminalJobs({ kind: "node", sessionId: "s_1" });
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].requestId, "req_active");
  assert.equal(terminal[0].status, "completed");
  assert.equal(terminal[0].httpStatus, 200);
  assert.equal(terminal[0].meta.nodeId, "n_1");
  assert.equal(terminal[0].prompt, undefined);
});

test("finishJob records canceled status for explicit cancellation", () => {
  startJob({
    requestId: "req_cancel",
    kind: "classic",
    prompt: "private prompt",
    meta: {},
  });
  finishJob("req_cancel", { canceled: true });

  const terminal = listTerminalJobs({ kind: "classic" });
  assert.equal(terminal.length, 1);
  assert.equal(terminal[0].status, "canceled");
});
