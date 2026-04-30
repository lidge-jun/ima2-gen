---
created: 2026-04-29
tags: [ima2-gen, prompt-library, import-ux, search-ux, github-issue-followup]
status: planned
source_screenshot: /Users/jun/.cli-jaw-3463/uploads/1777429781261_411402b2_Screenshot2026-04-29at112812AM.png
---

# Prompt Import Search UX

## STATUS 2026-04-30 — Partial

- Shipped: `bd7905d feat(prompt-import): improve search import UX` and `95b6306 fix(prompt-import): clean default-unselected state and reclaim scroll space (v2)` cover the first search/import UX and v2 default-unselected regressions.
- Remains: the broader R1-R5 dialog layout/preview/import-review polish in this plan still needs final audit; keep this folder in `_plan`.

## Screenshot Diagnosis

The current prompt import dialog is doing too many jobs in one vertical stack. In the provided screenshot, the user has searched for `dashboard`, but the visible results area starts near the bottom of the modal after folder controls, source tabs, curated sources, refresh buttons, and the search input.

Observed problems:

- Search results are pushed to the bottom, so only a small portion of the result list is visible.
- The result checkbox does not explain the next action. It looks like a generic selection state, not "choose this prompt to import".
- There is no obvious per-result `Import` / `불러오기` action.
- The result card shows raw title, text preview, and source tags, but not the app's own prompt-library review shape.
- The screenshot used in README/GitHub Pages is a prompt import dialog screenshot, not a general prompt-library search screen. The public copy should describe it as prompt import/import-review UI.

## Product Decision

Separate "find prompts to import" from "manage selected candidates".

The import dialog can still host local files, GitHub folders, curated sources, and discovery, but search results need their own readable workspace inside the modal:

```text
left/top: source + search controls
main: searchable result list with stable height
side/bottom: selected candidate preview in Prompt Library format
footer: explicit Import selected button
```

The core action should be:

```text
Search
→ inspect a result in the app's prompt format
→ click Import this prompt or select multiple
→ Import selected
```

## UX Requirements

### R1. Search Results Must Be Visible

The search area should not live only at the bottom of the import dialog. Once a curated search query is active, the dialog should allocate a dedicated results region with a bounded height.

Required behavior:

- Search input remains sticky or visible above the result list.
- Results list gets a larger scroll region than source controls.
- Folder/source/discovery controls may collapse into compact sections once search results exist.
- Footer remains visible and contains the primary import action.

### R2. Replace Ambiguous Checkbox-Only Action

The current checkbox alone is unclear. Keep multi-select if useful, but pair it with explicit commands.

Required result actions:

```text
Import
Preview
Select
```

Recommended card layout:

```text
[title]                  [Import]
[source/repo/license]
[short prompt preview]
[chips: model/task/warnings]
```

For multiple selection:

```text
checkbox + "선택됨"
footer button: "선택한 프롬프트 불러오기"
```

### R3. Preview In The App's Prompt Format

Selecting a result should open a preview pane or expanded card that uses the same mental model as saved Prompt Library entries.

Preview fields:

```text
Name
Prompt text
Tags
Mode hint
Model hints
Task hints
Quality / size hints
Warnings
Source repo/file
License / attribution requirement
```

The preview should answer:

```text
What will be saved?
Where did it come from?
Is there a model compatibility warning?
Will attribution be required?
```

Metadata fallback rule:

```text
PromptImportCandidate only guarantees id, name, text, tags, warnings, and source.
The preview must not require licenseSpdx, requiresAttribution, scoreHints, or textPreview.
Render license/attribution only when it can be derived from tags, warnings, or source strings.
Do not widen the backend response shape in this UX-only slice unless A-phase audit finds a blocking field gap.
```

### R4. Make "Import" The Primary CTA

The dialog footer should include one clear primary action:

```text
Import selected prompts
```

Per-result import can exist as a secondary fast path:

```text
Import this prompt
```

Do not rely on a checkmark icon alone.

### R5. Keep Existing Import Surfaces

Do not remove current PR1-PR4 abilities:

- local `.md`, `.markdown`, `.txt` import
- GitHub single-file preview
- GitHub folder browse
- curated source refresh/search
- discovery/manual review
- commit-only save boundary

