import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  GRAPH_HISTORY_LIMIT,
  makeSnapshot,
  mergeAfterRestore,
  popRedo,
  popUndo,
  pushHistory,
  type GraphSnapshotEntry,
} from "../ui/src/lib/nodeHistory.ts";
import type { GraphNode, ImageNodeData } from "../ui/src/store/storeTypes.ts";
import type { ClientNodeId } from "../ui/src/lib/graph.ts";

function imageData(id: string, extra: Partial<ImageNodeData> = {}): ImageNodeData {
  return {
    clientId: id as ClientNodeId,
    serverNodeId: null,
    parentServerNodeId: null,
    prompt: "",
    imageUrl: null,
    status: "empty",
    pendingRequestId: null,
    pendingPhase: null,
    ...extra,
  };
}

function node(id: string, extra: Partial<ImageNodeData> = {}): GraphNode {
  return { id, type: "imageNode", position: { x: 0, y: 0 }, data: imageData(id, extra) };
}

describe("node graph history contracts", () => {
  it("GH-01 bounds the past stack at the limit", () => {
    let past: GraphSnapshotEntry[] = [];
    for (let i = 0; i < GRAPH_HISTORY_LIMIT + 1; i++) {
      past = pushHistory(past, makeSnapshot([node(`n${i}`)], [], `step-${i}`));
    }
    assert.equal(past.length, GRAPH_HISTORY_LIMIT);
    assert.equal(past[0].label, "step-1");
  });

  it("GH-02 undo then redo round-trips the graph", () => {
    const original = makeSnapshot([node("a")], [], "original");
    const past = pushHistory([], original);
    const current = makeSnapshot([node("a"), node("b")], [], "current");
    const undone = popUndo(past, current, []);
    assert.ok(undone);
    assert.equal(undone.restored.nodes.length, 1);
    const redone = popRedo(undone.past, undone.restored, undone.future);
    assert.ok(redone);
    assert.equal(redone.restored.nodes.length, 2);
    assert.deepEqual(redone.restored.nodes.map((n) => n.id).sort(), ["a", "b"]);
  });

  it("GH-03 a new record clears redo via the store wiring", () => {
    const store = readFileSync("ui/src/store/useAppStore.ts", "utf-8");
    assert.match(store, /graphHistoryPast: pushHistory\(s\.graphHistoryPast, makeSnapshot\(s\.graphNodes, s\.graphEdges, label\)\),\s*graphHistoryFuture: \[\]/);
  });

  it("GH-04 restore keeps live pending fields for busy nodes", () => {
    const snapshot = {
      nodes: [node("a", { status: "empty" })],
      edges: [],
    };
    const live = [node("a", { status: "pending", pendingRequestId: "req1", pendingPhase: "queued" })];
    const merged = mergeAfterRestore(snapshot, live);
    assert.equal(merged.nodes[0].data.status, "pending");
    assert.equal(merged.nodes[0].data.pendingRequestId, "req1");
  });

  it("GH-05 session transitions clear both history stacks", () => {
    const sessions = readFileSync("ui/src/store/storeSessionImpl.ts", "utf-8");
    const clears = sessions.match(/graphHistoryPast: \[\],\s*graphHistoryFuture: \[\]/g) ?? [];
    assert.ok(clears.length >= 2, `expected clears in switch and create paths, saw ${clears.length}`);
  });

  it("GH-06 every structural mutation records history", () => {
    const impl = readFileSync("ui/src/store/storeGraphNodeImpl.ts", "utf-8");
    for (const label of [
      "add-root",
      "add-root-from-history",
      "add-child",
      "add-sibling",
      "add-child-at",
      "duplicate-branch",
      "delete-node",
      "delete-nodes",
      "disconnect-edges",
      "connect-nodes",
    ]) {
      assert.match(impl, new RegExp(`recordGraphHistory\\("${label}"\\)`), `missing record for ${label}`);
    }
  });

  it("GH-07 rejected snapshot commits leave history untouched", () => {
    const studio = readFileSync("ui/src/lib/nodeStudioGraph.ts", "utf-8");
    const guardIndex = studio.indexOf("if (!validSnapshot(input.nodes, input.edges)) return false;");
    const recordIndex = studio.indexOf('recordGraphHistory(`commit-${input.reason}`)');
    assert.ok(guardIndex >= 0 && recordIndex >= 0);
    assert.ok(guardIndex < recordIndex, "history must record only after validSnapshot accepts");
  });

  it("GH-08 snapshots are identity-isolated from live state", () => {
    const live = [node("a", {
      referenceImages: ["data:one"],
      video: { duration: 5 },
      errorInfo: { message: "x", code: "UNKNOWN", retryable: true, action: "retry", occurredAt: 1 },
    })];
    const snap = makeSnapshot(live, [], "iso");
    live[0].data.referenceImages!.push("data:two");
    (live[0].data.video as { duration?: number }).duration = 9;
    live[0].data.errorInfo!.message = "mutated";
    assert.deepEqual(snap.nodes[0].data.referenceImages, ["data:one"]);
    assert.equal((snap.nodes[0].data.video as { duration?: number }).duration, 5);
    assert.equal(snap.nodes[0].data.errorInfo!.message, "x");
  });

  it("GH-09 async follow-ups are no-ops for undone nodes (id-targeted map)", () => {
    const impl = readFileSync("ui/src/store/storeGraphNodeImpl.ts", "utf-8");
    // Both async continuations only update via id-matched map, so a removed
    // node cannot be resurrected: assert the callbacks map over current nodes.
    const matches = impl.match(/graphNodes: get\(\)\.graphNodes\.map\(\(n\) =>\s*n\.id === clientId/g) ?? [];
    assert.ok(matches.length >= 2, `expected >=2 id-targeted async updates, saw ${matches.length}`);
  });
});
