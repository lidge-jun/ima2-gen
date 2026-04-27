import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readSource(path) {
  return readFileSync(join(root, path), "utf8");
}

function countTopLevelKey(source, key) {
  const pattern = new RegExp(`^  "${key}":`, "gm");
  return [...source.matchAll(pattern)].length;
}

describe("prompt library UI contract", () => {
  it("keeps gallery i18n keys merged into one section", () => {
    const en = readSource("ui/src/i18n/en.json");
    const ko = readSource("ui/src/i18n/ko.json");
    const enJson = JSON.parse(en);
    const koJson = JSON.parse(ko);

    assert.equal(countTopLevelKey(en, "gallery"), 1);
    assert.equal(countTopLevelKey(ko, "gallery"), 1);
    assert.equal(enJson.gallery.sortByDate, "Date");
    assert.equal(enJson.gallery.sortBySession, "Session");
    assert.equal(enJson.gallery.favoriteTitle, "Add to favorites");
    assert.equal(koJson.gallery.sortByDate, "날짜");
    assert.equal(koJson.gallery.sortBySession, "세션");
    assert.equal(koJson.gallery.favoriteTitle, "즐겨찾기 추가");
  });

  it("supports prompt import through file picker and drag-drop with translated UI", () => {
    const panel = readSource("ui/src/components/PromptLibraryPanel.tsx");
    const store = readSource("ui/src/store/useAppStore.ts");
    const css = readSource("ui/src/index.css");
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));

    assert.match(panel, /className="prompt-library-panel__import"/);
    assert.match(panel, /fileInputRef\.current\?\.click\(\)/);
    assert.match(panel, /accept="\.txt,\.md,text\/plain,text\/markdown"/);
    assert.match(panel, /onDrop=\{handleDrop\}/);
    assert.match(panel, /t\("promptLibrary\.dropImport"\)/);
    assert.doesNotMatch(panel, /Drop \.txt or \.md files to import prompts/);

    assert.match(store, /\\\.\(txt\|md\)\$/);
    assert.match(store, /t\("promptLibrary\.imported"/);
    assert.match(store, /t\("promptLibrary\.importFailed"\)/);
    assert.match(store, /t\("promptLibrary\.importNoValidFiles"\)/);
    assert.doesNotMatch(store, /Imported \$\{result\.promptsImported\}/);

    assert.match(css, /\.prompt-library-panel__import/);
    assert.match(css, /\.prompt-library-panel__file-input/);

    for (const dict of [en, ko]) {
      assert.equal(typeof dict.promptLibrary.saved, "string");
      assert.equal(typeof dict.promptLibrary.saveFailed, "string");
      assert.equal(typeof dict.promptLibrary.import, "string");
      assert.equal(typeof dict.promptLibrary.importFiles, "string");
      assert.equal(typeof dict.promptLibrary.dropImport, "string");
      assert.equal(typeof dict.promptLibrary.imported, "string");
      assert.equal(typeof dict.promptLibrary.importFailed, "string");
      assert.equal(typeof dict.promptLibrary.importNoValidFiles, "string");
    }
  });

  it("preserves gallery favorite state from history payloads", () => {
    const store = readSource("ui/src/store/useAppStore.ts");
    const gallery = readSource("ui/src/components/GalleryModal.tsx");
    const tile = readSource("ui/src/components/GalleryImageTile.tsx");

    assert.match(store, /isFavorite:\s*it\.isFavorite \?\? false/);
    assert.match(gallery, /isFavorite:\s*h\.isFavorite \?\? false/);
    assert.match(tile, /item\.isFavorite/);
  });

  it("keeps prompt library primary button text readable across themes", () => {
    const css = readSource("ui/src/index.css");
    const saveButton = /\.save-prompt-popover__save\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";
    const loadButton = /\.prompt-detail-modal__load\s*\{[^}]*\}/s.exec(css)?.[0] ?? "";

    assert.match(saveButton, /background:\s*var\(--accent\)/);
    assert.match(saveButton, /color:\s*var\(--accent-ink\)/);
    assert.match(loadButton, /background:\s*var\(--accent\)/);
    assert.match(loadButton, /color:\s*var\(--accent-ink\)/);
  });

  it("offers prompt insertion from both the list row and detail modal", () => {
    const panel = readSource("ui/src/components/PromptLibraryPanel.tsx");
    const row = readSource("ui/src/components/PromptLibraryRow.tsx");
    const modal = readSource("ui/src/components/PromptDetailModal.tsx");
    const composer = readSource("ui/src/components/PromptComposer.tsx");
    const store = readSource("ui/src/store/useAppStore.ts");
    const css = readSource("ui/src/index.css");
    const en = JSON.parse(readSource("ui/src/i18n/en.json"));
    const ko = JSON.parse(readSource("ui/src/i18n/ko.json"));

    assert.match(store, /type InsertedPrompt/);
    assert.match(store, /insertedPrompts: InsertedPrompt\[\]/);
    assert.match(store, /function composePrompt\(mainPrompt: string, insertedPrompts: InsertedPrompt\[\]\): string/);
    assert.match(store, /const prompt = composePrompt\(s\.prompt, s\.insertedPrompts\)/);

    assert.match(panel, /insertPromptToComposer/);
    assert.match(panel, /const insertPrompt = useCallback/);
    assert.match(panel, /showToast\(t\("promptLibrary\.inserted"\)\)/);
    assert.match(panel, /onInsert=\{\(\) => insertPrompt\(prompt\)\}/);

    assert.match(row, /onInsert: \(\) => void/);
    assert.match(row, /className="prompt-library-row__insert"/);
    assert.match(row, /aria-label=\{t\("promptLibrary\.insert"\)\}/);
    assert.match(row, /onInsert\(\)/);

    assert.match(modal, /onInsert: \(\) => void/);
    assert.match(modal, /className="prompt-detail-modal__insert"/);
    assert.match(modal, /t\("promptLibrary\.insert"\)/);

    assert.match(composer, /insertedPrompts = useAppStore/);
    assert.match(composer, /className="composer__prompt-chip"/);
    assert.match(composer, /className="composer__prompt-chip-title"/);
    assert.match(composer, /removeInsertedPrompt\(item\.id\)/);

    assert.match(css, /\.prompt-library-row__insert/);
    assert.match(css, /\.prompt-detail-modal__insert/);
    assert.match(css, /\.composer__prompt-chip-title[\s\S]*text-overflow:\s*ellipsis/);
    assert.match(css, /\.composer__prompt-chip-title[\s\S]*white-space:\s*nowrap/);

    assert.equal(en.promptLibrary.insert, "Insert");
    assert.equal(typeof en.promptLibrary.inserted, "string");
    assert.equal(typeof en.promptLibrary.removeInserted, "string");
    assert.equal(ko.promptLibrary.insert, "삽입");
    assert.equal(typeof ko.promptLibrary.inserted, "string");
    assert.equal(typeof ko.promptLibrary.removeInserted, "string");
  });
});
