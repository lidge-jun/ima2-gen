# wp4 — GUI vectorize surface

## Design Read (cxc-dev-uiux-design)

```yaml
---
name: ima2-gen vectorize panel
colors:
  primary: "var(--accent)"      # inherited, no new brand color
  background: "var(--panel)"
typography:
  heading: { fontFamily: inherited, fontSize: 13px }
  body: { fontFamily: inherited, fontSize: 12px }
iconography:
  system: "existing in-repo set"
  domain: "library-subset"
---
```

Reading this as: an expert tool panel inside a local creative workstation, for a
repeat user who already knows what tracing is. The vocabulary is a darkroom control
strip — dense, immediate, no ceremony.

Do: reuse KeyingPanel's exact control grammar so the two derived actions feel like
siblings. Don't: invent a new panel chrome, add motion, or hide the parameters
behind a wizard.

### Dials

```
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 1
Product density profile: D5
Reasoning: expert repeated-work tool inside an existing dense workspace; the
domain gate forbids the expressive default kit, and the correct move is to
inherit established vocabulary rather than introduce a second visual language.
```

UX-CONCEPT-GEN-01 is **skipped deliberately**: this is not a brand-visible or
expressive surface, it is a utility control panel governed by an existing design
system (KeyingPanel + `assetgen-workspace.css`). The skill's own decision tree
exempts utility surfaces under a governing system.

### Lazy-User Gate (UX-LAZY-01)

Three numeric knobs would be three decisions on a surface that should have one
primary action. Applying do-nothing / absorb / demote:

- **Primary action:** one button, "SVG로 변환". A correct default (`auto` preset,
  measured best) means the user can ignore every parameter.
- **Demote:** `colorPrecision` / `filterSpeckle` / `cornerThreshold` live inside
  `<details class="vectorize-panel__advanced">`, collapsed at rest — exactly how
  KeyingPanel demotes its own advanced controls.
- **Absorb:** the system picks the preset; the user does not learn VTracer's enum.

### UX states (UX-STATE-01)

| State | Treatment |
|-------|-----------|
| idle | source thumbnail + preset segmented control + primary button |
| loading | indeterminate — button label swaps to "변환 중…", controls disabled. Matches the existing keying save pattern; measured trace is under 1 s so a progress bar would be dishonest chrome |
| success | result preview + `pathCount` / size readout + download + "프로젝트에 저장됨" toast |
| error | inline `role="alert"` message reusing `.keying-panel__save-error` styling; the panel stays open so parameters can be adjusted and retried — never a dead end |
| empty | not reachable: the panel only opens with a target asset |

## NEW `ui/src/components/assetgen/VectorizePanel.tsx` (~230 lines)

Mirrors KeyingPanel's lifecycle exactly (verified at
`ui/src/components/assetgen/KeyingPanel.tsx:199-278`):
`saving` guard against double submit, `targetFilenameRef` guard so a late response
cannot apply to a switched target, `filePath` validation, `addDerivedItem`, toast,
`.finally()` release.

Differences forced by the medium:
- No canvas pipeline. The source is not decoded client-side; the server reads it.
- Result preview is `<img src={/generated/...svg}>` — a passive embedding context
  where SVG scripts do not execute (defense in depth alongside the generator).
- Download targets the returned SVG URL with a `.svg` filename, not `canvas.toBlob`.

Store wiring: add `vectorizeTarget` alongside the existing `keyingTarget` in the
assetgen store slice, so both derived actions are peers rather than one hijacking
the other's target.

## MODIFY `ui/src/components/assetgen/AssetGenWorkspace.tsx`

Mount as an overlay sibling next to `<KeyingPanel />`
(`ui/src/components/assetgen/AssetGenWorkspace.tsx:271-272`), not inside
`assetgen-results`. Entry point: a tile action button beside the existing
`assetgen-tile__key`, plus the lightbox footer button beside `assetgen-lightbox__keybtn`.

### Source-text contract blast radius (audit blocker 7)

This repo asserts exact JSX strings in tests, so additive edits near them are fragile:

| Test | Asserts |
|------|---------|
| `tests/asset-gen-media-lightbox-contract.test.js:17-19` | exact `className="assetgen-tile__key" onClick={() => setKeyingTarget(item)}` and the exact `previewItem ? <AssetMediaLightbox .../>` line |
| `tests/ui-glyph-policy.test.ts` | repo-wide glyph ban — the new panel must use no emoji/decorative glyphs |
| `tests/i18n-coverage-contract.test.ts:84` | no hardcoded user-facing English in TSX |
| `tests/a11y-touch-target-contract` family | touch-target sizing for new buttons |

Commitment: add the new controls WITHOUT reflowing those asserted lines — insert
siblings rather than reformatting existing JSX. If a line must change, update its
assertion knowingly in the same commit.

`ui/src/components/assets/AssetsWorkspace.tsx:137-150` mounts KeyingPanel the same
way; wiring the vectorize panel there too is **deferred** and recorded as follow-up so
wp4 stays one reviewable surface.

## MODIFY `ui/src/styles/assetgen-workspace.css`

Reuse the control grammar verbatim (`auto-fit minmax(150px,1fr)` grid, 12px dim
labels, emphasized `output`, full-width range, bordered `details`). Add
`.vectorize-panel__*` rules that mirror `.keying-panel__*` rather than restyling.
No new tokens, no new radii, no animation.

## MODIFY i18n — **4 locales, not 5**

Verified: `ui/src/i18n/index.ts` declares `SUPPORTED_LOCALES` as `ko`, `en`,
`zh-Hant`, `zh-Hans`. (The goal text's "5 locales" was wrong; corrected here.)
`tests/i18n-coverage-contract.test.ts:53-65` flattens every locale and requires an
exact key-set match with English, so all four change together.

New top-level `"vectorize"` sibling of `"keying"`:
`title, open, preset, presetAuto, presetFlat, presetDetailed, presetMono,
colorPrecision, filterSpeckle, cornerThreshold, advanced, reset, run, running,
download, save, saved, saveError, loadError, resultPaths, resultSize, hint`.

Korean copy is written natively (no translationese, no emoji — the skill's emoji ban
is STRICT for UI). `hint` states the honest boundary: cutouts and flat art trace
well, photos and small text do not.

The same test also fails on hardcoded user-facing JSX text, so every string in the
new component must come from `t()`.

## Accept criteria

- `cd ui && npm run build` exits 0; `npm test` i18n contract green across 4 locales.
- C-RENDER-GROUNDING-01: the panel is rendered in a real browser at 1280x720,
  screenshotted, **read back**, and the screenshot persisted into this unit's
  `evidence/` directory.
