# 010 - NovelAI dual-prompt composer (wp2)

## Loop specification

- Loop archetype: spec-satisfaction.
- Goal: when the effective image provider is `nai`, present positive and undesired
  prompt panes at comparable visual weight, side by side in a composer wider than
  719px and stacked at 719px or narrower; keep every non-NAI composer visually and
  behaviorally single-pane. The existing NAI field self-gates at
  `ui/src/components/NegativePromptField.tsx:26`, while the positive prompt and NAI
  payload already have stable owners at `ui/src/components/PromptComposer.tsx:374`
  and `ui/src/lib/naiPayload.ts:46`.
- Non-goals: changing the `negativePrompt` store shape or persistence key; changing
  NAI request semantics; adding negative prompts to non-NAI providers; adding
  @-mention parsing to the home or negative fields; decorative motion; a provider
  settings redesign; a broad composer refactor. Store and wire ownership is already
  explicit at `ui/src/store/storeTypes.ts:345`,
  `ui/src/store/storeSettingsImpl.ts:572`,
  `ui/src/store/storePersistence.ts:413`, and `ui/src/lib/naiPayload.ts:33`.
- Verifier: focused source contracts, i18n parity, `npm run typecheck`,
  `npm run typecheck:tests`, `npm test`, `npm run test:inventory`,
  `cd ui && npm run build`, and browser screenshots against a fresh
  `IMA2_PORT=<spare> node bin/ima2.js serve --force`. The repository runner discovers
  every `tests/*.test.{js,ts}` file at `scripts/run-tests.mjs:8`, and the inventory
  separately classifies source-only contracts at `scripts/classify-tests.mjs:24`.
- Stop condition: all acceptance rows and activation scenarios in this unit are
  evidenced; both panes have labels, placeholders, character hints, visible focus,
  correct focus order, and Cmd/Ctrl+Enter submission; NAI classic/home/mobile and
  non-NAI regression renders are captured; all listed verifiers exit 0.
- Escalation: stop and return to the parent only on a design fork the Design Read
  cannot resolve. Locale scope is settled (LOCKED, 000_plan.md "Locale correction"):
  the four runtime locales at `ui/src/i18n/index.ts:7` and
  `tests/i18n-dictionary-contract.test.ts:18` are the whole contract; a Japanese
  locale is a non-goal of this unit.

Work class: C3 implementation design across classic, home, mobile delegation, CSS,
i18n, and source contracts. This cycle itself is docs-only and writes only this file.

## Design Read

```yaml
---
name: ima2-gen NovelAI dual-prompt composer
colors:
  primary: "existing --accent / --text tokens"
  accent: "none added"
  background: "existing --surface / --surface-2 tokens"
typography:
  heading: { fontFamily: "existing --font", fontSize: "existing composer label scale" }
  body: { fontFamily: "existing --font", fontSize: "existing composer textarea scale" }
iconography:
  system: "existing system; no icon added"
  weight: "n/a"
  domain: "none"
---
```

Reading this as: a repeated-work AI image tool surface for power users who switch
providers and tune prompts many times per session. The visual language is quiet,
dense, keyboard-first, and explicitly functional. The current palette, focus, radius,
surface, and typography tokens are centralized at `ui/src/index.css:61`,
`ui/src/index.css:78`, `ui/src/index.css:118`, and `ui/src/index.css:126`.

Do: give positive and undesired content equal pane geometry; use one separator/border
channel; keep labels and counts readable; let the composer container, not the viewport,
decide whether two columns fit; preserve the positive field's existing mention owner at
`ui/src/components/PromptComposer.tsx:397` and menu anchor at
`ui/src/components/PromptComposer.tsx:414`.

Don't: add gradients, provider colors, cards-within-cards, motion, collapse/expand
behavior, or an @ menu to the negative field. The current collapse is caused by focus
state and one-versus-three rows at `ui/src/components/NegativePromptField.tsx:24` and
`ui/src/components/NegativePromptField.tsx:39`; those are removed rather than restyled.

```text
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 1
Product density profile: D4
Reasoning: this is a productivity-tool composer where predictable repeated entry and
clear state outweigh novelty; all visual change is conditional on the NAI lane.
```

Concept-generation skip: this is a restrained utility layout inside a governing token
system, not a new expressive or brand-visible surface. No bitmap, illustration, new
icon, or decorative motion is required.

## Baseline and corrected mobile finding

1. `NegativePromptField` is currently a one-row field that expands to three rows only
   while focused or non-empty (`ui/src/components/NegativePromptField.tsx:28` and
   `ui/src/components/NegativePromptField.tsx:39`). It is already mounted after the
   classic prompt stack and in the home composer at
   `ui/src/components/PromptComposer.tsx:413` and
   `ui/src/components/home/HomePromptComposer.tsx:114`.
2. The field is not directly imported by `MobileComposeSheet`, but the sheet mounts
   `PromptComposer` in its prompt tab at
   `ui/src/components/MobileComposeSheet.tsx:169`. Therefore the field is already
   mounted indirectly on mobile when provider is NAI. No second mobile field may be
   added.
3. The mobile sheet exists at viewport widths up to 800px
   (`ui/src/hooks/useIsMobile.ts:3`) and gives the positive stack a 160px minimum at
   `ui/src/styles/responsive-layout.css:209`. The new 719px container query stacks the
   two panes without changing sheet ownership or focus trapping.
4. The default desktop workspace places the composer in a 260px sidebar
   (`ui/src/lib/workspaceProfile.ts:11` and `ui/src/styles/themes.css:36`), while the
   prompt-studio profile places it in the wide bottom dock
   (`ui/src/lib/workspaceProfile.ts:19` and
   `ui/src/styles/classic-workspace.css:91`). A container query is therefore required:
   a viewport-only breakpoint would force two unusably narrow columns in the default
   desktop sidebar.
5. `negativePrompt` is persisted with the composer draft and restored at startup
   (`ui/src/store/storeSettingsImpl.ts:575`,
   `ui/src/store/storePersistence.ts:413`,
   `ui/src/store/useAppStore.ts:270`). The payload builder trims it, omits whitespace,
   and only emits it for NAI (`ui/src/lib/naiPayload.ts:33` and
   `ui/src/lib/naiPayload.ts:46`). No state, persistence, or payload change is needed.

## Acceptance contract

