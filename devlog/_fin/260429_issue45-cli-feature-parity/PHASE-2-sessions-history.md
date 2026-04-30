# Phase 2 — Sessions & History Management

## Goal

Surface session/graph CRUD and write-side history operations. Today only `ls` and `show` exist for history; sessions have **no CLI** despite being the primary persistence unit.

This phase introduces the first new top-level commands since CLI v1.0 and a **client.ts extension** to support custom request headers (required by `If-Match`, `X-Ima2-Browser-Id`, raw image upload).

## Verified endpoint table (all citations from `routes/`)

### Sessions (`routes/sessions.ts`)

| Endpoint | Line | Body / headers | Notes |
|---|---:|---|---|
| `GET /api/sessions` | 24 | — | list all |
| `POST /api/sessions` | 32 | `{ title }` (200 char cap) | returns `{ session }` 201 |
| `GET /api/sessions/:id` | 46 | — | full session + graph |
| `PATCH /api/sessions/:id` | 60 | `{ title }` | rename |
| `DELETE /api/sessions/:id` | 84 | — | |
| `GET /api/sessions/:id/style-sheet` | 99 | — | |
| `PUT /api/sessions/:id/style-sheet` | 119 | full style sheet object | |
| `PATCH /api/sessions/:id/style-sheet/enabled` | 151 | `{ enabled: boolean }` | toggle only |
| `POST /api/sessions/:id/style-sheet/extract` | 175 | — | LLM-extract from session content |
| `PUT /api/sessions/:id/graph` | 229 | `{ nodes, edges }` + `If-Match: <version>` (required, 428 if missing) | also reads `X-Ima2-Graph-Save-Id`, `-Save-Reason`, `-Tab-Id` (optional). Caps: 500 nodes / 1000 edges |

### History write-side (`routes/history.ts`, `routes/imageImport.ts`)

| Endpoint | Line | Body / headers | Notes |
|---|---:|---|---|
| `DELETE /api/history/:filename` | `history.ts:101` | — | soft delete to trash |
| `DELETE /api/history/:filename/permanent` | `history.ts:91` | — | hard delete |
| `POST /api/history/:filename/restore` | `history.ts:111` | `{ trashId }` (required) | |
| `POST /api/history/favorite` | `history.ts:123` | `{ filename }` + `X-Ima2-Browser-Id` (required) | server toggles based on DB state; response `{ isFavorite: boolean }` |
| `POST /api/history/import-local` | `imageImport.ts:14` | **raw bytes**, `Content-Type: image/png\|jpeg\|webp` + `X-Ima2-Original-Filename` header | uses `express.raw` |

## Prerequisite: extend `bin/lib/client.ts`

Current signature (`bin/lib/client.ts:57`):

```ts
export async function request(base, path, { method = "GET", body, timeoutMs = 180_000 } = {})
```

Diff:

```diff
-export async function request(base, path, { method = "GET", body, timeoutMs = 180_000 }: any = {}) {
+export async function request(base, path, {
+  method = "GET",
+  body,
+  headers: extraHeaders,
+  raw = false,
+  timeoutMs = 180_000,
+}: any = {}) {
+  const baseHeaders: Record<string, string> = raw
+    ? { "X-ima2-client": `cli/${CLI_VERSION}` }
+    : { "Content-Type": "application/json", "X-ima2-client": `cli/${CLI_VERSION}` };
+  const finalHeaders = { ...baseHeaders, ...(extraHeaders || {}) };
   const res = await fetch(base + path, {
     method,
-    headers: {
-      "Content-Type": "application/json",
-      "X-ima2-client": `cli/${CLI_VERSION}`,
-    },
-    body: body !== undefined ? JSON.stringify(body) : undefined,
+    headers: finalHeaders,
+    body: body === undefined ? undefined
+        : raw ? body                       // Buffer / Uint8Array passthrough
+        : JSON.stringify(body),
     signal: AbortSignal.timeout(timeoutMs),
   });
```

This is a backward-compatible change (callers without `headers` or `raw` keep the old behavior). Smoke test: existing `gen`/`edit`/`ls`/`show` stay green.

## New commands

### Browser-id resolution

Several endpoints require `X-Ima2-Browser-Id`. CLI synthesizes a stable id from `runtimeConfig.storage.configDir`:

```ts
// bin/lib/browser-id.ts (new helper)
import { createHash } from "crypto";
import { config } from "../../config.js";

let cached: string | null = null;
export function getCliBrowserId(): string {
  if (cached) return cached;
  cached = "cli-" + createHash("sha1").update(config.storage.configDir).digest("hex").slice(0, 16);
  return cached;
}
```