The UX change reorganizes the modal; it should not bypass `/api/prompts/import/commit`.

## Implementation Plan

### NEW

`ui/src/components/PromptImportCandidatePreview.tsx`

Purpose:

- Render one selected prompt candidate in the app's prompt-library review format.
- Show prompt text, tags, hints, warnings, source, license, and attribution state.
- Provide `Import this prompt` for single-result import if passed by parent.

Initial component contract:

```tsx
import type { PromptImportCandidate } from "../lib/api";

type PromptImportCandidatePreviewProps = {
  candidate: PromptImportCandidate | null;
  selected: boolean;
  disabled?: boolean;
  onToggleSelected: (id: string, selected: boolean) => void;
  onImportOne: (candidate: PromptImportCandidate) => void;
};
```

Rendered shape:

```text
empty state
candidate.name
full prompt text
tags
warnings
source details
model/task/quality/size hints when available
Import this prompt button
selected toggle with text label
```

---

`ui/src/components/PromptImportSearchResults.tsx`

Purpose:

- Render curated search results in a bounded, readable list.
- Replace ambiguous checkbox-only cards with explicit `Preview`, `Select`, and `Import` actions.
- Keep result list separate from source controls.

Initial component contract:

```tsx
import type { PromptImportCandidate } from "../lib/api";

type PromptImportSearchResultsProps = {
  candidates: PromptImportCandidate[];
  selectedIds: Set<string>;
  activeCandidateId: string | null;
  busy?: boolean;
  onSelectCandidate: (candidate: PromptImportCandidate) => void;
  onToggleSelected: (id: string, selected: boolean) => void;
  onImportOne: (candidate: PromptImportCandidate) => void;
};
```

Rendered shape:

```text
bounded result list
result card title
source/license summary
short prompt preview
warning/hint chips
Preview button
Import button
text-labeled checkbox row
```

---

`tests/prompt-import-search-ux-contract.test.js`

Coverage:

- Search results are not only appended at the bottom of the dialog.
- Search results have a dedicated component and bounded scroll region.
- Result cards expose explicit import/preview/select copy.
- The footer contains an `Import selected` action.
- Candidate preview renders prompt text, tags/hints/warnings/source/license fields.
- No search result path calls `commitPromptImport` without an explicit user import action.

---

`tests/prompt-import-dialog-ui-contract.test.js`

Update existing assertions that lock the old bottom-only candidate list.

Before:

```text
asserts .prompt-import-dialog__candidate
asserts only the old preview/candidate list classes
```

After:

```text
asserts PromptImportSearchResults import/use
asserts PromptImportCandidatePreview import/use
asserts .prompt-import-dialog__workspace
asserts .prompt-import-dialog__results
asserts .prompt-import-dialog__candidate-preview
asserts footer import selected copy exists
asserts required promptLibrary i18n keys exist in en/ko
asserts PromptImportDialog no longer owns direct bottom-only candidates.map rendering
```

### MODIFY

`ui/src/components/PromptImportDialog.tsx`

Before:

```text
local dropzone
GitHub file/folder controls
source tabs
curated sources
search input
results appended below
candidate list
footer
```

After:

```text
local/GitHub/source controls in compact sections
curated search input stays visible
search results in dedicated bounded region
candidate preview/detail beside or below results
footer with explicit Import selected
```

Keep the file under the local line limit by extracting result/preview child components.

Concrete diff:

```diff
 import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
+import { PromptImportCandidatePreview } from "./PromptImportCandidatePreview";
+import { PromptImportSearchResults } from "./PromptImportSearchResults";
```

```diff
   const [candidates, setCandidates] = useState<PromptImportCandidate[]>([]);
   const [selected, setSelected] = useState<Set<string>>(new Set());
+  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
```

```diff
   const addPreviewCandidates = useCallback((next: PromptImportCandidate[]) => {
     setCandidates((prev) => {
       const known = new Set(prev.map((candidate) => candidate.id));
       const merged = [...prev];
       for (const candidate of next) {
         if (!known.has(candidate.id)) merged.push(candidate);
       }
       setSelected(new Set(merged.map((candidate) => candidate.id)));
+      setActiveCandidateId((current) => current ?? merged[0]?.id ?? null);
       return merged;
     });
   }, []);
```