| ID | Requirement | Evidence owner |
|---|---|---|
| NAI-DUAL-01 | NAI classic and home composers render a positive pane followed by an undesired-content pane. | New `tests/nai-dual-prompt-contract.test.ts`; rendered screenshots. |
| NAI-DUAL-02 | A composer container wider than 719px uses two equal columns; at 719px or narrower it uses one column. | `ui/src/styles/progress-composer.css` and `ui/src/styles/home-workspace.css`; computed-style check. |
| NAI-DUAL-03 | Non-NAI retains one positive prompt pane, original placeholder selection, and no empty negative shell. | `NegativePromptField` self-gate plus base `display: contents`; non-NAI screenshot. |
| NAI-DUAL-04 | Each NAI pane has a programmatic label, provider-specific placeholder, and `{count}` helper text. | TSX source contract plus i18n dictionary parity. |
| NAI-DUAL-05 | Classic @-mention parsing/menu remains attached only to the positive textarea. | Existing handlers at `ui/src/components/PromptComposer.tsx:381` and menu ref at `ui/src/components/PromptComposer.tsx:416`; negative-source exclusion assertion. |
| NAI-DUAL-06 | Cmd+Enter on macOS and Ctrl+Enter elsewhere submit from either pane; plain Enter remains a newline. | Positive and negative keydown source assertions plus browser keyboard smoke. |
| NAI-DUAL-07 | DOM/focus order is positive label -> positive textarea -> negative label -> negative textarea; visible focus uses existing `--focus-ring`. | JSX order, linked `htmlFor`/`id`/`aria-describedby`, keyboard smoke. |
| NAI-DUAL-08 | Mobile compose sheet gets the same stacked NAI composer through its existing `PromptComposer` mount. | `ui/src/components/MobileComposeSheet.tsx:169`; source contract and 390x844 screenshot. |
| NAI-DUAL-09 | Store persistence and NAI payload behavior remain unchanged. | Existing `tests/nai-client-options-contract.test.ts:137` and `tests/nai-client-options-contract.test.ts:237`. |

## Activation scenarios (C-ACTIVATION-GROUNDING-01)

Every conditional path has a constructible state; no row depends on an unreachable
mock-only condition.

| Conditional path | Constructible activation | Expected observation |
|---|---|---|
| `provider === "nai"`, wide classic | Persist `provider:"nai"`, `uiMode:"classic"`, and workspace profile `prompt-studio`; load at 1280x720. Those persisted owners are read at `ui/src/store/storePersistence.ts:365`, `ui/src/store/storePersistence.ts:117`, and `ui/src/store/useAppStore.ts:297`. | Bottom composer container exceeds 719px; two equal panes appear side by side. |
| `provider === "nai"`, narrow classic | Use default workspace profile at 1280x720; its sidebar is 260px (`ui/src/styles/themes.css:36`). | The same NAI wrapper takes the <=719px container branch and stacks; no horizontal clipping. |
| `provider === "nai"`, wide home | Persist `uiMode:"home"` and provider NAI; load at 1280x720. Home mounts its composer at `ui/src/components/home/HomeHero.tsx:81`. | Two equal home panes appear side by side. |
| `provider === "nai"`, mobile | Persist classic + NAI, set 390x844, open the existing compose FAB and prompt tab. The sheet's prompt panel mounts `PromptComposer` at `ui/src/components/MobileComposeSheet.tsx:169`. | Positive then negative panes stack; body scrolls; actions remain reachable. |
| `provider !== "nai"` | Persist `provider:"oauth"` and load classic at 1280x720. | `NegativePromptField` returns null; the layout wrappers resolve through `display: contents`; only the existing positive pane is visible. |
| Positive @ mention | In NAI classic positive textarea, type `@` followed by an available element name. `findMentionAtCaret` is called from the positive change/click handlers at `ui/src/components/PromptComposer.tsx:391`. | Mention menu opens and selection edits the positive prompt. |
| Negative `@` literal | Type the same text into the undesired-content textarea. | Text remains literal; no menu opens because `NegativePromptField` has no mention import or handler. |
| Positive shortcut | Put non-empty text in the positive pane, press Cmd/Ctrl+Enter. | Existing `generate` action runs; classic missing-element guard remains effective. |
| Negative shortcut | Keep positive text non-empty, focus negative pane, press Cmd/Ctrl+Enter. | The same submit callback runs. Empty positive prompt still no-ops at the generation boundary (`ui/src/store/storeGenerateEntryImpl.ts:10`). |
| Plain Enter | Focus either textarea and press Enter without Meta/Ctrl. | A newline is inserted; submit callback is not called. |
| Home shortcut while invalid | Home positive is empty or `activeGenerations > 0`; press Cmd/Ctrl+Enter in either pane. The button currently expresses the same disabled state at `ui/src/components/home/HomePromptComposer.tsx:127`. | Shared home submit helper returns without generation or mode switch. |
| Provider switch retention | Enter negative text, switch NAI -> OAuth -> NAI. | Field hides and reappears with its value because it remains global persisted draft state (`ui/src/components/NegativePromptField.tsx:13` and `ui/src/store/storeSettingsImpl.ts:575`). |
| Empty/whitespace negative payload | Submit NAI with negative text empty or whitespace. | `naiPayloadFields` omits `negativePrompt` (`ui/src/lib/naiPayload.ts:46`). |
| Non-empty negative payload | Submit NAI with `"  blurry  "`. | Wire payload contains `negativePrompt:"blurry"`; existing test covers this at `tests/nai-client-options-contract.test.ts:137`. |

## File/write map

### Product/UI files

- MODIFY `ui/src/components/PromptComposer.tsx`: subscribe to provider, share one
  submit callback across the existing positive textarea and negative field, wrap the
  prompt stack in a conditional dual-pane layout, add linked positive label/hint, and
  preserve the mention menu outside the negative pane. Current file length is 499
  lines; implementation must offset added lines with the formatting-only compactions
  shown below and finish at <=499 (`ui/src/components/PromptComposer.tsx:499`).
- MODIFY `ui/src/components/NegativePromptField.tsx`: remove focus/collapse state,
  render a stable full-height pane, link label/hint, count characters, and invoke an
  injected submit callback only on Cmd/Ctrl+Enter.
- MODIFY `ui/src/components/home/HomePromptComposer.tsx`: add the conditional home
  pane wrapper, NAI-specific positive copy/count, and one guarded submit helper shared
  by the button and both textareas.
- NO CHANGE `ui/src/components/MobileComposeSheet.tsx`: it already mounts
  `PromptComposer` at `ui/src/components/MobileComposeSheet.tsx:169`; duplicating the negative field here would create two
  store-bound inputs in one focus path.
- MODIFY `ui/src/styles/progress-composer.css`: add the classic pane grid, equal pane
  frame, anonymous container query, and dual-sidebar flex ownership. The file is
  already 637 lines (`ui/src/styles/progress-composer.css:637`), so wp2 must not claim
  it satisfies the repository's <500 convention. A full CSS extraction is a separate
  refactor and requires parent authorization if the line cap is enforced on existing
  debt.
- MODIFY `ui/src/styles/provider-controls.css`: replace collapsed negative-field CSS
  with classic/home variants of equal visual weight, using only existing surface,
  border, radius, text, and focus tokens.