Used by `history favorite` and `annotate` (Phase 4). Idempotent across invocations.

### `bin/commands/session.ts` (new file)

Single multiplexer command. Subcommand pattern mirrors how `kubectl get|set|describe` works.

```ts
// bin/commands/session.ts (sketch — actual file ~250 lines)
const SUB = { ls, show, create, rm, rename, graph, "style-sheet": styleSheet };

export default async function sessionCmd(argv) {
  const sub = argv[0];
  if (!sub || sub === "--help" || sub === "-h") return printHelp();
  const handler = SUB[sub];
  if (!handler) die(2, `unknown subcommand: ${sub}`);
  return handler(argv.slice(1));
}
```

Subcommand → endpoint:

| CLI | Endpoint | Body |
|---|---|---|
| `session ls [--json]` | `GET /api/sessions` | — |
| `session show <id> [--json]` | `GET /api/sessions/:id` | — |
| `session create <title>` | `POST /api/sessions` | `{ title }` |
| `session rm <id> [--yes]` | `DELETE /api/sessions/:id` | — |
| `session rename <id> <title>` | `PATCH /api/sessions/:id` | `{ title }` |
| `session graph save <id> <file>` | first `GET /api/sessions/:id` (read `graph.version`), then `PUT /api/sessions/:id/graph` with `If-Match: "<version>"` | `{ nodes, edges }` from `<file>` JSON |
| `session graph load <id> [--out <file>]` | `GET /api/sessions/:id` | extract `.graph` field, write to file or stdout |
| `session style-sheet get <id>` | `GET /api/sessions/:id/style-sheet` | — |
| `session style-sheet put <id> <file>` | `PUT /api/sessions/:id/style-sheet` | full object from `<file>` JSON |
| `session style-sheet enable <id>` | `PATCH /api/sessions/:id/style-sheet/enabled` | `{ enabled: true }` |
| `session style-sheet disable <id>` | `PATCH /api/sessions/:id/style-sheet/enabled` | `{ enabled: false }` |
| `session style-sheet extract <id>` | `POST /api/sessions/:id/style-sheet/extract` | — |

**Phantom commands removed** from earlier draft: `style-sheet patch` (no such route — the only PATCH is on `/enabled`).

#### `session graph save` flow (the only non-trivial one)

```ts
async function graphSave(id, file) {
  const server = await resolveServer({});
  const buf = await readFile(file, "utf-8");
  const { nodes, edges } = JSON.parse(buf);
  if (!Array.isArray(nodes) || !Array.isArray(edges))
    die(2, "graph file must contain { nodes: [], edges: [] }");

  // Step 1: fetch current version
  const current = await request(server.base, `/api/sessions/${id}`);
  const version = current?.session?.graph?.version;
  if (typeof version !== "number")
    die(1, "could not resolve current graph version");

  // Step 2: PUT with If-Match
  try {
    const result = await request(server.base, `/api/sessions/${id}/graph`, {
      method: "PUT",
      body: { nodes, edges },
      headers: { "If-Match": `"${version}"` },
    });
    out(`✓ saved (new graphVersion: ${result.graphVersion})`);
  } catch (e) {
    if (e.status === 412) die(1, "graph version conflict — fetch latest and retry");
    if (e.status === 413) die(1, e.message); // graph too large
    throw e;
  }
}
```

### `bin/commands/history.ts` (new file)

Existing root commands `ls` and `show` keep working. `history` adds the write-side ops.

| CLI | Endpoint | Body / headers |
|---|---|---|
| `history rm <filename> [--permanent] [--yes]` | `DELETE /api/history/:filename` (soft) or `/:filename/permanent` (hard) | — |
| `history restore <filename> --trash-id <id>` | `POST /api/history/:filename/restore` | `{ trashId }` |
| `history favorite <filename>` | `POST /api/history/favorite` | `{ filename }` + `X-Ima2-Browser-Id: <getCliBrowserId()>` (server toggles, returns `{ isFavorite }`) |
| `history import <localfile>` | `POST /api/history/import-local` | **raw bytes**, `Content-Type` derived from extension, `X-Ima2-Original-Filename: <basename>` |

#### `history favorite` flow (server toggles based on DB state)

The endpoint takes only `{ filename }` plus the browser-id header; server checks `gallery_favorites` table and toggles. Response is `{ isFavorite: boolean }` reflecting the new state. CLI prints the post-toggle state:

```ts
async function favoriteCmd(filename) {
  const server = await resolveServer({});
  const browserId = getCliBrowserId();
  const result = await request(server.base, "/api/history/favorite", {
    method: "POST",
    body: { filename },
    headers: { "X-Ima2-Browser-Id": browserId },
  });
  out(result.isFavorite ? "✓ favorited" : "✓ unfavorited");
}
```

