# Phase 3 — Prompt Library

## Goal

Surface the prompt library (CRUD + folders + import) to the CLI. Largest single domain — 21 endpoints across `routes/prompts.ts` and `routes/promptImport.ts` — currently zero CLI representation.

## Verified endpoint table

### Core (`routes/prompts.ts`)

| Endpoint | Line | Body fields | Notes |
|---|---:|---|---|
| `GET /api/prompts` | 15 | query: `folderId`, `search`, `favoritesOnly` (`1` or `true`) | server filters; `mode`/`limit`/`offset` are NOT supported |
| `POST /api/prompts` | 63 | `{ name?, text, tags?, folderId?, mode? }` | **`text` required**, `name` defaults to first 30 chars of text |
| `GET /api/prompts/:id` | 91 | — | |
| `PATCH /api/prompts/:id` | 103 | partial of `{ name, text, tags, folderId, mode }` | |
| `DELETE /api/prompts/:id` | 132 | — | |
| `POST /api/prompts/:id/favorite` | 147 | toggles based on current state | no body |
| `POST /api/prompts/import` | 170 | legacy bulk import (not used by new flow) | retained for backcompat |
| `GET /api/prompts/export` | 232 | — | dumps **all** non-trash prompts + folders. **No `folderId` filter** |
| `GET /api/prompts/folders` | 260 | — | |
| `POST /api/prompts/folders` | 271 | `{ name }` | |
| `PATCH /api/prompts/folders/:id` | 301 | `{ name }` | rename |
| `DELETE /api/prompts/folders/:id` | 333 | optional `?strategy=move\|delete` | |

### Import (`routes/promptImport.ts`)

| Endpoint | Line | Body | Notes |
|---|---:|---|---|
| `GET /api/prompts/import/curated-sources` | 221 | — | list available sources |
| `GET /api/prompts/import/discovery` | 230 | — | list discovery providers |
| `POST /api/prompts/import/discovery-search` | 242 | `{ q, seeds, limit }` (server caps `seeds.length` at `discoveryMaxQueries`) | GitHub-discovery search |
| `POST /api/prompts/import/discovery-review` | 262 | `{ repo, status, reviewNotes, allowedPaths, defaultSearch }` | **per-repo curator review action**, not a general "preview" step. Skip in CLI unless explicitly building admin tooling. |
| `POST /api/prompts/import/curated-search` | 278 | `{ q, sourceIds, limit }` | search curated set |
| `POST /api/prompts/import/curated-refresh` | 292 | `{ sourceId }` (string, required) | refresh curated cache |
| `POST /api/prompts/import/folder-files` | 306 | opaque (handled by `buildFolderFiles(req, ctx)`) — see `lib/promptImport*.ts` for actual shape; investigate at impl time | enumerate files in local folder |
| `POST /api/prompts/import/folder-preview` | 316 | opaque (`buildFolderPreview(req, ctx)`) | preview parsed prompts |
| `POST /api/prompts/import/preview` | 326 | opaque (`buildPreview(req, ctx)` — likely takes a source/text payload, NOT raw `candidates`) | preview before commit |
| `POST /api/prompts/import/commit` | 336 | `{ candidates: [...], folderId? }` | **the actual apply step**; caps at `limits.maxPromptCandidatesPerImport` |

## Removed / corrected from earlier draft

- **Phantom**: `prompt export --folder <id>` — server ignores; export is full-dump only. Flag removed.
- **Wrong fields**: earlier draft used `--title`/`--body`. Server fields are `name`/`text` (`prompts.ts:65`). Renamed.
- **Wrong import flow**: earlier draft applied via `POST /api/prompts/import` (legacy). New flow uses `POST /api/prompts/import/commit` (`promptImport.ts:336`). Fixed.
- **Missing**: `prompt ls --search <q>` — server supports it (`prompts.ts:18`). Added.
- **Missing**: `prompt import discovery list`, `discovery review`, `curated refresh` — added.

## New file: `bin/commands/prompt.ts` (multiplexer)

Same subcommand pattern as `session.ts`. Estimated 350-450 lines; if exceeds 500, split into `bin/commands/prompt-core.ts`, `prompt-folder.ts`, `prompt-import.ts` and dispatch from `prompt.ts`.

### Subcommand → endpoint table