- MODIFY `ui/src/styles/home-workspace.css`: add the home dual grid/container query and
  mobile home textarea parity.
- NO CHANGE `ui/src/styles/responsive-layout.css`: the existing sheet sizing and scroll
  behavior at lines 189-220 remain authoritative; the new composer-local container
  query handles stacking.

### State and request files

- NO CHANGE `ui/src/store/storeTypes.ts`, `ui/src/store/storeSettingsImpl.ts`,
  `ui/src/store/storePersistence.ts`, `ui/src/store/useAppStore.ts`, and
  `ui/src/lib/naiPayload.ts`. Existing persistence and sparse payload tests already
  prove this path (`tests/nai-client-options-contract.test.ts:237`).

### i18n files

- MODIFY `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`,
  `ui/src/i18n/zh-Hans.json`, and `ui/src/i18n/zh-Hant.json`.
- NON-GOAL (locked): a Japanese `ui/src/i18n/ja.json` and the corresponding edits to
  `ui/src/i18n/index.ts`, `tests/i18n-dictionary-contract.test.ts`,
  `tests/i18n-coverage-contract.test.ts`,
  `tests/settings-i18n-state-contract.test.ts`, and every other explicit four-locale
  registry. The current runtime supports only four locales at
  `ui/src/i18n/index.ts:1` and the parity loops enumerate only four at
  `tests/i18n-coverage-contract.test.ts:10` and
  `tests/i18n-dictionary-contract.test.ts:22`.

### Tests/inventory

- NEW `tests/nai-dual-prompt-contract.test.ts`: source-contract coverage for both
  conditional wrappers, mobile delegation, non-NAI display-contents path, responsive
  container query, a11y linkage, keyboard submission, and positive-only mentions.
- MODIFY `docs/migration/runtime-test-inventory.md`: generated inventory count and
  sorted contract entry. `npm run test:inventory` otherwise fails stale at
  `scripts/classify-tests.mjs:56`.
- NO CHANGE `tests/i18n-dictionary-contract.test.ts` and
  `tests/i18n-coverage-contract.test.ts` in the four-locale wp2 implementation: they
  already enforce identical leaf paths and resolution at
  `tests/i18n-dictionary-contract.test.ts:380` and
  `tests/i18n-coverage-contract.test.ts:53`.

## Copy-paste implementation diffs

The diffs below target the current `dev` source read for this plan. The Japanese
expansion is intentionally excluded because no partial `ja.json` can pass current
dictionary parity.

### 1. MODIFY `ui/src/components/NegativePromptField.tsx`

```diff
diff --git a/ui/src/components/NegativePromptField.tsx b/ui/src/components/NegativePromptField.tsx
--- a/ui/src/components/NegativePromptField.tsx
+++ b/ui/src/components/NegativePromptField.tsx
@@
-import { useState } from "react";
 import { useAppStore } from "../store/useAppStore";
 import { useI18n } from "../i18n";

+type NegativePromptFieldProps = {
+  variant: "classic" | "home";
+  onSubmit: () => void;
+};
+
 /**
  * NovelAI's undesired-content prompt.
@@
- * Mounted outside the classic composer's prompt stack: inside it the field
- * would inherit the @-mention keydown handling, which is wrong for a tag list.
+ * Receives only the shared submit callback. Mention parsing remains owned by
+ * the positive field, so an @ typed here stays literal text.
  */
-export function NegativePromptField({ variant }: { variant: "classic" | "home" }) {
+export function NegativePromptField({ variant, onSubmit }: NegativePromptFieldProps) {
   const provider = useAppStore((s) => s.provider);
   const value = useAppStore((s) => s.negativePrompt);
   const setValue = useAppStore((s) => s.setNegativePrompt);
   const { t } = useI18n();
-  const [focused, setFocused] = useState(false);

   if (provider !== "nai") return null;

-  const expanded = focused || value.length > 0;
   const id = `negative-prompt-${variant}`;
+  const hintId = `${id}-hint`;

   return (
@@
       <textarea
         id={id}
-        className={`negative-prompt__textarea${expanded ? " negative-prompt__textarea--expanded" : ""}`}
-        rows={expanded ? 3 : 1}
+        className="negative-prompt__textarea"
+        rows={5}
         value={value}
         placeholder={t("nai.negativePrompt.placeholder")}
+        aria-describedby={hintId}
         onChange={(event) => setValue(event.target.value)}
-        onFocus={() => setFocused(true)}
-        onBlur={() => setFocused(false)}
-        // No submit-on-Enter: the positive prompt owns that shortcut, and two
-        // different Enter semantics in adjacent fields is a trap.
+        onKeyDown={(event) => {
+          if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
+          event.preventDefault();
+          onSubmit();
+        }}
       />
-      {expanded ? (
-        <p className="negative-prompt__hint">{t("nai.negativePrompt.hint")}</p>
-      ) : null}
+      <p id={hintId} className="negative-prompt__hint">
+        {t("nai.negativePrompt.hint", { count: value.length })}
+      </p>
     </div>
   );
 }
```

### 2. MODIFY `ui/src/components/PromptComposer.tsx`

The three formatting-only compactions in this diff are mandatory line-budget offsets;
they do not alter behavior.