```diff
+  const toggleCandidateSelected = useCallback((id: string, checked: boolean) => {
+    setSelected((prev) => {
+      const next = new Set(prev);
+      if (checked) next.add(id);
+      else next.delete(id);
+      return next;
+    });
+  }, []);
```

`commitSelected()` should be split so single-result import and footer import share the same commit boundary:

```diff
-  const commitSelected = useCallback(async () => {
-    const picked = candidates.filter((candidate) => selected.has(candidate.id));
+  const commitCandidates = useCallback(async (picked: PromptImportCandidate[]) => {
     if (picked.length === 0) {
       setError(t("promptLibrary.importSelectAtLeastOne"));
       return;
     }
     setBusy(true);
     setError(null);
     try {
       const result = await commitPromptImport({ candidates: picked });
       await onImported();
       showToast(t("promptLibrary.imported", { count: result.promptsImported }));
       onClose();
     } catch (err) {
       setError(err instanceof Error ? err.message : t("promptLibrary.importFailed"));
     } finally {
       setBusy(false);
     }
-  }, [candidates, onClose, onImported, selected, showToast, t]);
+  }, [onClose, onImported, showToast, t]);
+
+  const commitSelected = useCallback(async () => {
+    const picked = candidates.filter((candidate) => selected.has(candidate.id));
+    await commitCandidates(picked);
+  }, [candidates, commitCandidates, selected]);
+
+  const importOneCandidate = useCallback((candidate: PromptImportCandidate) => {
+    setSelected(new Set([candidate.id]));
+    void commitCandidates([candidate]);
+  }, [commitCandidates]);
```

Single-result import behavior is intentionally the same as selected import:

```text
onImportOne(candidate) calls commitCandidates([candidate]).
commitCandidates uses the existing backend boundary: commitPromptImport({ candidates: picked }).
It sets busy, clears error, calls onImported(), shows the existing imported toast, and closes the dialog on success.
The modal does not remain open after successful one-click import in this slice.
```

Replace the current bottom-only candidate list:

```diff
-        <div className="prompt-import-dialog__preview" aria-live="polite">
-          {candidates.length === 0 ? (
-            <div className="prompt-import-dialog__empty">{t("promptLibrary.importPreviewEmpty")}</div>
-          ) : (
-            candidates.map((candidate) => (
-              <label key={candidate.id} className="prompt-import-dialog__candidate">
-                <input ... />
-                <span>...</span>
-              </label>
-            ))
-          )}
-        </div>
+        <div className="prompt-import-dialog__workspace" aria-live="polite">
+          <PromptImportSearchResults
+            candidates={candidates}
+            selectedIds={selected}
+            activeCandidateId={activeCandidateId}
+            busy={busy}
+            onSelectCandidate={(candidate) => setActiveCandidateId(candidate.id)}
+            onToggleSelected={toggleCandidateSelected}
+            onImportOne={importOneCandidate}
+          />
+          <PromptImportCandidatePreview
+            candidate={candidates.find((candidate) => candidate.id === activeCandidateId) ?? null}
+            selected={activeCandidateId ? selected.has(activeCandidateId) : false}
+            disabled={busy}
+            onToggleSelected={toggleCandidateSelected}
+            onImportOne={importOneCandidate}
+          />
+        </div>
```

Footer copy should become explicit:

```diff
- {busy ? t("common.loading") : t("promptLibrary.importCommit")}
+ {busy ? t("common.loading") : t("promptLibrary.importSelected", { count: selected.size })}
```

---

`ui/src/lib/api.ts`

No new backend route is expected. Only adjust frontend types if existing candidate metadata is too loose for preview fields.

Current `PromptImportCandidate` already carries enough for the first implementation:

```text
id
name
text
tags
warnings
source
```

The preview should derive short text from `candidate.text` on the client. Model/task/quality/source chips should come from `candidate.tags`, `candidate.warnings`, and `candidate.source` first. Do not change the backend response shape in this UX slice unless A-phase audit finds a blocking field gap.

---

`ui/src/i18n/en.json`

Add/adjust keys under `promptLibrary`:

