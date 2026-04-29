import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

describe("prompt import search UX contract", () => {
  it("splits search results and candidate preview into dedicated components", () => {
    const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
    const results = readSource("ui/src/components/PromptImportSearchResults.tsx");
    const preview = readSource("ui/src/components/PromptImportCandidatePreview.tsx");

    assert.match(dialog, /PromptImportSearchResults/);
    assert.match(dialog, /PromptImportCandidatePreview/);
    assert.match(dialog, /activeCandidateId/);
    assert.match(dialog, /setActiveCandidateId/);
    assert.doesNotMatch(dialog, /candidates\.map\(\(candidate\) =>/);

    assert.match(results, /prompt-import-dialog__results/);
    assert.match(results, /prompt-import-dialog__result-card/);
    assert.match(results, /promptLibrary\.previewPrompt/);
    assert.match(results, /promptLibrary\.selectPrompt/);
    assert.match(results, /promptLibrary\.selectedPrompt/);
    assert.match(results, /promptLibrary\.importThisPrompt/);
    assert.match(results, /onSelectCandidate\(candidate\)/);
    assert.match(results, /onToggleSelected\(candidate\.id/);
    assert.match(results, /onImportOne\(candidate\)/);

    assert.match(preview, /prompt-import-dialog__candidate-preview/);
    assert.match(preview, /candidate\.text/);
    assert.match(preview, /candidate\.tags/);
    assert.match(preview, /candidate\.warnings/);
    assert.match(preview, /candidate\.source/);
    assert.match(preview, /promptLibrary\.sourceDetails/);
    assert.match(preview, /promptLibrary\.compatibilityWarnings/);
  });

  it("keeps import as an explicit user action", () => {
    const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
    const results = readSource("ui/src/components/PromptImportSearchResults.tsx");

    const commitIndex = dialog.indexOf("const commitCandidates");
    const importOneIndex = dialog.indexOf("const importOneCandidate");
    assert.ok(commitIndex >= 0);
    assert.ok(importOneIndex > commitIndex);

    assert.match(dialog, /commitPromptImport\(\{\s*candidates: picked\s*\}\)/);
    assert.match(dialog, /await onImported\(\)/);
    assert.match(dialog, /showToast\(t\("promptLibrary\.imported"/);
    assert.match(dialog, /onClose\(\)/);
    assert.match(dialog, /finally\s*\{\s*setBusy\(false\)/);
    assert.match(dialog, /t\("promptLibrary\.importSelected"/);

    assert.doesNotMatch(results, /commitPromptImport/);
    assert.match(results, /onImportOne/);
  });

  it("adds bounded layout and translated action copy", () => {
    const css = readSource("ui/src/index.css");
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));

    assert.match(css, /width:\s*min\(920px,\s*calc\(100vw - 24px\)\)/);
    assert.match(css, /\.prompt-import-dialog__workspace/);
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s*minmax\(280px,\s*0\.95fr\)/);
    assert.match(css, /\.prompt-import-dialog__results,\s*\n\.prompt-import-dialog__candidate-preview/);
    assert.match(css, /max-height:\s*min\(44vh,\s*520px\)/);
    assert.match(css, /overflow-y:\s*auto/);

    for (const dict of [en, ko]) {
      assert.equal(typeof dict.promptLibrary.importSelected, "string");
      assert.equal(typeof dict.promptLibrary.importThisPrompt, "string");
      assert.equal(typeof dict.promptLibrary.previewPrompt, "string");
      assert.equal(typeof dict.promptLibrary.selectPrompt, "string");
      assert.equal(typeof dict.promptLibrary.selectedPrompt, "string");
      assert.equal(typeof dict.promptLibrary.searchResults, "string");
      assert.equal(typeof dict.promptLibrary.promptText, "string");
      assert.equal(typeof dict.promptLibrary.sourceDetails, "string");
      assert.equal(typeof dict.promptLibrary.license, "string");
      assert.equal(typeof dict.promptLibrary.attributionRequired, "string");
      assert.equal(typeof dict.promptLibrary.compatibilityWarnings, "string");
    }
  });
});