```diff
diff --git a/ui/src/components/PromptComposer.tsx b/ui/src/components/PromptComposer.tsx
--- a/ui/src/components/PromptComposer.tsx
+++ b/ui/src/components/PromptComposer.tsx
@@
 export function PromptComposer({ variant = "sidebar" }: PromptComposerProps) {
   const prompt = useAppStore((s) => s.prompt);
   const setPrompt = useAppStore((s) => s.setPrompt);
+  const provider = useAppStore((s) => s.provider);
@@
   const isDirectMode = promptMode === "direct";
+  const isNai = provider === "nai";
   const beforePrompts = insertedPrompts.filter((item) => item.placement !== "after");
   const afterPrompts = insertedPrompts.filter((item) => item.placement === "after");
-  const visualPromptIds = [
-    ...beforePrompts.map((item) => item.id),
-    "__main_prompt__",
-    ...afterPrompts.map((item) => item.id),
-  ];
+  const visualPromptIds = [...beforePrompts.map((item) => item.id), "__main_prompt__", ...afterPrompts.map((item) => item.id)];
@@
   const placeholder = multimode
@@
       ? t("prompt.placeholderWithRefs")
       : t("prompt.placeholder");
+  const submitPrompt = () => { if (missingElementIds.length === 0) void generate(); };
@@
-  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
-    e.preventDefault();
-    if (!dragOver) setDragOver(true);
-  };
+  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); if (!dragOver) setDragOver(true); };
@@
       className={`composer composer--${variant}${dragOver ? " composer--drag" : ""}${isDirectMode ? " composer--direct" : ""}${multimode ? " composer--multimode" : ""}${isDirectMode && multimode ? " composer--combined-modes" : ""}`}
       role="group"
-      aria-label={
-        multimode
-          ? t("multimode.composerAriaLabel", { count: multimodeMaxImages })
-          : t("prompt.label")
-      }
+      aria-label={multimode ? t("multimode.composerAriaLabel", { count: multimodeMaxImages }) : t("prompt.label")}
@@
-      <div className="composer__prompt-stack">
-        <DeadTagMirror prompt={prompt} retiredTags={retiredTags} textareaRef={textareaRef} />
-        <textarea
+      <div className={`composer__prompt-panes${isNai ? " composer__prompt-panes--dual" : ""}`}>
+        <div className="composer__prompt-pane">
+          {isNai ? <label className="composer__prompt-pane-label" htmlFor={`positive-prompt-${variant}`}>{t("nai.positivePrompt.label")}</label> : null}
+          <div className="composer__prompt-stack">
+            <DeadTagMirror prompt={prompt} retiredTags={retiredTags} textareaRef={textareaRef} />
+            <textarea
+              id={`positive-prompt-${variant}`}
               ref={textareaRef}
               className="prompt-area composer__textarea"
               value={prompt}
-          placeholder={placeholder}
+              placeholder={isNai ? t("nai.positivePrompt.placeholder") : placeholder}
+              aria-describedby={isNai ? `positive-prompt-${variant}-hint` : undefined}
@@
             if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
               e.preventDefault();
-              if (missingElementIds.length > 0) return;
-              void generate();
+              submitPrompt();
             }
           }}
-        />
+            />
+          </div>
+          {isNai ? <p id={`positive-prompt-${variant}-hint`} className="composer__prompt-hint">{t("nai.positivePrompt.hint", { count: prompt.length })}</p> : null}
+        </div>
+        <NegativePromptField variant="classic" onSubmit={submitPrompt} />
       </div>
-      <NegativePromptField variant="classic" />
       <ElementMentionMenu
```

The indentation above is the final indentation. After applying the hunk, keep
`wc -l ui/src/components/PromptComposer.tsx` at 499 or fewer as the file-budget gate.

### 3. MODIFY `ui/src/components/home/HomePromptComposer.tsx`

```diff
diff --git a/ui/src/components/home/HomePromptComposer.tsx b/ui/src/components/home/HomePromptComposer.tsx
--- a/ui/src/components/home/HomePromptComposer.tsx
+++ b/ui/src/components/home/HomePromptComposer.tsx
@@
   const selectedPresets = getAllPresets().filter((preset) => selectedIdSet.has(preset.id));
   const isGenerating = activeGenerations > 0;
+  const isNai = provider === "nai";
+  const submitPrompt = () => {
+    if (isGenerating || prompt.trim().length === 0) return;
+    void generate();
+    useAppStore.getState().setUIMode("classic");
+  };
   const providerItems = Object.entries(PROVIDER_LABELS).map(([value, label]) => {
@@
-      <label className="home-prompt__label" htmlFor="home-prompt-input">
-        {t("prompt.label")}
-      </label>
-      <textarea
-        id="home-prompt-input"
-        className="home-prompt__textarea"
-        rows={5}
-        value={prompt}
-        placeholder={t("prompt.placeholder")}
-        onChange={(event) => setPrompt(event.target.value)}
-      />
-
-      <NegativePromptField variant="home" />
+      <div className={`home-prompt__panes${isNai ? " home-prompt__panes--dual" : ""}`}>
+        <div className="home-prompt__pane">
+          <label className="home-prompt__label" htmlFor="home-prompt-input">
+            {isNai ? t("nai.positivePrompt.label") : t("prompt.label")}
+          </label>
+          <textarea
+            id="home-prompt-input"
+            className="home-prompt__textarea"
+            rows={5}
+            value={prompt}
+            placeholder={isNai ? t("nai.positivePrompt.placeholder") : t("prompt.placeholder")}
+            aria-describedby={isNai ? "home-prompt-hint" : undefined}
+            onChange={(event) => setPrompt(event.target.value)}
+            onKeyDown={(event) => {
+              if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
+              event.preventDefault();
+              submitPrompt();
+            }}
+          />
+          {isNai ? <p id="home-prompt-hint" className="home-prompt__hint">{t("nai.positivePrompt.hint", { count: prompt.length })}</p> : null}
+        </div>
+        <NegativePromptField variant="home" onSubmit={submitPrompt} />
+      </div>
@@
           className="home-prompt__generate"
           disabled={isGenerating || prompt.trim().length === 0}
-          onClick={() => {
-            void generate();
-            // Switch to classic mode so the user sees inflight/results
-            const setUIMode = useAppStore.getState().setUIMode;
-            setUIMode("classic");
-          }}
+          onClick={submitPrompt}
```

### 4. MODIFY `ui/src/styles/progress-composer.css`

```diff
diff --git a/ui/src/styles/progress-composer.css b/ui/src/styles/progress-composer.css
--- a/ui/src/styles/progress-composer.css
+++ b/ui/src/styles/progress-composer.css
@@
 .composer {
   position: relative;
+  container-type: inline-size;
@@
-.composer__prompt-stack {
+.composer__prompt-panes,
+.composer__prompt-pane {
+  display: contents;
+}
+.composer__prompt-panes--dual {
+  display: grid;
+  grid-template-columns: repeat(2, minmax(0, 1fr));
+  align-items: stretch;
+  gap: 8px;
+  min-width: 0;
+}
+.composer__prompt-panes--dual .composer__prompt-pane {
+  display: flex;
+  flex-direction: column;
+  min-width: 0;
+  padding: 10px;
+  border: 1px solid var(--border);
+  border-radius: var(--r-md);
+  background: var(--surface-2);
+}
+.composer__prompt-pane-label {
+  display: block;
+  margin-bottom: 6px;
+  color: var(--text-muted);
+  font: 600 11px/1.3 var(--font);
+}
+.composer__prompt-hint {
+  margin: 6px 0 0;
+  color: var(--text-muted);
+  font: 500 11px/1.4 var(--font);
+}
+.composer__prompt-stack {
   position: relative;
   min-width: 0;
 }
+.composer__prompt-panes--dual .composer__prompt-stack {
+  flex: 1 1 auto;
+  min-height: 0;
+}
@@
 @media (min-width: 801px) {
@@
+  .composer--sidebar .composer__prompt-panes--dual {
+    flex: 1 1 auto;
+    min-height: 0;
+  }
@@
 }
+@container (max-width: 719px) {
+  .composer__prompt-panes--dual {
+    grid-template-columns: minmax(0, 1fr);
+  }
+}
```

### 5. MODIFY `ui/src/styles/provider-controls.css`

Replace the current negative-prompt block at
`ui/src/styles/provider-controls.css:196` in full:

```diff
diff --git a/ui/src/styles/provider-controls.css b/ui/src/styles/provider-controls.css
--- a/ui/src/styles/provider-controls.css
+++ b/ui/src/styles/provider-controls.css
@@
-/* The undesired-content prompt is secondary to the positive prompt and must
-   not compete for vertical space until it is being used. */
+/* NAI prompt content is a peer editing surface: positive and undesired panes
+   keep equal geometry while provider gating remains in the React component. */
 .negative-prompt {
-  margin-top: 6px;
+  display: flex;
+  flex-direction: column;
+  min-width: 0;
+  margin: 0;
+}
+
+.negative-prompt--classic {
+  padding: 10px;
+  border: 1px solid var(--border);
+  border-radius: var(--r-md);
+  background: var(--surface-2);
 }

 .negative-prompt__label {
   display: block;
-  font-size: 11px;
-  color: var(--text-muted);
-  margin-bottom: 4px;
+  margin-bottom: 6px;
+  color: var(--text-muted);
+  font: 600 11px/1.3 var(--font);
 }

 .negative-prompt__textarea {
+  flex: 1 1 auto;
   width: 100%;
+  min-height: var(--composer-textarea-min-height, 80px);
   box-sizing: border-box;
   resize: vertical;
-  padding: 6px 8px;
-  border: 1px solid var(--border);
-  border-radius: var(--r-sm);
-  background: var(--surface);
   color: var(--text);
-  font-size: 12px;
   font-family: inherit;
-  line-height: 1.4;
-  transition: min-height 120ms ease;
+  line-height: 1.5;
 }

-.negative-prompt__textarea--expanded {
-  min-height: 4.5rem;
+.negative-prompt--classic .negative-prompt__textarea {
+  padding: 4px 2px;
+  border: 0;
+  background: transparent;
+  font-size: 13px;
+}
+
+.negative-prompt__textarea:focus {
+  outline: none;
+}
+
+.negative-prompt__textarea:focus-visible {
+  box-shadow: 0 0 0 2px var(--focus-ring);
 }

 .negative-prompt__textarea::placeholder {
   color: var(--text-muted);
   opacity: 0.7;
 }

 .negative-prompt__hint {
-  margin: 4px 0 0;
-  font-size: 11px;
+  margin: 6px 0 0;
   color: var(--text-muted);
+  font: 500 11px/1.4 var(--font);
+}
+
+.negative-prompt--home .negative-prompt__label {
+  margin-bottom: 10px;
+  font-family: var(--mono);
+  font-size: 11px;
+  font-weight: 400;
+  letter-spacing: 0.08em;
+  line-height: normal;
+  text-transform: uppercase;
+}
+
+.negative-prompt--home .negative-prompt__textarea {
+  min-height: 168px;
+  padding: 18px 20px;
+  border: 1px solid var(--border-strong, var(--border));
+  border-radius: var(--r-xl);
+  background: color-mix(in srgb, var(--surface-2) 88%, transparent);
+  font: 500 18px/1.6 var(--font);
+  transition: border-color 160ms ease, box-shadow 160ms ease;
+}
+
+.negative-prompt--home .negative-prompt__textarea:focus {
+  border-color: var(--accent);
+  box-shadow: 0 0 0 3px var(--focus-ring);
 }
```

### 6. MODIFY `ui/src/styles/home-workspace.css`

```diff
diff --git a/ui/src/styles/home-workspace.css b/ui/src/styles/home-workspace.css
--- a/ui/src/styles/home-workspace.css
+++ b/ui/src/styles/home-workspace.css
@@
 .home-prompt {
+  container-type: inline-size;
   padding: clamp(20px, 3vw, 32px);
@@
 .home-prompt__label {
@@
 }
+
+.home-prompt__panes,
+.home-prompt__pane {
+  display: contents;
+}
+
+.home-prompt__panes--dual {
+  display: grid;
+  grid-template-columns: repeat(2, minmax(0, 1fr));
+  align-items: stretch;
+  gap: 12px;
+}
+
+.home-prompt__panes--dual .home-prompt__pane {
+  display: flex;
+  flex-direction: column;
+  min-width: 0;
+}
+
+.home-prompt__panes--dual .home-prompt__textarea {
+  flex: 1 1 auto;
+}
+
+.home-prompt__hint {
+  margin: 6px 0 0;
+  color: var(--text-muted);
+  font: 500 11px/1.4 var(--font);
+}
+
+@container (max-width: 719px) {
+  .home-prompt__panes--dual {
+    grid-template-columns: minmax(0, 1fr);
+  }
+}
@@
 @media (max-width: 480px) {
@@
   .home-prompt__textarea { min-height: 144px; padding: 14px; font-size: 16px; }
+  .negative-prompt--home .negative-prompt__textarea { min-height: 144px; padding: 14px; font-size: 16px; }
```

### 7. MODIFY the four current locale dictionaries

Current negative keys exist in all four dictionaries at
`ui/src/i18n/en.json:2367`, `ui/src/i18n/ko.json:2367`,
`ui/src/i18n/zh-Hans.json:2367`, and `ui/src/i18n/zh-Hant.json:2367`.
Add `positivePrompt` immediately before `negativePrompt`, retain existing negative
label/placeholder, and replace only its hint:

```diff
diff --git a/ui/src/i18n/en.json b/ui/src/i18n/en.json
--- a/ui/src/i18n/en.json
+++ b/ui/src/i18n/en.json
@@
   "nai": {
+    "positivePrompt": {
+      "label": "Positive prompt",
+      "placeholder": "Describe the subject, scene, style, and details you want…",
+      "hint": "{count} characters. Type @ to add a reference."
+    },
     "negativePrompt": {
       "label": "Undesired content",
       "placeholder": "lowres, bad anatomy, watermark…",
-      "hint": "Tags to steer away from. Combines with the preset below."
+      "hint": "{count} characters. Tags to steer away from; combines with the preset below."
     },
```

```diff
diff --git a/ui/src/i18n/ko.json b/ui/src/i18n/ko.json
--- a/ui/src/i18n/ko.json
+++ b/ui/src/i18n/ko.json
@@
   "nai": {
+    "positivePrompt": {
+      "label": "포지티브 프롬프트",
+      "placeholder": "원하는 피사체, 장면, 스타일과 세부 요소를 입력하세요…",
+      "hint": "{count}자. @를 입력해 레퍼런스를 추가할 수 있습니다."
+    },
     "negativePrompt": {
       "label": "제외할 요소",
       "placeholder": "저화질, 어색한 손, 워터마크…",
-      "hint": "피하고 싶은 태그를 적습니다. 아래 프리셋과 함께 적용됩니다."
+      "hint": "{count}자. 피하고 싶은 태그이며 아래 프리셋과 함께 적용됩니다."
     },
```