```text
promptLibrary.importSelected
promptLibrary.importThisPrompt
promptLibrary.previewPrompt
promptLibrary.selectPrompt
promptLibrary.selectedCount
promptLibrary.sourceDetails
promptLibrary.license
promptLibrary.attributionRequired
promptLibrary.modelHints
promptLibrary.taskHints
promptLibrary.compatibilityWarnings
```

---

`ui/src/i18n/ko.json`

Add/adjust keys under `promptLibrary`:

```text
importSelected: "선택한 프롬프트 불러오기"
importThisPrompt: "이 프롬프트 불러오기"
previewPrompt: "내용 보기"
selectPrompt: "선택"
selectedCount: "{count}개 선택됨"
sourceDetails: "출처"
license: "라이선스"
attributionRequired: "출처 표기 필요"
modelHints: "모델 힌트"
taskHints: "작업 힌트"
compatibilityWarnings: "호환성 경고"
```

---

`ui/src/index.css`

Add styles for:

```text
.prompt-import-dialog__workspace
.prompt-import-dialog__controls
.prompt-import-dialog__results
.prompt-import-dialog__result-card
.prompt-import-dialog__result-actions
.prompt-import-dialog__candidate-preview
.prompt-import-dialog__preview-field
.prompt-import-dialog__sticky-search
```

Requirements:

- Results area has stable min/max height.
- Footer remains visible.
- Footer remains outside the results and preview scroll regions.
- Workspace uses `min-height: 0` or equivalent containment so the fixed-height dialog footer is not clipped.
- Long prompt/source text wraps or clamps without horizontal overflow.
- Result and preview regions remain readable on mobile.

Concrete CSS structure:

```css
.prompt-import-dialog__panel {
  width: min(920px, calc(100vw - 24px));
}

.prompt-import-dialog__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
  gap: 14px;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.prompt-import-dialog__results {
  min-height: 0;
  max-height: min(44vh, 520px);
  overflow-y: auto;
}

.prompt-import-dialog__candidate-preview {
  min-height: 0;
  max-height: min(44vh, 520px);
  overflow-y: auto;
}

@media (max-width: 760px) {
  .prompt-import-dialog__workspace {
    grid-template-columns: 1fr;
  }
}
```

---

`README.md`

Correct the screenshot caption/alt text. It should describe a prompt import dialog, not a generic prompt search screen.

---

`docs/README.ko.md`

Correct the Korean screenshot caption/alt text as prompt import / 불러오기.

---

`docs/README.zh-CN.md`

Correct the screenshot caption/alt text as prompt import UI.

---

`docs/README.ja.md`

Correct the screenshot caption/alt text as prompt import UI.

---

`site/src/i18n/strings.ts`

Correct GitHub Pages copy:

- describe the screenshot as the prompt import dialog
- mention review before saving/importing selected prompts
- avoid implying the screenshot is the main prompt-library search UX

### DELETE

None.

## Verification

Focused:

```bash
node --test tests/prompt-import-search-ux-contract.test.js tests/prompt-import-dialog-ui-contract.test.js tests/prompt-library-ui-contract.test.js
```

Static/build:

```bash
cd ui && npx tsc --noEmit
npm run ui:build
```

Docs/site smoke:

```bash
rg -n "prompt-import-dialog|Prompt import|프롬프트 불러오기" README.md docs site/src/i18n/strings.ts
```

Full:

```bash
npm test
```

## Non-Goals

- Do not add a new backend import route.
- Do not auto-import search results.
- Do not remove folder/GitHub/discovery features.
- Do not make discovery candidates commit directly.
- Do not replace the main Prompt Library panel search in this slice.

---

## v2 — UX Regression Follow-up

**Date**: 2026-04-29 (afternoon)
**Trigger**: User screenshots showing the dialog after `bd7905d feat(prompt-import): improve search import UX`
**Status**: planned

The v1 slice landed component split (`PromptImportSearchResults`, `PromptImportCandidatePreview`), bounded scroll regions, and explicit footer copy. Three regressions remain:

### Regression A — curated sources default-checked

`ui/src/components/PromptImportDialog.tsx:65, 75`

```ts
setSelectedSourceIds(new Set(
  data.sources.filter((source) => source.defaultSearch).map((s) => s.id),
));
```

