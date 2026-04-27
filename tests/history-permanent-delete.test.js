import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("history permanent delete contract", () => {
  it("adds a permanent delete route without changing trash semantics", () => {
    const routes = readSource("routes/history.js");
    const permanentIndex = routes.indexOf('app.delete("/api/history/:filename/permanent"');
    const trashIndex = routes.indexOf('app.delete("/api/history/:filename"');

    assert.ok(permanentIndex >= 0, "permanent delete route missing");
    assert.ok(trashIndex >= 0, "trash delete route missing");
    assert.ok(permanentIndex < trashIndex, "permanent route should be registered before generic trash route");
    assert.match(routes, /deleteAssetPermanent\(ctx\.rootDir,\s*filename\)/);
    assert.match(routes, /res\.status\(err\.status \|\| 500\)\.json\(\{ error: err\.message, code: err\.code \}\)/);
  });

  it("permanent delete helper preserves path safety, 404 codes, sidecar cleanup, and node marking", () => {
    const lifecycle = readSource("lib/assetLifecycle.js");
    const fn = /export async function deleteAssetPermanent[\s\S]*?(?=\nexport async function )/.exec(lifecycle)?.[0] ?? "";

    assert.match(fn, /resolveInGenerated\(rootDir,\s*filename\)/);
    assert.match(fn, /await access\(src\)/);
    assert.match(fn, /err\.status = 404/);
    assert.match(fn, /err\.code = "ASSET_NOT_FOUND"/);
    assert.match(fn, /await unlink\(src\)/);
    assert.match(fn, /await unlink\(src \+ "\.json"\)\.catch/);
    assert.match(fn, /markNodesAssetMissing\(filename\)/);
    assert.match(fn, /sessionsTouched/);
    assert.match(fn, /nodesTouched/);
  });

  it("client API exposes permanent delete separately from trash delete", () => {
    const api = readSource("ui/src/lib/api.ts");

    assert.match(api, /export function deleteHistoryItem/);
    assert.match(api, /export function permanentlyDeleteHistoryItem/);
    assert.match(api, /`\/api\/history\/\$\{encodeURIComponent\(filename\)\}\/permanent`/);
    assert.match(api, /method:\s*"DELETE"/);
  });
});
