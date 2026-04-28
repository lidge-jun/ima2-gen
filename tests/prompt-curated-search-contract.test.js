import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("prompt curated search contract", () => {
  it("registers curated source, search, and refresh routes without replacing commit", () => {
    const route = readSource("routes/promptImport.js");
    assert.match(route, /\/api\/prompts\/import\/curated-sources/);
    assert.match(route, /\/api\/prompts\/import\/curated-search/);
    assert.match(route, /\/api\/prompts\/import\/curated-refresh/);
    assert.match(route, /\/api\/prompts\/import\/commit/);
  });

  it("keeps indexed candidates commit-compatible and avoids auto-import", () => {
    const index = readSource("lib/promptImport/promptIndex.js");
    const api = readSource("ui/src/lib/api.ts");
    const dialog = readSource("ui/src/components/PromptImportDialog.tsx");

    assert.match(index, /text: candidate\.text/);
    assert.match(index, /contentHash/);
    assert.doesNotMatch(index, /blobSha/);
    assert.match(api, /export type PromptIndexedCandidate = PromptImportCandidate/);
    assert.match(dialog, /commitPromptImport\(\{ candidates: picked \}\)/);
    const searchBody = dialog.slice(dialog.indexOf("const searchCurated"), dialog.indexOf("const refreshSource"));
    assert.match(searchBody, /searchPromptImportCurated/);
    assert.doesNotMatch(searchBody, /commitPromptImport/);
  });

  it("persists attribution through tags and uses a file cache instead of DB migration", () => {
    const index = readSource("lib/promptImport/promptIndex.js");
    const config = readSource("config.js");
    assert.match(index, /attribution-required/);
    assert.match(index, /license:\$\{source\.licenseSpdx\}/);
    assert.match(index, /writeFile\(tmp/);
    assert.match(index, /rename\(tmp, file\)/);
    assert.match(config, /promptImportIndexCacheFile/);
    assert.match(config, /prompt-import-index\.json/);
  });
});