The server's `defaultSearch: true` flag is honored on first open, so any curated source marked default arrives pre-selected. User decision: **default selected set must be empty**, regardless of `defaultSearch`.

Fix:

```diff
- setSelectedSourceIds(new Set(data.sources.filter((source) => source.defaultSearch).map((s) => s.id)));
+ setSelectedSourceIds(new Set());
```

(Apply at both call sites — `loadCuratedSources` callback and the `useEffect` initial load.)

### Regression B — search results auto-selected

`ui/src/components/PromptImportDialog.tsx:92`

```ts
setSelected(new Set(merged.map((candidate) => candidate.id)));
```

Every preview/search candidate enters `selected` as it is added, so the footer counter reads "(50)" the moment a 50-result search returns. User wants candidates **unselected by default**; the user opts in per card.

Fix:

```diff
   const addPreviewCandidates = useCallback((next: PromptImportCandidate[]) => {
     setCandidates((prev) => {
       const known = new Set(prev.map((candidate) => candidate.id));
       const merged = [...prev];
       for (const candidate of next) {
         if (!known.has(candidate.id)) merged.push(candidate);
       }
-      setSelected(new Set(merged.map((candidate) => candidate.id)));
       setActiveCandidateId((current) => current ?? merged[0]?.id ?? null);
       return merged;
     });
   }, []);
```

To preserve bulk-select ergonomics for 50-row searches, add a header row in `PromptImportSearchResults.tsx`:

```text
┌ Search results (50) ─────────── [Select all] [Clear] ┐
│ result cards…                                         │
└──────────────────────────────────────────────────────┘
```

New props on `PromptImportSearchResults`:

```diff
 type PromptImportSearchResultsProps = {
   candidates: PromptImportCandidate[];
   selectedIds: Set<string>;
   activeCandidateId: string | null;
   busy?: boolean;
   onSelectCandidate: (candidate: PromptImportCandidate) => void;
   onToggleSelected: (id: string, selected: boolean) => void;
+  onSelectAll: () => void;
+  onClearSelection: () => void;
   onImportOne: (candidate: PromptImportCandidate) => void;
 };
```

Wire from `PromptImportDialog`:

```ts
const selectAllCandidates = useCallback(() => {
  setSelected(new Set(candidates.map((c) => c.id)));
}, [candidates]);

const clearCandidateSelection = useCallback(() => {
  setSelected(new Set());
}, []);
```

### Regression C — dialog content overflow blocks scroll

`ui/src/components/PromptImportDialog.tsx` + `ui/src/index.css:4727, 5046, 5055`

The panel is a fixed-height flex column with `overflow: hidden`. Above the workspace, the stack accumulates dropzone + GitHub URL row + folder section + source tabs + curated source list + search input + warnings. On a typical viewport that stack consumes ~600px. The workspace flex region is squeezed below the `min-height: 280px` of `__results`, and because the panel itself does not scroll, only one or two cards stay visible.

The plan's R1 already calls for this:

> Folder/source/discovery controls may collapse into compact sections once search results exist.

Implement R1 plus a defensive scroll fallback:

1. **Collapse upper inputs once `candidates.length > 0`**

   In `PromptImportDialog.tsx`, derive a boolean and conditionally render the dropzone, GitHub URL row, folder section, and source tabs. When results exist, surface a single "다른 소스 추가" / "Add another source" toggle that re-opens the upper sections (sets a local `forceShowSources` state, default `false`).

   ```tsx
   const hasResults = candidates.length > 0;
   const [forceShowSources, setForceShowSources] = useState(false);
   const showUpperSections = !hasResults || forceShowSources;
   ...
   {showUpperSections && (
     <>
       <div className="prompt-import-dialog__dropzone">…</div>
       <div className="prompt-import-dialog__github">…</div>
       <Suspense fallback={null}>
         <LazyPromptImportFolderSection … />
       </Suspense>
       <div className="prompt-import-dialog__source-tabs">…</div>
     </>
   )}
   {hasResults && !forceShowSources && (
     <button
       type="button"
       className="prompt-import-dialog__add-source-toggle"
       onClick={() => setForceShowSources(true)}
     >
       {t("promptLibrary.addAnotherSource")}
     </button>
   )}
   ```