| CLI | Endpoint | Body |
|---|---|---|
| `prompt ls [--folder <id>] [--search <q>] [--favorites] [--json]` | `GET /api/prompts?folderId=...&search=...&favoritesOnly=1` | — |
| `prompt show <id> [--json]` | `GET /api/prompts/:id` | — |
| `prompt create --text <t\|@file\|-> [--name] [--folder] [--tag <t>... ] [--mode]` | `POST /api/prompts` | `{ name?, text, tags?, folderId?, mode? }` |
| `prompt edit <id> [--name] [--text <t\|@file\|->] [--folder] [--tag] [--mode]` | `PATCH /api/prompts/:id` | partial |
| `prompt rm <id> [--yes]` | `DELETE /api/prompts/:id` | — |
| `prompt favorite <id>` | `POST /api/prompts/:id/favorite` | toggle, no body |
| `prompt export [-o <file>]` | `GET /api/prompts/export` | full dump (no filter) |
| `prompt folder ls` | `GET /api/prompts/folders` | — |
| `prompt folder create <name>` | `POST /api/prompts/folders` | `{ name }` |
| `prompt folder rename <id> <name>` | `PATCH /api/prompts/folders/:id` | `{ name }` |
| `prompt folder rm <id> [--strategy move\|delete] [--yes]` | `DELETE /api/prompts/folders/:id?strategy=<deleteItems\|moveToRoot>` | CLI alias maps `delete→deleteItems`, `move→moveToRoot` (default). Server only honors `deleteItems`; everything else falls back to `moveToRoot`. |
| `prompt import sources` | `GET /api/prompts/import/curated-sources` + `GET /api/prompts/import/discovery` (combined view) | — |
| `prompt import curated --source <id> [-q <query>] [--limit <n>] [--dry-run] [--folder <id>]` | `curated-search` → `preview` (if needed) → `commit` | multi-step; see flow |
| `prompt import discovery -q <query> --seed <s>... [--limit <n>] [--dry-run] [--folder <id>]` | `discovery-search` → `commit` | multi-step; **skips `discovery-review`** (curator-only action) |
| `prompt import folder <path> [--dry-run] [--folder <id>]` | `folder-files` → `folder-preview` → `commit` | multi-step; body shapes opaque, investigate at impl time |
| `prompt import refresh --source <id>` | `POST /api/prompts/import/curated-refresh` | `{ sourceId: <id> }` |

### `--text` argument convention

Reuse the existing pattern from `bin/lib/files.ts`:

- `--text "literal string"` → use as-is
- `--text @path/to/file.txt` → read file
- `--text -` → read stdin (uses `readStdin()` from `bin/lib/files.ts`)

```ts
async function resolveText(value) {
  if (!value) return null;
  if (value === "-") return await readStdin();
  if (value.startsWith("@")) return await readFile(value.slice(1), "utf-8");
  return value;
}
```

### Tags convention

Repeatable flag (consistent with `gen --ref`):

```ts
SPEC.flags.tag = { type: "string", repeatable: true };
// tag values become args.tag = [...]
```

## Multi-step import flow (the only non-trivial part)

### Curated import

`curated-search` returns `{ candidates: [...] }` (each candidate is already commit-ready). The optional `preview` step is for re-checking candidates against per-server limits before commit. CLI runs `curated-search → commit`, with `--dry-run` short-circuiting before commit.

```ts
async function importCurated({ sourceId, q, limit, dryRun, folderId }) {
  const server = await resolveServer({});
  // 1) search
  const search = await request(server.base, "/api/prompts/import/curated-search", {
    method: "POST",
    body: {
      q: q || "",
      sourceIds: sourceId ? [sourceId] : undefined,
      ...(limit ? { limit } : {}),
    },
  });
  const candidates = search.candidates || [];
  if (candidates.length === 0) { out("(no candidates)"); return; }
  out(`${candidates.length} candidates`);
  if (dryRun) { json({ candidates }); return; }
  // 2) commit
  const result = await request(server.base, "/api/prompts/import/commit", {
    method: "POST",
    body: { candidates, folderId },
  });
  out(`✓ imported ${result.imported || candidates.length}`);
}
```

### Discovery import

`discovery-search` returns `{ candidates }` directly (server combines query + seed list into a GitHub query). `discovery-review` is a per-repo CURATOR action (sets repo status, allowed paths) — **not** part of the normal import flow. CLI does NOT call it.

```ts
async function importDiscovery({ q, seeds, limit, dryRun, folderId }) {
  if (!q) die(2, "-q <query> required");
  if (!seeds?.length) die(2, "--seed <repo>... required (at least 1)");
  const server = await resolveServer({});
  const result = await request(server.base, "/api/prompts/import/discovery-search", {
    method: "POST",
    body: { q, seeds, ...(limit ? { limit } : {}) },
  }, { timeoutMs: 120_000 });
  const candidates = result.candidates || [];
  if (candidates.length === 0) { out("(no candidates)"); return; }
  if (dryRun) { json({ candidates }); return; }
  const commit = await request(server.base, "/api/prompts/import/commit", {
    method: "POST",
    body: { candidates, folderId },
  });
  out(`✓ imported ${commit.imported || candidates.length}`);
}
```

### Folder import

