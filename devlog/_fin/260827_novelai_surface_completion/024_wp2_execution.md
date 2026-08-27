# 024 — wp2 execution record

## RED

After adding behavior-first panel/i18n assertions, the focused suite reported 28
tests: 27 pass, 1 fail. Failure: `autoSmea has no setter wiring`, proving the previous
green suite could not see the missing UI.

## GREEN

- `NaiControlsPanel.tsx`: Auto SMEA beside Noise Schedule; Decrisper after CFG
  Rescale; existing native checkbox row/help grammar reused.
- Four locale dictionaries: four matching leaves each.
- Effective-node test values include both booleans. A V4.5 node keeps them while
  continuing to strip only V5 Alpha/Quality.
- Focused suite: 28 pass / 0 fail.
- `npm run typecheck`: exit 0.
- `npm run typecheck:tests`: exit 0.
- `cd ui && npm run build`: 619 modules, exit 0; existing chunk/dynamic-import
  warnings only.
- Panel length: 260 lines; no extraction or CSS change needed.
- Render evidence: `023_wp2_render_evidence.md`.
