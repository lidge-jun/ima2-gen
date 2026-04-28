import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("prompt import dialog UI contract", () => {
  it("opens a dialog-first import flow instead of directly opening Finder", () => {
    const panel = readSource("ui/src/components/PromptLibraryPanel.tsx");
    const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
    const api = readSource("ui/src/lib/api.ts");
    const css = readSource("ui/src/index.css");

    assert.match(panel, /PromptImportDialog/);
    assert.match(panel, /setImportOpen\(true\)/);
    assert.doesNotMatch(panel, /fileInputRef\.current\?\.click\(\)/);

    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /window\.addEventListener\("drop"/);
    assert.match(dialog, /accept="\.txt,\.md,\.markdown,text\/plain,text\/markdown"/);
    assert.match(dialog, /previewPromptImport/);
    assert.match(dialog, /commitPromptImport/);
    assert.match(dialog, /owner\/repo:path\/to\/prompts\.md/);

    assert.match(api, /\/api\/prompts\/import\/preview/);
    assert.match(api, /\/api\/prompts\/import\/commit/);
    assert.match(css, /\.prompt-import-dialog__dropzone/);
    assert.match(css, /\.prompt-import-dialog__candidate/);
  });

  it("updates local import extension support and translated copy", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));

    assert.match(store, /txt\|md\|markdown/);
    for (const dict of [en, ko]) {
      assert.equal(typeof dict.promptLibrary.importTitle, "string");
      assert.equal(typeof dict.promptLibrary.importDropTitle, "string");
      assert.equal(typeof dict.promptLibrary.importGithubLabel, "string");
      assert.equal(typeof dict.promptLibrary.importPreview, "string");
      assert.equal(typeof dict.promptLibrary.importCommit, "string");
      assert.match(dict.promptLibrary.importFiles, /\.markdown/);
      assert.match(dict.promptLibrary.importNoValidFiles, /\.markdown/);
    }
  });
});
