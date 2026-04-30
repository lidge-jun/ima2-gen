# Oracle Audit — CLI Feature Parity Plan

**Date:** 2026-04-29
**Engine:** `oracle --engine browser --model gpt-5-pro`
**Slug:** `cli-parity-audit`
**Bundle:** 30 files, 45,844 tokens
**Verdict:** **NEEDS_FIX**

The plan is directionally useful but not implementation-ready. Several endpoint mappings are wrong, several route-required payload/header details are missing, and Phase 4/5 contain phantom endpoints. The plan has been rewritten phase-by-phase to address all blocking issues below; this file is the audit of record so future readers can see what was fixed and why.

## Topology correction (most important finding)

Original plan claimed `bin/ima2.ts` is a single 406-line switch and proposed splitting to `bin/lib/commands/*`. **This is wrong.** The actual topology is:

- `bin/ima2.ts` — router, ~406 lines, dispatches at lines `389–399`:
  ```ts
  case "gen": case "edit": case "ls": case "show":
  case "ps": case "cancel": case "ping": {
    const mod = await import(`./commands/${command}.js`);
    await mod.default(args.slice(1));
  }
  ```
- `bin/commands/<name>.{ts,js}` — per-command modules. Already exist for `gen`, `edit`, `ls`, `show`, `ps`, `cancel`, `ping`.
- `bin/lib/<helper>.ts` — shared helpers: `args.ts`, `client.ts`, `error-hints.ts`, `files.ts`, `output.ts`, `platform.ts`, `star-prompt.ts`, `storage-doctor.ts`.

**Implication:** New commands extend the existing `bin/commands/<name>.ts` pattern. Add new command files. Add the case branch in `bin/ima2.ts:389–399`. Do **not** introduce a parallel `bin/lib/commands/*` tree.

Existing `gen.ts`/`edit.ts` already include `--mode auto|direct`, `--moderation`, `--model`, `--session <id>` (style-sheet), `--ref` (repeatable), `-q`, `-s`, `-n`, `-o`, `--out-dir`, `--json`, `--no-save`, `--stdin`, `--timeout`, `--server`, `--force`, `-h`. So Phase 1's "add `--mode`" was a phantom — the flag exists. The genuine gaps are `--reasoning-effort` and `--web-search` / `--no-web-search`.

## Per-phase blocking issues (from Oracle, all verified locally)

### Phase 1

- **HIGH** `ls --session` was wrong query key. Route reads `sessionId`: `routes/history.ts:18,43–44`. Fixed.
- **HIGH** `--favorites` and `--include-deleted` are not server-supported filters. `/api/history` only parses `limit`, `before`, `beforeFilename`, `since`, `sessionId`, `groupBy`: `routes/history.ts:12–21`. Removed from plan; `--favorites` reduced to client-side filter on `isFavorite` field.
- **HIGH** `show --metadata` proposed `{ filename }`, but `/api/metadata/read` requires `{ dataUrl }` (base64 data URL): `routes/metadata.ts:14–24`. Fixed: read local file → encode → POST.
- **MED** `--mode auto|direct` was claimed missing but already exists in `bin/commands/gen.ts:26` and `edit.ts:21`. Removed.
- **MED** Plan said server default is now `none`; attached `config.js:154` shows `medium` (the default was reverted). `validReasoningEfforts` does include `none` at `config.js:155`. Plan no longer claims the default state.

### Phase 2