```diff
diff --git a/ui/src/i18n/zh-Hans.json b/ui/src/i18n/zh-Hans.json
--- a/ui/src/i18n/zh-Hans.json
+++ b/ui/src/i18n/zh-Hans.json
@@
   "nai": {
+    "positivePrompt": {
+      "label": "正面提示词",
+      "placeholder": "描述想要生成的主体、场景、风格和细节…",
+      "hint": "{count} 个字符。输入 @ 可添加参考。"
+    },
     "negativePrompt": {
       "label": "排除内容",
       "placeholder": "低画质、结构错误、水印…",
-      "hint": "想要避开的标签。与下方预设一同生效。"
+      "hint": "{count} 个字符。用于避开的标签，并与下方预设一起生效。"
     },
```

```diff
diff --git a/ui/src/i18n/zh-Hant.json b/ui/src/i18n/zh-Hant.json
--- a/ui/src/i18n/zh-Hant.json
+++ b/ui/src/i18n/zh-Hant.json
@@
   "nai": {
+    "positivePrompt": {
+      "label": "正向提示詞",
+      "placeholder": "描述想要生成的主體、場景、風格與細節…",
+      "hint": "{count} 個字元。輸入 @ 可加入參考。"
+    },
     "negativePrompt": {
       "label": "排除內容",
       "placeholder": "低畫質、結構錯誤、浮水印…",
-      "hint": "想要避開的標籤。與下方預設一同生效。"
+      "hint": "{count} 個字元。用於避開的標籤，並與下方預設一起生效。"
     },
```

Required Japanese copy after a complete Japanese dictionary is approved and created:

```json
"positivePrompt": {
  "label": "ポジティブプロンプト",
  "placeholder": "生成したい被写体、シーン、スタイル、詳細を入力…",
  "hint": "{count}文字。@で参照を追加できます。"
},
"negativePrompt": {
  "label": "除外する内容",
  "placeholder": "低品質、不自然な手、透かし…",
  "hint": "{count}文字。避けたいタグです。下のプリセットと併用されます。"
}
```

This Japanese fragment is copy specification, not a valid standalone `ja.json`.
The full locale must have the same complete leaf set as English because
`tests/i18n-dictionary-contract.test.ts:380` compares every leaf path.

### 8. NEW `tests/nai-dual-prompt-contract.test.ts`

```diff
diff --git a/tests/nai-dual-prompt-contract.test.ts b/tests/nai-dual-prompt-contract.test.ts
new file mode 100644
--- /dev/null
+++ b/tests/nai-dual-prompt-contract.test.ts
@@
+import assert from "node:assert/strict";
+import { readFileSync } from "node:fs";
+import test from "node:test";
+
+const read = (path: string) => readFileSync(path, "utf8");
+const classic = read("ui/src/components/PromptComposer.tsx");
+const home = read("ui/src/components/home/HomePromptComposer.tsx");
+const negative = read("ui/src/components/NegativePromptField.tsx");
+const mobile = read("ui/src/components/MobileComposeSheet.tsx");
+const composerCss = read("ui/src/styles/progress-composer.css");
+const homeCss = read("ui/src/styles/home-workspace.css");
+const providerCss = read("ui/src/styles/provider-controls.css");
+const locales = ["en", "ko", "zh-Hans", "zh-Hant"] as const;
+
+test("nai conditionally activates dual prompt wrappers in classic and home", () => {
+  assert.match(classic, /const isNai = provider === "nai"/);
+  assert.match(classic, /isNai \? " composer__prompt-panes--dual" : ""/);
+  assert.match(home, /isNai \? " home-prompt__panes--dual" : ""/);
+  assert.match(negative, /if \(provider !== "nai"\) return null/);
+  assert.match(composerCss, /\.composer__prompt-panes,\s*\.composer__prompt-pane\s*\{\s*display:\s*contents;/);
+  assert.match(homeCss, /\.home-prompt__panes,\s*\.home-prompt__pane\s*\{\s*display:\s*contents;/);
+});
+
+test("the mobile sheet reuses PromptComposer instead of mounting a duplicate field", () => {
+  assert.match(mobile, /<PromptComposer \/>/);
+  assert.doesNotMatch(mobile, /NegativePromptField/);
+  assert.match(classic, /<NegativePromptField variant="classic" onSubmit=\{submitPrompt\} \/>/);
+  assert.match(home, /<NegativePromptField variant="home" onSubmit=\{submitPrompt\} \/>/);
+});
+
+test("dual panes share equal columns and stack below the 720px container boundary", () => {
+  assert.match(composerCss, /\.composer__prompt-panes--dual\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
+  assert.match(homeCss, /\.home-prompt__panes--dual\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
+  assert.match(composerCss, /@container \(max-width: 719px\)\s*\{[\s\S]*?\.composer__prompt-panes--dual\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
+  assert.match(homeCss, /@container \(max-width: 719px\)\s*\{[\s\S]*?\.home-prompt__panes--dual\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
+  assert.match(providerCss, /\.negative-prompt--classic/);
+  assert.match(providerCss, /\.negative-prompt--home/);
+});
+
+test("both panes expose labels, descriptions, and the same submit shortcut", () => {
+  assert.match(classic, /htmlFor=\{`positive-prompt-\$\{variant\}`\}/);
+  assert.match(classic, /aria-describedby=\{isNai \? `positive-prompt-\$\{variant\}-hint` : undefined\}/);
+  assert.match(home, /aria-describedby=\{isNai \? "home-prompt-hint" : undefined\}/);
+  assert.match(negative, /aria-describedby=\{hintId\}/);
+  assert.match(negative, /htmlFor=\{id\}/);
+  assert.match(negative, /onSubmit\(\)/);
+  for (const source of [classic, home, negative]) {
+    assert.match(source, /\.metaKey/);
+    assert.match(source, /\.ctrlKey/);
+  }
+  assert.match(home, /onClick=\{submitPrompt\}/);
+});
+
+test("mention parsing remains exclusive to the classic positive pane", () => {
+  assert.match(classic, /findMentionAtCaret/);
+  assert.match(classic, /textareaRef=\{textareaRef\}/);
+  assert.doesNotMatch(negative, /findMentionAtCaret|ElementMentionMenu|MentionQuery/);
+});
+
+test("all current locale dictionaries provide labels, placeholders, and character hints", () => {
+  for (const locale of locales) {
+    const dictionary = JSON.parse(read(`ui/src/i18n/${locale}.json`));
+    for (const pane of ["positivePrompt", "negativePrompt"] as const) {
+      assert.equal(typeof dictionary.nai[pane].label, "string", `${locale} ${pane} label`);
+      assert.equal(typeof dictionary.nai[pane].placeholder, "string", `${locale} ${pane} placeholder`);
+      assert.match(dictionary.nai[pane].hint, /\{count\}/, `${locale} ${pane} count`);
+    }
+  }
+});
```

