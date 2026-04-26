import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = readFileSync("ui/src/store/useAppStore.ts", "utf-8");
const api = readFileSync("ui/src/lib/nodeApi.ts", "utf-8");
const refs = readFileSync("ui/src/lib/nodeRefStorage.ts", "utf-8");

describe("node child reference payload contract", () => {
  it("sends node references even when parentNodeId is present", () => {
    assert.match(store, /parentNodeId: effectiveParentServerNodeId/);
    assert.match(store, /\.\.\(nodeRefs\.length\s*\?\s*\{ references: nodeRefs\.map\(stripDataUrlPrefix\) \}/);
    assert.doesNotMatch(store, /nodeRefs\.length && !effectiveParentServerNodeId/);
  });

  it("declares explicit node context and search policy on node requests", () => {
    assert.match(api, /contextMode\?: "parent-plus-refs" \| "parent-only" \| "ancestry"/);
    assert.match(api, /searchMode\?: "off" \| "auto" \| "on"/);
    assert.match(store, /contextMode: "parent-plus-refs"/);
    assert.match(store, /searchMode: "off"/);
  });

  it("persists node-local refs outside sanitized graph payload", () => {
    assert.match(refs, /STORAGE_KEY = "ima2\.nodeRefs\.v1"/);
    assert.match(store, /loadNodeRefs\(session\.id, n\.id\)/);
    assert.match(store, /saveNodeRefs\(sessionId, clientId, refs\)/);
  });
});
