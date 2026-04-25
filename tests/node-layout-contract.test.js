import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("ui/src/lib/nodeLayout.ts", "utf-8");
const store = readFileSync("ui/src/store/useAppStore.ts", "utf-8");

describe("node layout contract", () => {
  it("uses actual child node positions instead of edge counts", () => {
    assert.match(layout, /getChildNodes/);
    assert.match(layout, /Math\.max\(\.\.\.children\.map\(\(node\) => node\.position\.y\)\)/);
    assert.match(layout, /maxY \+ NODE_Y_GAP/);
    assert.doesNotMatch(store, /siblings \* 320/);
  });

  it("routes root, child, and sibling placement through layout helpers", () => {
    assert.match(store, /position: getNextRootPosition\(get\(\)\.graphNodes\)/);
    assert.match(store, /position: getNextChildPosition\(parent, get\(\)\.graphNodes, get\(\)\.graphEdges\)/);
    assert.match(store, /import \{ getNextChildPosition, getNextRootPosition \} from "\.\.\/lib\/nodeLayout"/);
  });
});