The source assertions require both platform modifiers; the behavioral browser smoke is
the keyboard oracle for preventing default and producing exactly one submit attempt.

### 9. MODIFY `docs/migration/runtime-test-inventory.md`

The new test imports no runtime module, so `scripts/classify-tests.mjs:20` classifies
it as a contract-only test.

```diff
diff --git a/docs/migration/runtime-test-inventory.md b/docs/migration/runtime-test-inventory.md
--- a/docs/migration/runtime-test-inventory.md
+++ b/docs/migration/runtime-test-inventory.md
@@
-Total: 412 (runtime: 191, contract: 221)
+Total: 413 (runtime: 191, contract: 222)
@@
 - `tests/mobile-composer-tray-contract.test.js`
+- `tests/nai-dual-prompt-contract.test.ts`
 - `tests/nai-ui-registration-contract.test.ts`
```

Do not hand-edit the inventory in implementation. Run
`node scripts/classify-tests.mjs`, inspect this exact generated diff, then run
`npm run test:inventory`.

## i18n key contract

| Key | English | Korean | Other locale action |
|---|---|---|---|
| `nai.positivePrompt.label` | Positive prompt | 포지티브 프롬프트 | Add reviewed ja/zh-Hans/zh-Hant text. |
| `nai.positivePrompt.placeholder` | Describe the subject, scene, style, and details you want… | 원하는 피사체, 장면, 스타일과 세부 요소를 입력하세요… | Add reviewed ja/zh-Hans/zh-Hant text. |
| `nai.positivePrompt.hint` | `{count} characters. Type @ to add a reference.` | `{count}자. @를 입력해 레퍼런스를 추가할 수 있습니다.` | Add reviewed ja/zh-Hans/zh-Hant text and retain `{count}`. |
| `nai.negativePrompt.label` | Existing; unchanged | Existing; unchanged | Existing in the current four dictionaries. Add to future ja. |
| `nai.negativePrompt.placeholder` | Existing; unchanged | Existing; unchanged | Existing in the current four dictionaries. Add to future ja. |
| `nai.negativePrompt.hint` | Modify to include `{count}` and preset relationship. | Modify to include `{count}` and preset relationship. | Modify zh-Hans/zh-Hant; add to future ja. |

`translate` already interpolates `{count}` through its variable formatter at
`ui/src/i18n/index.ts:21`. The all-leaf parity gates are
`tests/i18n-dictionary-contract.test.ts:380` and
`tests/i18n-coverage-contract.test.ts:53`; both currently cover four dictionaries,
not five.

## Accessibility and keyboard contract

1. Use native `<label htmlFor>` for both textareas. The classic positive field gains a
   stable `positive-prompt-${variant}` id; home keeps `home-prompt-input`; negative
   keeps `negative-prompt-${variant}` from
   `ui/src/components/NegativePromptField.tsx:29`.
2. Each NAI textarea receives `aria-describedby` pointing to its visible character
   hint. Do not add `aria-live`: announcing every keystroke would be noisy, and the
   count remains discoverable in the field description.
3. DOM order follows the visual order: positive pane first, negative pane second.
   The same order remains correct when the container query stacks the panes.
4. Do not use positive `tabIndex` values. Native textarea order is sufficient; the
   mobile sheet already owns modal focus handling at
   `ui/src/components/MobileComposeSheet.tsx:67`.
5. Positive classic retains composition, click, change, Escape, and mention handling
   at `ui/src/components/PromptComposer.tsx:381`. Negative receives only change and
   Cmd/Ctrl+Enter handlers.
6. Both key paths call the same surface-specific submit function. Plain Enter never
   meets the modifier guard and therefore remains newline insertion.
7. Focus uses the existing `--focus-ring` token (`ui/src/index.css:78`); no browser
   default-only focus, color-only distinction, or motion is introduced.

## Test plan

| Test file | Status | Exact assertion |
|---|---|---|
| `tests/nai-dual-prompt-contract.test.ts` | NEW | Both composers have provider-conditional dual modifiers; non-NAI uses display-contents/no negative shell; mobile delegates to `PromptComposer`; equal two-column and <=719px stack CSS exists; labels/descriptions/submit wiring exist; mentions are absent from negative; current dictionaries contain both pane contracts. |
| `tests/i18n-dictionary-contract.test.ts` | EXISTING | Every current locale has exactly the English leaf set and every static `t()` key resolves (`tests/i18n-dictionary-contract.test.ts:380` and `tests/i18n-dictionary-contract.test.ts:411`). |
| `tests/i18n-coverage-contract.test.ts` | EXISTING | No component hardcodes user-facing English and all four current dictionaries stay structurally identical (`tests/i18n-coverage-contract.test.ts:53` and `tests/i18n-coverage-contract.test.ts:84`). |
| `tests/nai-client-options-contract.test.ts` | EXISTING | Negative draft persistence, NAI-only payload emission, whitespace omission, and trim behavior remain unchanged (`tests/nai-client-options-contract.test.ts:137` and `tests/nai-client-options-contract.test.ts:237`). |
| `tests/mobile-compose-sheet-accessibility-contract.test.js` | EXISTING | Sheet inertness, focus restoration, tabs, and touch targets remain intact after the nested composer grows (`tests/mobile-compose-sheet-accessibility-contract.test.js:13` and `tests/mobile-compose-sheet-accessibility-contract.test.js:30`). |

Focused red/green command for the implementation cycle:

```bash
node --import tsx --test \
  tests/nai-dual-prompt-contract.test.ts \
  tests/i18n-dictionary-contract.test.ts \
  tests/i18n-coverage-contract.test.ts \
  tests/nai-client-options-contract.test.ts \
  tests/mobile-compose-sheet-accessibility-contract.test.js
```

Red evidence must be captured before production edits: the new contract should fail on
missing dual classes/copy/keyboard wiring. After implementation, reintroduce one defect
at a time locally (remove one dual modifier, one `{count}`, and negative `onSubmit`) to
confirm the corresponding assertion goes red, then restore and rerun green.

## Render-grounding plan

### Fresh service

The CLI accepts its server port through `IMA2_PORT` (`./config.ts:92`) and allows an
intentional second instance with `--force` (`bin/ima2.js:176`). Build the UI first
because `node bin/ima2.js serve` serves `ui/dist`, then use an actually free port:

```bash
cd /Users/jun/Developer/new/700_projects/ima2-gen
cd ui && npm run build && cd ..
lsof -nP -iTCP:3461 -sTCP:LISTEN
IMA2_PORT=3461 node bin/ima2.js serve --force
```

If the `lsof` command returns a listener, choose another explicit port and record it in
the evidence file. Do not stop or reuse the stale 3333 process documented in
`devlog/_plan/260902_studio_surfaces/000_plan.md:38`. No generation request is needed
for layout verification; provider credentials may be absent as long as the persisted
UI provider can be set and the composer renders.

