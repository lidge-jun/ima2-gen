import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("canvas selection contract", () => {
  it("keeps multi-select and delete scoped to canvas annotations", () => {
    const hook = readSource("ui/src/hooks/useCanvasAnnotations.ts");
    const canvas = readSource("ui/src/components/Canvas.tsx");
    assert.match(hook, /selectedIds/);
    assert.match(hook, /selectOne/);
    assert.match(hook, /toggleSelected/);
    assert.match(hook, /deleteSelected/);
    assert.match(hook, /moveSelected/);
    assert.match(hook, /objectKeyMatches/);
    assert.match(hook, /parseCanvasObjectKey/);
    assert.match(canvas, /activeTool === "select"/);
    assert.match(canvas, /hitTestAnnotation/);
    assert.match(canvas, /findAnnotationsInBox/);
    assert.doesNotMatch(hook, /trashHistoryItem/);
    assert.doesNotMatch(hook, /deleteHistory/);
  });
});
