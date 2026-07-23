import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { collectDownstream } from "../ui/src/lib/nodeBatch.ts";

const store = readFileSync("ui/src/store/storeNodeGenImpl.ts", "utf-8");

describe("node batch partial-failure contracts", () => {
  it("BP-01a collectDownstream covers chains", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    assert.deepEqual(collectDownstream(edges, "a").sort(), ["b", "c"]);
  });
  it("BP-01b collectDownstream covers diamonds without duplicates", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d" },
    ];
    assert.deepEqual(collectDownstream(edges, "a").sort(), ["b", "c", "d"]);
    assert.deepEqual(collectDownstream(edges, "d"), []);
  });

  it("BP-02 batch continues past failures and skips only failed downstream", () => {
    assert.match(store, /failedCount \+= 1;/);
    assert.match(store, /for \(const id of collectDownstream\(get\(\)\.graphEdges, candidateId\)\) skipIds\.add\(id\);/);
    assert.match(store, /continue;\s*\/\/ 독립 후보는 계속|continue;\s*\n/);
    assert.doesNotMatch(store, /nodeBatch\.failed.*\n.*break/);
    assert.match(store, /if \(skipIds\.has\(candidateId\)\) \{\s*skippedCount \+= 1;\s*continue;/);
    assert.match(store, /if \(get\(\)\.nodeBatchStopping\) break;/);
  });

  it("BP-03 terminal toast separates done, failed, and skipped counts", () => {
    assert.match(store, /t\("nodeBatch\.partialFinished", \{\s*done: completed,\s*failed: failedCount,\s*skipped: skippedCount,\s*total: candidates\.length,?\s*\}\)/);
    assert.match(store, /failedCount > 0/);
  });

  it("BP-04 fresh parent ids propagate to selected direct children for the video path", () => {
    assert.match(store, /selectedDirectChildren/);
    assert.match(store, /selectedSet\.has\(e\.target\)/);
    assert.match(store, /selectedDirectChildren\.includes\(n\.id\)/);
  });
});
