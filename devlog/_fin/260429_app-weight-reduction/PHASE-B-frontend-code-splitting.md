# Phase B - Frontend Code Splitting

## Goal

Reduce initial browser parse/execute cost by loading heavy UI surfaces only when
the user opens them.

## Current Risk

The current frontend appears to ship most feature surfaces in one Vite entry
chunk. Recent feature additions are valuable, but they should not all tax the
default generation screen.

Likely split candidates:

| Surface | Why Split |
|---|---|
| Node Canvas | Mode-gated surface with React Flow. Safest high-impact first runtime split. |
| Card News Workspace | Dev-only/advanced workflow, not default generation path. |
| PromptLibraryPanel | Card-news-adjacent panel imported eagerly from `App.tsx`; should not tax default path if hidden. |
| Settings Workspace | Secondary surface; can load on demand after mode-level splits. |
| Prompt Import Dialog | Dialog-only workflow with GitHub/folder/discovery helpers. |
| Prompt Discovery | Network/search UI not needed for normal prompt entry. |
| Canvas Mode internals | Large annotation/background/export helpers, but `Canvas.tsx` is default classic surface, so split internals later. |

## Proposed Changes

### B.0 - Measurement Guard

1. Establish a bundle/chunk measurement guard before claiming wins.

   Options:

   - enable a test-only Vite manifest;
   - parse build output robustly without relying on hashed filenames;
   - record entry JS/CSS sizes before and after.

2. Track CSS separately. Lazy JS alone may not reduce the global CSS output if
   most styles remain in shared stylesheets.

### B.1 - Lowest-Risk Runtime Split

1. Lazy-load:

   - `NodeCanvas`;
   - `CardNewsWorkspace`;
   - `PromptLibraryPanel`.

2. Keep local `Suspense` boundaries around the central workspace, not the whole
   app shell.

### B.2 - Secondary Surface Split

1. Lazy-load:

   - `SettingsWorkspace`;
   - `PromptImportDialog`.

2. Split `PromptImportDiscoverySection` from the import dialog if discovery is a
   non-default tab/action.

### B.3 - Canvas Mode Internals

Do not lazy-load `Canvas.tsx` wholesale. Classic mode uses `Canvas` as the
default central surface, so whole-component lazy loading may only add a fetch
without meaningfully improving the default workflow.

Instead, split internals that are only needed after `canvasOpen` or after a
specific Canvas action:

- annotation toolbar/layer surfaces;
- background cleanup panel and helpers;
- mask/export/merge helpers;
- minimap and Canvas Mode-only controls.

## Implementation Rules

1. Introduce lazy boundaries with meaningful fallbacks.

   Use `React.lazy` and `Suspense` for mode-level and dialog-level surfaces.
   Prefer splitting by actual user workflow, not by arbitrary file size.

2. Keep store and route contracts stable.

   Lazy loading must not change saved graph/session/history behavior.

3. Avoid lazy-loading tiny primitives.

   Split large surfaces only. Shared buttons, inputs, and small controls should
   remain normal imports to avoid over-fragmentation.

4. Add bundle guard.

   Add a lightweight contract that reads Vite build output or manifest if
   feasible, and asserts that major lazy surfaces produce separate chunks.

## Candidate Files

- `ui/src/App.tsx`
- `ui/src/components/Canvas.tsx`
- `ui/src/components/NodeCanvas.tsx`
- `ui/src/components/PromptImportDialog.tsx`
- `ui/src/components/PromptImportDiscoverySection.tsx`
- `ui/src/components/SettingsWorkspace.tsx`
- `ui/src/components/card-news/CardNewsWorkspace.tsx`
- `ui/vite.config.ts`
- new or updated bundle/code-splitting contract tests

## Acceptance

```bash
npm run build
npm test
```

Pass criteria:

- default app entry still renders the classic generation workflow;
- Canvas Mode still opens and saves correctly;
- Node Mode still opens and saves graph state correctly;
- Prompt Import dialog still opens on demand;
- Settings still opens on demand;
- Card News remains dev-only and loads only when surfaced;
- Vite output shows separate chunks for at least Node/Card News/Prompt Import or
  equivalent high-impact surfaces;
- entry path no longer contains obvious Node/Card News markers after their split;
- CSS size is measured separately from JS size.

## Risks

- Lazy-loaded components can break if they rely on eager side effects.
- Suspense fallback placement can cause layout jumps.
- Store selectors should remain outside lazy modules when global state must be
  available before the component loads.
- A value import from a lazy module can silently pull it back into the entry
  chunk; keep shared contracts type-only where possible.
- The monolithic `useAppStore` may cap savings if heavy feature logic remains in
  eager store modules.