2. **Always-on collapsible curated controls when results exist**

   Wrap the curated source list in a `<details>`, default-open when no results and default-closed when results appear:

   ```tsx
   <details
     className="prompt-import-dialog__sources-toggle"
     open={!hasResults}
   >
     <summary>{t("promptLibrary.curatedSources")}</summary>
     <div className="prompt-import-dialog__source-list">…</div>
   </details>
   ```

3. **Defensive panel scroll fallback (`ui/src/index.css`)**

   Keep `.__panel { overflow: hidden }` so header and footer remain anchored, but drop the workspace `min-height: 280px` so the inner flex region cannot push the footer off-screen:

   ```diff
   .prompt-import-dialog__results,
   .prompt-import-dialog__candidate-preview {
   -  min-height: 280px;
   +  min-height: 0;
     max-height: min(44vh, 520px);
     overflow-y: auto;
   ```

   `.__results` already has internal `overflow-y: auto` for vertical scroll inside the bounded region.

4. **Sticky search row inside the curated panel**

   ```diff
   .prompt-import-dialog__search-results {
   +  position: sticky;
   +  top: 0;
   +  background: var(--surface);
   +  z-index: 1;
   ```

### Tests to add (`tests/prompt-import-search-ux-contract.test.js`)

```js
it("starts with no curated sources selected even when defaultSearch is true", () => {
  const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
  assert.match(dialog, /setSelectedSourceIds\(new Set\(\)\)/);
  assert.doesNotMatch(dialog, /source\.defaultSearch/);
});

it("does not auto-select preview candidates", () => {
  const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
  const fn = /addPreviewCandidates[\s\S]*?\}\), \[\]\);/.exec(dialog)?.[0] ?? "";
  assert.doesNotMatch(fn, /setSelected\(new Set\(merged\.map/);
});

it("exposes select-all / clear actions on the results component", () => {
  const results = readSource("ui/src/components/PromptImportSearchResults.tsx");
  assert.match(results, /onSelectAll/);
  assert.match(results, /onClearSelection/);
});

it("collapses upper input sections when candidates exist", () => {
  const dialog = readSource("ui/src/components/PromptImportDialog.tsx");
  assert.match(dialog, /const hasResults = candidates\.length > 0/);
  assert.match(dialog, /showUpperSections/);
  assert.match(dialog, /addAnotherSource/);
});

it("results region drops min-height: 280px to avoid squeezing the panel", () => {
  const css = readSource("ui/src/index.css");
  const block = /\.prompt-import-dialog__results,\s*\n\s*\.prompt-import-dialog__candidate-preview \{[\s\S]*?\}/.exec(css)?.[0] ?? "";
  assert.doesNotMatch(block, /min-height:\s*280px/);
});
```

### i18n additions

en.json:

```json
{
  "promptLibrary.selectAllCandidates": "Select all",
  "promptLibrary.clearCandidateSelection": "Clear",
  "promptLibrary.addAnotherSource": "Add another source",
  "promptLibrary.searchResultsHeader": "Search results ({count})"
}
```

ko.json:

```json
{
  "promptLibrary.selectAllCandidates": "전체 선택",
  "promptLibrary.clearCandidateSelection": "선택 해제",
  "promptLibrary.addAnotherSource": "다른 소스 추가",
  "promptLibrary.searchResultsHeader": "검색 결과 ({count}개)"
}
```

### Acceptance

- Open dialog → curated source checkboxes are all OFF.
- Run a 50-result curated search → footer reads "선택한 프롬프트 불러오기 (0)".
- Click `Select all` → footer reads "(50)" and the cards are scrollable inside the results region without the panel content getting clipped.
- Click `Clear` → footer returns to "(0)".
- Once results appear, the dropzone / GitHub URL row / folder section / source tabs are tucked behind an "Add another source" toggle.
- Curated source list collapses into a `<details>`, default-closed when results exist.
- Removing `min-height: 280px` from `__results` does not regress the empty-state visual (empty card still has its own padding so the region looks intentional).

### Out of Scope for v2

- No backend route changes.
- Do not introduce a virtualized list yet — 50 cards in a scroll region is fine.
- Do not move screenshot diagnostics into a separate file.