#### `history import` flow

```ts
async function importCmd(filepath) {
  const server = await resolveServer({});
  const buf = await readFile(filepath);
  const ext = path.extname(filepath).toLowerCase();
  const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
             : ext === ".webp" ? "image/webp" : "image/png";
  const result = await request(server.base, "/api/history/import-local", {
    method: "POST",
    body: buf,
    raw: true,
    headers: {
      "Content-Type": mime,
      "X-Ima2-Original-Filename": path.basename(filepath),
    },
  });
  out("✓ imported as " + result.item.filename);
}
```

## `bin/ima2.ts` router diff

Add the two new branches at L389-L399:

```diff
   case "gen":
   case "edit":
   case "ls":
   case "show":
   case "ps":
   case "cancel":
+  case "session":
+  case "history":
   case "ping": {
     const { setCliVersion } = await import("./lib/client.js");
     setCliVersion(pkg.version);
     const mod = await import(`./commands/${command}.js`);
     await mod.default(args.slice(1));
     break;
   }
```

Top-level `--help` (search for `Usage:` block in `bin/ima2.ts`) gets two new lines:

```diff
     ima2 gen "<prompt>"           Generate image(s)
     ima2 edit <file> -p "..."     Edit an image
     ima2 ls                       List recent generations
     ima2 show <name>              Show metadata
+    ima2 session <sub>            Session/graph CRUD (ls, show, create, rm, rename, graph, style-sheet)
+    ima2 history <sub>            History write-ops (rm, restore, favorite, import)
     ima2 ps                       In-flight jobs
     ima2 cancel <reqId>           Cancel a job
```

## Tests (`tests/cli.smoke.test.js` additions)

```js
test("session create then ls includes it", async () => {
  // exec: ima2 session create "TestSession" → captures id
  // exec: ima2 session ls --json → assert id present
});

test("session graph save fails on stale version", async () => {
  // PUT graph twice with same If-Match → second call exits non-zero with "version conflict"
});

test("session create with empty body uses default 'Untitled'", async () => {
  // server caps at 200 chars; empty title → "Untitled"
});

test("history rm soft then ls --include-deleted [REMOVED]", () => {
  // No server support; phase only documents soft-rm. Restore flow tested via --trash-id below.
});

test("history rm <f> --permanent uses /permanent endpoint", async () => {
  // intercept fetch URL contains "/permanent"
});

test("history favorite toggles state", async () => {
  // first call: false→true. second call: true→false. assert via /api/history isFavorite read-back.
});

test("history import raw bytes posts Content-Type image/png and X-Ima2-Original-Filename header", async () => {
  // intercept; assert headers and body is Buffer not JSON string.
});

test("history restore requires --trash-id", async () => {
  // exec without flag → exit 2; with flag → 200.
});
```

## Acceptance

- `bin/lib/client.ts` accepts `headers` and `raw` options (backward-compatible).
- `bin/lib/browser-id.ts` exists, deterministic.
- `bin/commands/session.ts` and `bin/commands/history.ts` exist and stay under 500 lines each.
- `bin/ima2.ts` switch updated; `--help` updated.
- All Phase 2 smoke tests green.
- `session graph save` correctly handles 412 (version conflict) and 413 (graph too large).
- `history rm --permanent` uses `/permanent` endpoint, plain `rm` uses soft-delete.
- README "CLI Commands" section adds `Session` and `History` subsections.

## Watchouts

- `If-Match` value: server compares stripped of double quotes (`routes/sessions.ts:248-251`). Sending `"5"` or `5` both work; we use the quoted form to follow HTTP convention.
- `style-sheet put`: server expects the **full** style-sheet object. There is no merge endpoint (only `enabled` toggle is granular).
- `history favorite` requires the same `X-Ima2-Browser-Id` for read and write. CLI uses one synthesized id throughout the process — favorites set in UI (with a different browserId) won't appear in CLI's view, and vice versa. Document this.
- `--yes` semantics: when stdin is not a TTY (CI/scripted), refuse destructive commands without `--yes`. Promptable in TTY.
- `session graph save` reads the entire graph file into memory. With server cap of 500 nodes / 1000 edges, this is bounded ~1-2 MB; no streaming needed.

## Out of Scope for Phase 2

- Prompt library (Phase 3).
- `node generate` (Phase 4) — node is a different graph element than session graph.
- `--watch` modes for `session ls` / `history ls`.
- `session graph save --force` to bypass If-Match (could cause data loss, deferred until requested).