```ts
async function importFolder(localPath, { dryRun, folderId }) {
  const server = await resolveServer({});
  const files = await request(server.base, "/api/prompts/import/folder-files", {
    method: "POST", body: { path: localPath },
  });
  const preview = await request(server.base, "/api/prompts/import/folder-preview", {
    method: "POST", body: { files: files.files },
  });
  if (preview.candidates.length > 100 && !dryRun) {
    if (!await confirmYes(`import ${preview.candidates.length} prompts?`)) return;
  }
  if (dryRun) { json(preview); return; }
  const result = await request(server.base, "/api/prompts/import/commit", {
    method: "POST", body: { candidates: preview.candidates, folderId },
  });
  out(`✓ imported ${result.imported || result.candidates?.length || 0}`);
}
```

### Discovery `--source` requirement (security)

```ts
if (sub === "discovery") {
  if (!args.source) die(2, "--source required for discovery import (run `prompt import sources` to see options)");
  if (!args.query)  die(2, "--query required for discovery import");
}
```

No silent fanout to all sources. This is hardened since discovery hits external services.

## `bin/ima2.ts` router diff

```diff
   case "session":
   case "history":
+  case "prompt":
   case "ping": {
```

`--help` block adds:

```diff
+    ima2 prompt <sub>             Prompt library (ls, show, create, edit, rm, favorite, export, folder, import)
```

## Tests (`tests/cli.smoke.test.js` additions)

```js
test("prompt create --text 'hello' returns id", async () => {
  // POST /api/prompts with { text: "hello" }; assert response.id present
});

test("prompt create --text @file reads file", async () => {
  // tmpfile with "hello world"; ima2 prompt create --text @tmpfile
  // intercept: body.text === "hello world"
});

test("prompt create requires --text", async () => {
  // exec without --text → exit 2; with --text → 200
});

test("prompt ls --search hello uses ?search= query", async () => {
  // intercept; assert URL contains "search=hello"
});

test("prompt edit accepts partial fields", async () => {
  // PATCH /api/prompts/:id with only { name: "X" }; assert response 200
});

test("prompt favorite toggles", async () => {
  // first call favorites; second un-favorites. Read back via prompt show.
});

test("prompt folder rm --strategy delete maps to deleteItems query", async () => {
  // intercept; URL contains "strategy=deleteItems"
});

test("prompt folder rm without --strategy defaults to moveToRoot", async () => {
  // intercept; URL contains "strategy=moveToRoot" (or omits, server default)
});

test("prompt import curated --dry-run does not commit", async () => {
  // intercept fetches; assert /commit was NOT called
});

test("prompt import discovery without --source exits 2", async () => {
  // ima2 prompt import discovery --query foo → exit 2
});

test("prompt import folder >100 prompts requires --yes (non-TTY)", async () => {
  // simulate folder-preview returning 101 candidates; non-TTY exec without --yes → exit 2
});

test("prompt export -o out.json writes valid JSON", async () => {
  // assert file exists, JSON.parse succeeds, has prompts and folders arrays
});
```

## Acceptance

- `bin/commands/prompt.ts` (or split) exists and stays under 500 lines per file.
- All subcommands above work end-to-end against a running `ima2 serve`.
- `prompt import discovery` refuses to run without `--source` AND `--query`.
- `prompt import folder` shows count and prompts for `--yes` if >100 candidates and TTY; refuses if >100 and non-TTY without `--yes`.
- `prompt export` produces JSON parseable by the same server's import endpoint (round-trip safety).
- All Phase 3 smoke tests green.
- README adds `Prompt Library` section with import flow examples.

## Watchouts

- `prompt create --text @bigfile.txt` — server has size caps somewhere in `commitCandidates`; check `promptImportLimits(ctx)` for exact limit. CLI shows server's 413/422 verbatim instead of generic error.
- `prompt favorite` does **not** require `X-Ima2-Browser-Id` (unlike history favorite). Verified at `routes/prompts.ts:147`. Do not add the header.
- Discovery sources may take >30s. Use `timeoutMs: 60_000` for discovery commands and show a static "fetching from <source>…" line while pending.
- `prompt edit` partial: must omit unset fields (server applies what it sees). Do not send `null` for unset — that would clear the field.
- `prompt export`: if used as backup before bulk operation, document that export → import via `commit` is the recovery path. Plain re-import via `POST /api/prompts/import` (legacy, `prompts.ts:170`) is also possible but undocumented in the new flow.

## Decision Point (start of Phase 3)

If `bin/commands/prompt.ts` crosses 400 lines in development, split immediately into:

- `bin/commands/prompt.ts` — top-level multiplexer (~80 lines)
- `bin/commands/prompt-core.ts` — ls/show/create/edit/rm/favorite/export
- `bin/commands/prompt-folder.ts` — folder subtree
- `bin/commands/prompt-import.ts` — import subtree (~200 lines, the largest)

Don't ship a 600-line file. The 500-line cap is a hard constraint.

## Out of Scope for Phase 3

- Card News (Phase 5).
- Multimode/node SSE (Phase 4).
- A `prompt search` standalone command (use `prompt ls --search`).
- A `prompt copy` / `prompt duplicate` command — no server endpoint.
