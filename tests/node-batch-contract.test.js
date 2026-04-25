import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync("ui/src/store/useAppStore.ts", "utf-8");
const canvas = readFileSync("ui/src/components/NodeCanvas.tsx", "utf-8");
const batchBar = readFileSync("ui/src/components/NodeBatchBar.tsx", "utf-8");
const selectionLib = readFileSync("ui/src/lib/nodeSelection.ts", "utf-8");
const batchLib = readFileSync("ui/src/lib/nodeBatch.ts", "utf-8");

describe("node selection batch contract", () => {
  it("uses React Flow selected nodes as the visual source of truth", () => {
    assert.match(selectionLib, /applySelectedNodeIds/);
    assert.match(selectionLib, /selected:\s*selected\.has\(n\.id\)/);
    assert.match(store, /graphNodes:\s*applyComponentSelection/);
    assert.match(canvas, /onNodeClick=\{onNodeClick\}/);
    assert.match(canvas, /multiSelectionKeyCode=\{nodeSelectionMode \? null : undefined\}/);
  });

  it("selects undirected connected components and supports additive exceptions", () => {
    assert.match(selectionLib, /neighbors\.get\(edge\.source\)\?\.add\(edge\.target\)/);
    assert.match(selectionLib, /neighbors\.get\(edge\.target\)\?\.add\(edge\.source\)/);
    assert.match(selectionLib, /componentHasSelection/);
    assert.match(selectionLib, /nextSelected\.delete\(nodeId\)/);
  });

  it("keeps batch regenerate in-place instead of using the sibling path", () => {
    assert.match(store, /runGenerateNodeInPlace/);
    assert.match(store, /requestedNode\?\.data\.status === "ready" \? get\(\)\.addSiblingNode\(clientId\) : clientId/);
    assert.match(store, /await get\(\)\.runGenerateNodeInPlace\(targetClientId/);
    assert.match(store, /n\.id !== clientId/);
  });

  it("tracks latest parent ids and marks unselected downstream stale", () => {
    assert.match(store, /latestServerNodeIdByClientId/);
    assert.match(store, /getDirectUnselectedChildren/);
    assert.match(store, /getUnselectedDownstreamIds/);
    assert.match(store, /status:\s*"stale"/);
    assert.match(store, /parentServerNodeId:\s*directChildren\.includes\(n\.id\)/);
  });

  it("blocks children whose unselected parent has no serverNodeId", () => {
    assert.match(batchLib, /validateBatchDependencies/);
    assert.match(batchLib, /!parent\?\.data\.serverNodeId/);
    assert.match(store, /nodeBatch\.parentRequired/);
  });

  it("treats stop as stopping the remaining queue only", () => {
    assert.match(store, /nodeBatchStopping/);
    assert.match(store, /nodeBatch\.stopQueued/);
    assert.match(store, /if \(get\(\)\.nodeBatchStopping\) break/);
    assert.doesNotMatch(store, /cancelInflight\(flightId\)/);
  });

  it("renders a canvas-level batch action bar", () => {
    assert.match(canvas, /<NodeBatchBar \/>/);
    assert.match(batchBar, /nodeBatch\.generateMissing/);
    assert.match(batchBar, /nodeBatch\.regenerateSelected/);
    assert.match(batchBar, /nodeBatch\.stopRemaining/);
  });
});