- **HIGH** `session style-sheet patch` claims `PATCH /api/sessions/:id/style-sheet` — phantom. Actual route is only `PATCH /api/sessions/:id/style-sheet/enabled` (boolean toggle): `routes/sessions.ts:151–170`. Renamed and re-scoped.
- **HIGH** `session graph save` omitted `If-Match` header. `PUT /api/sessions/:id/graph` requires `If-Match`, returns 428 when missing, and validates finite version: `routes/sessions.ts:229–254`. Added GET-version-first + If-Match flow.
- **MED** `session create`/`rename` send `title`, not `name`: `routes/sessions.ts:34,62–68`. Fixed.
- **HIGH** `history restore <filename>` underspecified. Required body `{ trashId }`: `routes/history.ts:111–116`. Fixed: `--trash-id` flag.
- **MED** `history favorite --unset` not supported. Endpoint toggles based on current state and requires `X-Ima2-Browser-Id`: `routes/history.ts:123–149`. Plan now documents toggle-only with header.
- **MED** `history import` posts raw bytes via `express.raw`, not base64 JSON: `routes/imageImport.ts:14–20`. Fixed: send file buffer with `Content-Type: image/png` plus `X-Ima2-Original-Filename` header.

### Phase 3

- **HIGH** Prompt fields are `name`/`text`/`tags`/`folderId`/`mode`, not `title`/`body`: `routes/prompts.ts:65–80,106–114`. Fixed.
- **HIGH** `prompt export --folder` is phantom; export ignores folder query and exports all non-trash entries: `routes/prompts.ts:232–254`. Removed flag.
- **HIGH** Import flow's apply step is `POST /api/prompts/import/commit`, not legacy `POST /api/prompts/import`: `routes/promptImport.ts:336–354`. Fixed.
- **MED** `prompt favorite --unset` is toggle-only: `routes/prompts.ts:147–160`. Same as history.
- **MED** Free-text search exists via `GET /api/prompts?search=`: `routes/prompts.ts:18,36–39`. Added `prompt ls --search`.

### Phase 4

- **HIGH** Multimode SSE emits `image` events (full data URL), not progressive base64 chunks; events: `phase`, `partial`, `image`, `done`, `error`: `routes/multimode.ts:146,158–164,222,227,262`. Fixed: parser handles `image` and treats `partial` as text status, not bytes.
- **HIGH** Canvas versions endpoints are only `POST /api/canvas-versions` (collection) and `PUT /api/canvas-versions/:filename`. No GET, no DELETE, no restore: `routes/canvasVersions.ts:24,44`. Plan now exposes only `save` and `update` commands.
- **MED** Node SSE conditional on `Accept: text/event-stream` header: `routes/nodes.ts:25,61`. Documented.
- **MED** Annotations require `X-Ima2-Browser-Id` header: `routes/annotations.ts:42,59,84`. Documented.
- **MED** `metadata` reads local file, builds data URL, posts: `routes/metadata.ts:22–24`. Fixed.

### Phase 5

- **HIGH** `cardnews jobs ls` is phantom. Only `POST /api/cardnews/jobs` (create) and `GET /api/cardnews/jobs/:jobId`: `routes/cardNews.ts:127–143`. Removed; replaced with `cardnews jobs show <id>` only.
- **HIGH** Card News gate is in `routes/index.ts:30`, controlled by `ctx.config.features.cardNews`; configured via `IMA2_CARD_NEWS`, `config.json` `features.cardNews`, or default `IMA2_DEV === "1"`: `config.js:161–162`. Plan now checks `runtimeConfig.features.cardNews`, not the previously-claimed `cardNewsEnabled`.
- **HIGH** `storage open` is `POST /api/storage/open-generated-dir`, not GET: `routes/storage.ts:13–23`. Fixed.
- **MED** Observability endpoints all live in `routes/health.ts`, not separate route files: providers `:18`, oauth `:43`, inflight `:65,84`, billing `:89`. Documented.
- **HIGH** `config get/set` is realistic only with caveats: `config.js` loads once at module import (`config.js:7–9`); file changes need server restart. Auth settings share the same `CONFIG_FILE` (`bin/ima2.ts:22–45`). Plan now explicitly redacts `provider`/`apiKey`/oauth tokens and warns about restart.

## Missing endpoints the plan didn't cover

Added to relevant phases:

- `DELETE /api/history/:filename/permanent` → Phase 2 (`history rm --permanent`).
- `PATCH /api/sessions/:id/style-sheet/enabled` → Phase 2 (`session style-sheet enable/disable`).
- `GET /api/prompts/import/discovery` → Phase 3 (`prompt import discovery list`).
- `POST /api/prompts/import/discovery-review` → Phase 3.
- `POST /api/prompts/import/curated-refresh` → Phase 3.
- `POST /api/prompts/import/commit` → Phase 3 (the actual apply step).
- `POST /api/storage/open-generated-dir` → Phase 5.
- Card News additional surface (`image-templates/preview`, `sets/:id/manifest`, `draft`, `jobs/:id/retry`, `cards/:id/regenerate`, `export`) → Phase 5 (cherry-picked, not all are CLI-suitable).

## Phase ordering / dependency

- Phase 1 may proceed independently — only patches existing `bin/commands/{gen,edit,ls,show}.ts`. No router change.
- Phase 2 onward each adds a new branch in the `bin/ima2.ts:389–399` switch and a new `bin/commands/<name>.ts` file.
- No cross-phase blockers besides shared helpers in `bin/lib/` (which Phase 4 extends with `bin/lib/sse.ts`).

## Backend audit (PABCD A phase, 2026-04-29)

A second pass by the Backend employee (against the just-rewritten plan) caught additional body-shape errors Oracle's pass missed because Oracle didn't read the route handler body destructuring as carefully:

- **Phase 1**: stale citation `routes/metadata.ts:14` → corrected to `:22-24` (route starts at L22).
- **Phase 2 (HIGH)**: `POST /api/history/favorite` only takes `{ filename }` (server toggles based on `gallery_favorites` table at `routes/history.ts:138`). Earlier draft sent `{ filename, isFavorite: !current }` with a pre-read. Fixed: send `{ filename }` only, read `result.isFavorite` from response.
- **Phase 2 (MED)**: `PUT /api/sessions/:id/graph` returns `{ ok, nodes, edges, graphVersion }` (`routes/sessions.ts:270`), not `{ version }`. Fixed.
- **Phase 3 (HIGH)**: prompt import body shapes were fabricated. Real shapes from `routes/promptImport.ts`:
  - `curated-search` `{ q, sourceIds, limit }` not `{ source, query }`
  - `curated-refresh` `{ sourceId }` not `{ source }`
  - `discovery-search` `{ q, seeds, limit }` not `{ source, query }`
  - `discovery-review` is a per-repo curator action `{ repo, status, reviewNotes, allowedPaths, defaultSearch }` — removed from CLI flow entirely
  - `folder-files`, `folder-preview`, `preview` use opaque `buildFolderFiles/buildFolderPreview/buildPreview(req, ctx)` helpers — flagged as needing impl-time investigation
  - `commit` body confirmed `{ candidates, folderId? }`
- **Phase 3 (MED)**: `GET /api/prompts` only supports `search`, `folderId`, `favoritesOnly` (`routes/prompts.ts:18-21`). `mode`/`limit`/`offset` removed.
- **Phase 3 (MED)**: prompt folder delete strategy is `deleteItems` or default `moveToRoot` (`routes/prompts.ts:336`). Earlier draft used `move|delete`; CLI now aliases.
- **Phase 4 (MED)**: canvas-versions reads `?sourceFilename=` query OR `X-Ima2-Canvas-Source-Filename` header plus prompt via `getPrompt(req)` (`routes/canvasVersions.ts:24-34, 44-54`). Earlier draft proposed unsupported `X-Ima2-Save-Reason`. Fixed.

All these fixes are now reflected in the respective phase files. Audit verdict: **PASS** post-fix; ready for Phase B implementation.

## How the plan was rewritten

Each `PHASE-*.md` now contains:

1. Verified endpoint table with `routes/*.ts:line` citations.
2. Exact `bin/commands/<name>.ts` SPEC blocks (matches the existing `gen.ts` style).
3. Before/after diffs for files that already exist (`gen.ts`, `edit.ts`, `ls.ts`, `show.ts`, `ima2.ts`).
4. Required headers/body shapes per command.
5. Tests with explicit assertion text.
6. Removed phantom commands and added missing ones from the audit list.
