import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("direct mode visual contract", () => {
  it("marks direct mode on the prompt composer without overriding multimode", () => {
    const composer = readSource("ui/src/components/PromptComposer.tsx");

    assert.match(composer, /const isDirectMode = promptMode === "direct"/);
    assert.match(composer, /isDirectMode && !multimode \? " composer--direct" : ""/);
    assert.match(composer, /multimode \? " composer--multimode" : ""/);
    assert.match(composer, /className="composer__direct-badge"/);
    assert.match(composer, /t\("prompt\.directModeActive"\)/);
    assert.match(composer, /aria-pressed=\{isDirectMode\}/);
  });

  it("styles direct mode separately from the multimode composer state", () => {
    const css = readSource("ui/src/index.css");

    assert.match(css, /\.composer--direct\s*\{/);
    assert.match(css, /\.composer__direct-badge\s*\{/);
    assert.match(css, /\.composer--multimode\s*\{/);
    assert.match(css, /\.composer__mode-badge\s*\{/);
    assert.match(css, /\.composer__tool--on\s*\{/);
  });

  it("defines short direct mode active copy in both locales", () => {
    const en = readSource("ui/src/i18n/en.json");
    const ko = readSource("ui/src/i18n/ko.json");

    assert.match(en, /"directModeActive":\s*"1:1 Direct on"/);
    assert.match(ko, /"directModeActive":\s*"1:1 Direct 켜짐"/);
  });
});