Use the in-app browser QA path against `http://127.0.0.1:3461`, inspect DOM/computed
styles, then capture:

| Screenshot | Viewport and state | Required visual/DOM checks |
|---|---|---|
| `devlog/_plan/260902_studio_surfaces/evidence/010-nai-classic-1280x720.png` | 1280x720, `uiMode=classic`, workspace profile `prompt-studio`, provider NAI, positive and negative sample text. | Bottom composer is >719px; two equal columns; labels/hints visible; neither pane clips; positive focus ring visible. |
| `devlog/_plan/260902_studio_surfaces/evidence/010-nai-home-1280x720.png` | 1280x720, `uiMode=home`, provider NAI. | Two equal home panes; same textarea height/padding/type; footer stays below both panes; no first-viewport overlap. |
| `devlog/_plan/260902_studio_surfaces/evidence/010-oauth-classic-1280x720.png` | 1280x720, same classic profile, provider OAuth. | One original positive pane; original provider/reference placeholder logic; no negative label, empty grid cell, or extra vertical gap. |
| `devlog/_plan/260902_studio_surfaces/evidence/010-nai-mobile-sheet-390x844.png` | 390x844, classic + NAI, compose sheet open on Prompt tab. | Panes stack positive then negative; both textareas and hints fit; sheet body scrolls; Generate remains reachable; no horizontal overflow or focus hidden behind actions. |

For the default 260px desktop sidebar activation path, also switch workspace profile to
`default` at 1280x720 and inspect computed
`grid-template-columns: minmax(0px, 1fr)` on the dual wrapper. A separate screenshot is
optional because the required mobile image already records the same <=719px branch,
but the computed-style observation must be written into the evidence receipt.

Keyboard/render smoke in each NAI surface:

1. Tab from positive to negative and verify visual order equals DOM order.
2. Type `@` in positive classic and verify the menu opens; type `@` in negative and
   verify no menu opens.
3. Press plain Enter in both fields and verify newline insertion.
4. Press Cmd+Enter in both fields on macOS and verify one generation attempt each; use
   Ctrl+Enter once as the cross-platform alias. Cancel before an upstream request if
   credentials/cost are not in scope; source and store boundary evidence is sufficient
   for the shortcut trigger.
5. Toggle NAI -> OAuth -> NAI and verify the negative draft returns.
6. Inspect at light and dark theme if both are available; input boundary and focus ring
   must remain visible against the surrounding surface.

## Verifier matrix

| Command | Reads the change target? | Required interpretation |
|---|---|---|
| `npm run typecheck` | No direct wp2 read. Root `./tsconfig.json:36` excludes `ui` and `tests` at `./tsconfig.json:38`. | Required server/lib regression only; green does not prove this UI. |
| `npm run typecheck:tests` | Yes. `./tsconfig.tests.json:17` includes `tests/**/*.test.ts` at `./tsconfig.tests.json:19`. | Proves the new source contract type-checks. |
| `npm test` | Yes. The runner discovers every test file at `scripts/run-tests.mjs:8`; the new contract reads all TSX/CSS/i18n targets. | Proves source contracts, i18n parity, payload regressions, and the rest of the suite. It does not prove visual layout. |
| `npm run test:inventory` | Reads the new test filename and generated inventory, not product TSX/CSS (`scripts/classify-tests.mjs:24`). | Proves the test is classified and `docs/migration/runtime-test-inventory.md` is fresh. |
| `cd ui && npm run build` | Yes. `ui/tsconfig.app.json` includes `src` at `ui/tsconfig.app.json:21`, and Vite follows CSS/i18n imports. | Proves React/TypeScript/CSS bundle validity; still not a visual oracle. |
| `node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces` | Yes, docs only. The checker rejects bare filename/line citations at `scripts/check-devlog-citations.mjs:15`. | Proves this plan's citation shape, not implementation behavior. |
| Browser screenshots against fresh `node bin/ima2.js serve` | Yes, through rebuilt `ui/dist`. | Required rendered truth for column/stack, focus, overflow, copy, and regression state. |

Run order:

```bash
node --import tsx --test tests/nai-dual-prompt-contract.test.ts tests/i18n-dictionary-contract.test.ts tests/i18n-coverage-contract.test.ts tests/nai-client-options-contract.test.ts tests/mobile-compose-sheet-accessibility-contract.test.js
npm run typecheck
npm run typecheck:tests
npm test
node scripts/classify-tests.mjs
npm run test:inventory
cd ui && npm run build
cd ..
node scripts/check-devlog-citations.mjs devlog/_plan/260902_studio_surfaces
```

## Risks and open questions

1. Locale scope: RESOLVED. wp2 ships on the current four-locale contract; the task
   packet's "five" was a mistake corrected in `000_plan.md`. The Japanese copy
   fragment below stays as a specification for a future localization unit.
2. `ui/src/components/PromptComposer.tsx` is already 499 lines and
   `ui/src/styles/progress-composer.css` is already 637. The TSX diff includes explicit
   line offsets and must remain <=499. The CSS file cannot meet <500 without a broad move;
   do not silently mix that extraction into the feature.
3. The task requests a 720px split threshold while project-wide mobile mode begins at
   800px (`ui/src/hooks/useIsMobile.ts:3`). The design intentionally uses a component
   container threshold of 719px, so the 720-800 mobile-sheet band can remain side by side
   if the sheet is physically wide enough; below 720 it always stacks.
4. Home currently has no @-mention parsing (`ui/src/components/home/HomePromptComposer.tsx:105`).
   This plan preserves that behavior rather than silently adding a second mention system;
   positive-only mention preservation applies to the classic composer where it exists.

## Implementation handoff checklist

- [ ] Locale scope is LOCKED to the four runtime locales (en, ko, zh-Hans, zh-Hant)
  per `devlog/_plan/260902_studio_surfaces/000_plan.md` "Locale correction";
  a Japanese locale is a separate non-goal unit, never a wp2 blocker.
- [ ] Apply only listed product/test/inventory files; preserve user-owned
  `scripts/recording/` reported by the baseline at
  `devlog/_plan/260902_studio_surfaces/000_plan.md:37`.
- [ ] Capture focused RED before implementation.
- [ ] Keep `PromptComposer.tsx` <=499 lines; report exact `wc -l` result.
- [ ] Do not change store, persistence, or payload files.
- [ ] Generate inventory with the owning script rather than hand-editing.
- [ ] Run focused tests, five required verifier commands, and citation check.
- [ ] Build `ui/dist`, start a fresh spare-port service, capture all four required images.
- [ ] Record DOM/computed-style and keyboard/focus observations, not screenshots alone.
- [ ] Stop only when every NAI-DUAL row and activation path has evidence.
