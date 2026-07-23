import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { graphHasCycle, wouldCreateCycle } from "../ui/src/lib/nodeGraph.ts";
import { findCycleNodeIds } from "../ui/src/lib/nodeBatch.ts";
import { isValidFlowConnection } from "../ui/src/lib/nodeConnectionValidation.ts";
import type { GraphEdge, GraphNode, ImageNodeData } from "../ui/src/store/storeTypes.ts";
import type { ClientNodeId } from "../ui/src/lib/graph.ts";

const chainEdges = [
  { source: "a", target: "b" },
  { source: "b", target: "c" },
];

function imageData(id: string): ImageNodeData {
  return {
    clientId: id as ClientNodeId,
    serverNodeId: null,
    parentServerNodeId: null,
    prompt: "",
    imageUrl: null,
    status: "empty",
    pendingRequestId: null,
    pendingPhase: null,
  };
}

function imageNode(id: string, x = 0): GraphNode {
  return { id, type: "imageNode", position: { x, y: 0 }, data: imageData(id) };
}

function flowEdge(id: string, source: string, target: string): GraphEdge {
  return { id, source, target, sourceHandle: "source-right", targetHandle: "target-left" };
}

describe("node graph cycle contracts", () => {
  it("CY-01a rejects closing a 3-node chain into a cycle", () =>
    assert.equal(wouldCreateCycle(chainEdges, "c", "a"), true));
  it("CY-01b allows an unrelated connection", () =>
    assert.equal(wouldCreateCycle(chainEdges, "c", "d"), false));
  it("CY-01c rejects a self edge", () =>
    assert.equal(wouldCreateCycle([], "a", "a"), true));

  it("CY-02a graphHasCycle detects a two-node loop and passes a chain", () => {
    const nodes = [imageNode("a"), imageNode("b", 360)];
    assert.equal(graphHasCycle(nodes, [flowEdge("e1", "a", "b"), flowEdge("e2", "b", "a")]), true);
    assert.equal(graphHasCycle(nodes, [flowEdge("e1", "a", "b")]), false);
  });
  it("CY-02b validSnapshot guards snapshot commits with graphHasCycle", () => {
    const studioGraph = readFileSync("ui/src/lib/nodeStudioGraph.ts", "utf-8");
    assert.match(studioGraph, /if \(graphHasCycle\(nodes, edges\)\) return false;/);
    assert.match(studioGraph, /import \{ deriveParentServerNodeIds, graphHasCycle \} from "\.\/nodeGraph"/);
  });

  it("CY-03a reports selected nodes stuck on a cycle", () => {
    const nodes = [{ id: "a", data: {} }, { id: "b", data: {} }, { id: "free", data: {} }];
    const edges = [{ source: "a", target: "b" }, { source: "b", target: "a" }];
    assert.deepEqual(findCycleNodeIds(nodes, edges, ["a", "b", "free"]).sort(), ["a", "b"]);
  });
  it("CY-03b returns empty for acyclic selections", () => {
    const nodes = [{ id: "a", data: {} }, { id: "b", data: {} }];
    assert.deepEqual(findCycleNodeIds(nodes, [{ source: "a", target: "b" }], ["a", "b"]), []);
  });

  it("CY-04 wires the cycle guard into connectNodesImpl before edge creation", () => {
    const store = readFileSync("ui/src/store/storeGraphNodeImpl.ts", "utf-8");
    assert.match(store, /wouldCreateCycle\(get\(\)\.graphEdges, sourceClientId, targetClientId\)/);
    assert.match(store, /t\("edge\.cycleBlocked"\)/);
    const batchStore = readFileSync("ui/src/store/storeNodeGenImpl.ts", "utf-8");
    assert.match(batchStore, /findCycleNodeIds\(get\(\)\.graphNodes, get\(\)\.graphEdges, selectedIds\)/);
    assert.match(batchStore, /t\("nodeBatch\.cycleBlocked", \{ count: cycleIds\.length \}\)/);
  });

  it("CY-05a isValidConnection rejects a drag that would close a cycle", () => {
    const nodes = [imageNode("a"), imageNode("b", 360)];
    const edges = [flowEdge("e1", "a", "b")];
    const connection = { source: "b", target: "a", sourceHandle: "source-right", targetHandle: "target-left" };
    assert.equal(isValidFlowConnection(connection, nodes, edges), false);
  });
  it("CY-05b isValidConnection accepts a valid drag", () => {
    const nodes = [imageNode("a"), imageNode("b", 360)];
    const connection = { source: "a", target: "b", sourceHandle: "source-right", targetHandle: "target-left" };
    assert.equal(isValidFlowConnection(connection, nodes, []), true);
  });
  it("CY-05c isValidConnection rejects unresolvable handles", () => {
    const nodes = [imageNode("a"), imageNode("b", 360)];
    const connection = { source: "a", target: "b", sourceHandle: "bogus", targetHandle: "target-left" };
    assert.equal(isValidFlowConnection(connection, nodes, []), false);
  });

  it("CY-06 canvas wires isValidConnection into ReactFlow", () => {
    const canvas = readFileSync("ui/src/components/NodeCanvas.tsx", "utf-8");
    assert.match(canvas, /isValidConnection=\{studio\.isValidConnection\}/);
  });

  it("CY-07 i18n carries the cycle keys in both locales", () => {
    for (const locale of ["en", "ko"]) {
      const dict = JSON.parse(readFileSync(`ui/src/i18n/${locale}.json`, "utf-8"));
      assert.equal(typeof dict.edge.cycleBlocked, "string");
      assert.equal(typeof dict.nodeBatch.cycleBlocked, "string");
      assert.equal(typeof dict.nodeStudio.compatibility.cycle, "string");
    }
  });
});
