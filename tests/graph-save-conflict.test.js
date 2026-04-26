// sessionStore.saveGraph optimistic-locking contract.
// Phase 1.4 (upstream c301a2b): two concurrent tabs must not silently
// overwrite each other — the second saver must see GRAPH_VERSION_CONFLICT
// with currentVersion attached so the client can reload the fresh graph.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tmpDir = mkdtempSync(join(tmpdir(), "ima2-graph-test-"));
process.env.IMA2_DB_PATH = join(tmpDir, "sessions.db");

const { createSession, saveGraph, getSession } = await import("../lib/sessionStore.js");
const { closeDb } = await import("../lib/db.js");

describe("sessionStore.saveGraph optimistic locking", () => {
  let session;

  before(() => {
    session = createSession({ title: "conflict-test", owner: "test-user" });
    assert.equal(session.graphVersion, 0);
  });

  after(() => {
    closeDb();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  it("first save with expectedVersion=0 succeeds and bumps to 1", () => {
    const result = saveGraph(session.id, {
      nodes: [{ id: "n1", x: 0, y: 0 }],
      edges: [],
      expectedVersion: 0,
    });
    assert.equal(result.ok, true);
    assert.equal(result.graphVersion, 1);
  });

  it("second save with stale expectedVersion=0 throws GRAPH_VERSION_CONFLICT (409) carrying currentVersion=1", () => {
    let caught = null;
    try {
      saveGraph(session.id, {
        nodes: [{ id: "n2", x: 10, y: 10 }],
        edges: [],
        expectedVersion: 0,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "stale save should throw");
    assert.equal(caught.code, "GRAPH_VERSION_CONFLICT");
    assert.equal(caught.status, 409);
    assert.equal(caught.currentVersion, 1);
  });

  it("rebased save with the new expectedVersion=1 succeeds and bumps to 2", () => {
    const result = saveGraph(session.id, {
      nodes: [{ id: "n2", x: 10, y: 10 }],
      edges: [],
      expectedVersion: 1,
    });
    assert.equal(result.graphVersion, 2);

    const reloaded = getSession(session.id, "test-user");
    assert.equal(reloaded.graphVersion, 2);
    assert.equal(reloaded.nodes.length, 1);
    assert.equal(reloaded.nodes[0].id, "n2");
  });

  it("save with expectedVersion=null skips the conflict check (force-overwrite)", () => {
    const result = saveGraph(session.id, {
      nodes: [],
      edges: [],
      expectedVersion: null,
    });
    assert.equal(result.graphVersion, 3);
  });

  it("save against an unknown sessionId throws SESSION_NOT_FOUND (404)", () => {
    let caught = null;
    try {
      saveGraph("s_nonexistent", { nodes: [], edges: [], expectedVersion: 0 });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.equal(caught.code, "SESSION_NOT_FOUND");
    assert.equal(caught.status, 404);
  });

  it("dangling edges (referencing missing nodes) are dropped during save", () => {
    const result = saveGraph(session.id, {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "ghost" },
      ],
      expectedVersion: 3,
    });
    assert.equal(result.graphVersion, 4);

    const reloaded = getSession(session.id, "test-user");
    assert.equal(reloaded.edges.length, 1);
    assert.equal(reloaded.edges[0].id, "e1");
  });
});
