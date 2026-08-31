import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const workspace = read("ui/src/components/assets/AssetsWorkspace.tsx");
const folderTree = read("ui/src/components/assets/AssetsFolderTree.tsx");
const css = read("ui/src/styles/assets-workspace.css");
const mobileCss = css.slice(css.indexOf("@media (max-width: 800px)"));
const en = JSON.parse(read("ui/src/i18n/en.json")) as Record<string, Record<string, unknown>>;
const ko = JSON.parse(read("ui/src/i18n/ko.json")) as Record<string, Record<string, unknown>>;

describe("assets workspace polish contract", () => {
  it("keeps mobile folder CRUD visible with horizontal scrolling and touch targets", () => {
    assert.doesNotMatch(mobileCss, /\.assets-folders__heading\s*\{[^}]*display:\s*none/);
    assert.doesNotMatch(mobileCss, /\.assets-folder-row__actions\s*\{[^}]*display:\s*none/);
    assert.match(mobileCss, /\.assets-folders\s*\{[^}]*overflow:\s*hidden/);
    assert.match(mobileCss, /\.assets-folders__heading button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/);
    assert.match(mobileCss, /\.assets-folders__rows\s*\{[^}]*overflow-x:\s*auto;[^}]*overscroll-behavior-inline:\s*contain/);
    assert.match(mobileCss, /\.assets-folder-all, \.assets-folder-row__name\s*\{[^}]*min-height:\s*44px/);
    assert.match(mobileCss, /\.assets-folder-row__actions button\s*\{[^}]*min-width:\s*44px;[^}]*height:\s*44px/);
    assert.match(css, /\.assets-workspace__main\s*\{[^}]*min-width:\s*0/);
  });

  it("serializes Enter and blur asset rename commits through a pending ref", () => {
    const guard = workspace.indexOf("if (renamePendingRef.current) return;");
    const pending = workspace.indexOf("renamePendingRef.current = true;", guard);
    const rename = workspace.indexOf("await onRename(next)", pending);
    const finallyBlock = workspace.indexOf("finally", rename);
    const released = workspace.indexOf("renamePendingRef.current = false;", finallyBlock);
    assert.match(workspace, /const renamePendingRef = useRef\(false\);/);
    assert.ok(guard >= 0 && pending > guard && rename > pending && finallyBlock > rename && released > finallyBlock);
    assert.match(workspace, /onBlur=\{\(\) => void commitRename\(\)\}/);
    assert.match(workspace, /event\.key === "Enter"[\s\S]*?commitRename\(\)/);
  });

  it("makes only the mobile asset detail a modal dialog with a backdrop", () => {
    assert.match(workspace, /const isMobile = useIsMobile\(\);/);
    assert.match(workspace, /selectedAsset && isMobile \? \([\s\S]*?className="assets-workspace__detail-backdrop"[\s\S]*?onClick=\{closeDetail\}/);
    assert.match(workspace, /role=\{isMobile \? "dialog" : undefined\}/);
    assert.match(workspace, /aria-modal=\{isMobile \? true : undefined\}/);
    assert.match(css, /\.assets-workspace__detail-backdrop\s*\{\s*display:\s*none;/);
    assert.match(mobileCss, /\.assets-workspace__detail-backdrop\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*29;[^}]*inset:\s*0;[^}]*display:\s*block/);
  });

  it("moves, contains, and restores mobile dialog focus", () => {
    assert.match(workspace, /function useMobileAssetDetailDialog/);
    assert.match(workspace, /useModalFocus/);
  });

  it("keeps visual active state aligned with one current workspace view", () => {
    assert.match(folderTree, /const isActive = activeId === folder\.id;/);
    assert.match(folderTree, /className=\{`assets-folder-row__name\$\{isActive \? " is-active" : ""\}`\}[\s\S]*?aria-current=\{isActive \? "page" : undefined\}/);
    assert.match(folderTree, /const allActive = activeId === null && activeKind !== "element";/);
    assert.match(folderTree, /const elementActive = activeId === null && activeKind === "element";/);
    assert.match(folderTree, /className=\{`assets-folder-all\$\{allActive \? " is-active" : ""\}`\}[\s\S]*?aria-current=\{allActive \? "page" : undefined\}/);
    assert.match(folderTree, /className=\{`assets-folder-all assets-folder-elements\$\{elementActive \? " is-active" : ""\}`\}[\s\S]*?aria-current=\{elementActive \? "page" : undefined\}/);
    assert.doesNotMatch(folderTree, /aria-pressed=/);
  });

  it("routes only root empty CTAs to the existing Create mode", () => {
    const rootView = workspace.indexOf("const elementRootView");
    const genericFilteredTitle = workspace.indexOf('filtered ? "assets.emptySearchTitle"');
    assert.ok(rootView >= 0 && genericFilteredTitle > rootView);
    assert.match(workspace, /\{elementRootView \|\| \(!filtered && !filters\.folderId\) \? \([\s\S]*?setUIMode\("classic"\)[\s\S]*?t\("nav\.create"\)/);
    assert.doesNotMatch(workspace, /setUIMode\("asset-gen"\)/);
  });

  it("balances workspace headings and empty-state copy", () => {
    assert.match(css, /\.assets-toolbar__title h1\s*\{[^}]*text-wrap:\s*balance/);
    assert.match(css, /\.assets-empty h2\s*\{[^}]*text-wrap:\s*balance/);
    assert.match(css, /\.assets-empty p\s*\{[^}]*text-wrap:\s*pretty/);
  });

  it("preserves the 010 literal i18n calls without adding wp6 dictionary keys", () => {
    assert.match(workspace, /t\("assets\.detailAria", \{ name: selectedAsset\.name \}\)/);
    assert.match(workspace, /showToast\(t\("assets\.testSheetsUnavailable"\), true\)/);
    for (const locale of [en, ko]) {
      assert.equal(typeof locale.assets.detailAria, "string");
      assert.equal(typeof locale.assets.detailClose, "string");
      assert.equal(typeof locale.nav.create, "string");
    }
  });

  it("reuses existing store actions without importing implementation or API owners", () => {
    assert.match(workspace, /const setUIMode = useAppStore\(\(s\) => s\.setUIMode\);/);
    assert.match(folderTree, /const createFolder = useAppStore\(\(s\) => s\.createAssetFolder\);/);
    assert.match(folderTree, /const renameFolder = useAppStore\(\(s\) => s\.renameAssetFolder\);/);
    assert.match(folderTree, /const deleteFolder = useAppStore\(\(s\) => s\.deleteAssetFolder\);/);
    assert.doesNotMatch(workspace + folderTree, /storeAssetsImpl|storeUIImpl|api-assets\/folders/);
  });
});
