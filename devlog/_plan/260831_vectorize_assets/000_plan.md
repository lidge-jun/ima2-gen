# 260831 — Raster-to-Vector (SVG) Asset Export

Objective: give the Asset Maker a real vector output path. Today every asset
terminates as raster PNG; `routes/assetDerived.ts` hardcodes
`DERIVED_KINDS = ["keyed-png"]` and `ui/src/lib/canvas/svgExport.ts` only wraps a
raster `<image>` in SVG chrome — it does not trace pixels.

## Constraints

- Node >= 22 (`package.json` `engines`), ES modules, file < 500 lines, function < 50
  lines, try/catch on all async.
- No Python. Pillow cannot trace bitmaps; `sharp` is already the raster tool.
- Additive only: existing `keyed-png` behavior must not change.

## Library decision

`@neplex/vectorizer@0.1.0` (VTracer core, Rust via NAPI-RS). Measured in-session,
not assumed:

| Input | Preset | ms | opt bytes | paths |
|-------|--------|----|-----------|-------|
| keyed character 1254x1254 RGBA | Bw | 37 | 64,338 | 12 |
| keyed character 1254x1254 RGBA | Photo | 845 | 598,990 | 722 |
| keyed character 1254x1254 RGBA | Poster | 937 | 1,359,552 | 4,993 |

Rendered back through sharp and visually compared: Photo is near-indistinguishable
from Poster at **6.9x fewer paths**, so Photo is the default. Alpha survives —
transparent regions emit no paths and no background rect is written.

Rejected alternatives: `potrace` (monochrome only, no color tracing),
`imagetracerjs` (pure JS, stalled at 1.2.6, fragments on complex input).

### Platform / supply chain

- `hasInstallScript=false` for the package and all 14 platform binaries, which are
  `optional` prebuilds, and the published `scripts` block has no
  `preinstall`/`install`/`postinstall` (`prepare: husky` does not run for
  registry-installed deps). So `allowScripts` is **expected** to need no new approval.
  `check-install-policy.mjs` has a SECOND oracle — a `binding.gyp` probe of the
  installed tree plus npm's own pending list via `--npm-pending` (CI runs
  `test:install-policy:npm12`) — which can only be proven **after** `npm install`.
  wp2 re-verifies at install time; if npm surprises us the fix is a one-line
  `allowScripts` entry.
- `npm run test:native-deps` currently requires `better-sqlite3` and `sharp` only.
  We extend it to require the vectorizer so a missing prebuild fails loudly.
- Verified installed `@neplex/vectorizer-darwin-arm64` on Node 24 / arm64.

## Honest capability boundary

Tracing is excellent for keyed cutouts, flat icons, logos, and sprite art. It
degrades on photographic gradients and small text (observed: UI-screenshot text
became illegible smudges). The feature is presented as a cutout/flat-art tool.
We do not claim universal conversion.

## Security posture (decided, from the serve audit)

`./server.ts:280-286` static-serves the generated dir and only blocks `.json`.
`send` sets `Content-Type` from mime-db, so `.svg` would be served as
`image/svg+xml` — an active document, i.e. stored XSS on same-origin top-level
navigation. Our SVG is machine-generated (paths + fills only), but the file lands
in a directory that also accepts user-controlled names.

The `<img>` claim is true per the HTML spec — SVG loaded via `<img>` runs no scripts
and loads no external resources. But the executing surfaces are top-level navigation,
`window.open`, and iframe, and the audit found `/generated` sits **outside** the LAN
token guard, which only covers `/api` (`./server.ts:252`). There is no CSP or
`X-Content-Type-Options` anywhere in the server today.

Decision (three layers, not one promise):
1. The writer emits only `<svg>/<path>/<g>` markup; tests assert no `<script`, `on*=`,
   `<foreignObject`, or `javascript:` can appear in output.
2. **wp3 adds a serving-layer header** so the guarantee does not depend on writer
   discipline: for `.svg` under `/generated`, set
   `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` and
   `X-Content-Type-Options: nosniff`. This neuters script execution even in a
   navigation context, and protects any FUTURE `.svg` writer with weaker discipline.
3. A dedicated attachment endpoint remains follow-up, not built here.

## Work-phase map (dependency ordered)

| Phase | Doc | Consumes |
|-------|-----|----------|
| wp2 core | `010_core_vectorize_lib.md` | — |
| wp3 route | `020_route_vector_svg.md` | wp2 |
| wp4 GUI | `030_gui_vectorize_panel.md` | wp3 |
| wp5 CLI + docs | `040_cli_and_skill_docs.md` | wp3 |

## SoT sync targets (SOT-SYNC-01)

`structure/01-file-function-map.md` (also missing `routes/assetDerived.ts` today),
`structure/02-command-reference.md`, `structure/03-server-api.md`,
`docs/API.md` + zh-CN/zh-TW, `docs/CLI.md`, `skills/ima2/SKILL.md`.

## Verifier commands (PLAN-VERIFIER-REAL-01 — each RUN before writing this plan)

| Command | Exit | Reads our target? |
|---------|------|-------------------|
| `npm run typecheck` | 0 | yes — `tsconfig.json` includes `lib/**`, `routes/**` |
| `npm run typecheck:tests` | 0 | yes — covers `tests/**` |
| `npm test` | 0 | yes — new `tests/vectorize-*.test.ts` glob |
| `cd ui && npm run build` | 0 | yes — compiles the new panel TSX |
| `npm run test:inventory` | 0 | yes — classifies new runtime-importing test files |
| `npm run test:install-policy` | 0 | yes — reads package-lock install scripts |

## Out of scope

Video pipeline, provider/OAuth, sprite atlas internals, `site/`, ComfyUI bridge,
adding SVG to provider/reference MIME maps (explicitly unsafe per finding 18),
local SVG upload/import (finding 14).
