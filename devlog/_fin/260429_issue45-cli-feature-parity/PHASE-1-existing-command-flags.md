# Phase 1 — Flags on Existing Commands

## Goal

Surface request fields the server already accepts but the CLI does not expose. Lowest risk; only patches existing files in `bin/commands/`. No router changes.

## Verified gaps (post-audit)

| Endpoint | Server-accepted field | CLI today | CLI target |
|---|---|---|---|
| `POST /api/generate` (`routes/generate.ts:42`) | `reasoningEffort` | not exposed | `gen --reasoning-effort` |
| `POST /api/generate` (`routes/generate.ts:43`) | `webSearchEnabled` | not exposed | `gen --web-search`/`--no-web-search` |
| `POST /api/edit` (`routes/edit.ts:80`) | `reasoningEffort` | not exposed | `edit --reasoning-effort` |
| `POST /api/edit` (`routes/edit.ts:81`) | `webSearchEnabled` | not exposed | `edit --web-search`/`--no-web-search` |
| `GET /api/history` (`routes/history.ts:18`) | `sessionId` query | not exposed | `ls --session <id>` |
| `POST /api/metadata/read` (`routes/metadata.ts:22–24`) | `{ dataUrl }` body | no command | `show --metadata` (read local file → encode → POST) |

Already supported, do **not** re-add: `--mode auto|direct` (`gen.ts:26`, `edit.ts:21`); `--moderation`; `--model`; `--session` for style-sheet (`gen.ts:28`, `edit.ts:23`).

Removed from earlier draft (server doesn't support): `ls --favorites` query, `ls --include-deleted` query — `routes/history.ts:12–21` only parses `limit`, `before`, `beforeFilename`, `since`, `sessionId`, `groupBy`. `--favorites` reduced to client-side filter on the `isFavorite` boolean already present in each row (`routes/history.ts:46`).

## Diff: `bin/commands/gen.ts`

### 1. Add to `SPEC.flags` (currently L11–L30)

```diff
 const SPEC = {
   flags: {
     quality:   { short: "q", type: "string", default: "low" },
     size:      { short: "s", type: "string", default: "1024x1024" },
     count:     { short: "n", type: "string", default: "1" },
     ref:       {              type: "string", repeatable: true },
     out:       { short: "o", type: "string" },
     "out-dir": { short: "d", type: "string" },
     json:      {              type: "boolean" },
     "no-save": {              type: "boolean" },
     force:     {              type: "boolean" },
     stdin:     {              type: "boolean" },
     timeout:   {              type: "string", default: "180" },
     server:    {              type: "string" },
     model:     {              type: "string" },
     mode:      {              type: "string", default: "auto" },
     moderation: {              type: "string", default: "low" },
     session:   {              type: "string" },
+    "reasoning-effort": {     type: "string" },
+    "web-search":      {     type: "boolean" },
+    "no-web-search":   {     type: "boolean" },
     help:      { short: "h", type: "boolean" },
   },
 };
```

### 2. Validation (after L75 mode check)

```diff
   if (!VALID_MODES.has(args.mode)) die(2, "--mode must be one of: auto, direct");
   if (!VALID_MODERATION.has(args.moderation)) die(2, "--moderation must be one of: auto, low");
   if (args.model && !KNOWN_IMAGE_MODELS.has(args.model)) {
     die(2, "--model must be one of: gpt-5.5, gpt-5.4, gpt-5.4-mini, gpt-5.3-codex-spark");
   }
+  const VALID_REASONING = new Set(["none", "low", "medium", "high", "xhigh"]);
+  if (args["reasoning-effort"] && !VALID_REASONING.has(args["reasoning-effort"])) {
+    die(2, "--reasoning-effort must be one of: none, low, medium, high, xhigh");
+  }
+  if (args["web-search"] && args["no-web-search"]) {
+    die(2, "--web-search and --no-web-search are mutually exclusive");
+  }
```

### 3. Body assembly (currently L94–L104)

```diff
   const body = {
     prompt,
     quality: args.quality,
     size: args.size,
     n,
     references,
     model: args.model,
     mode: args.mode,
     moderation: args.moderation,
     sessionId: args.session,
+    ...(args["reasoning-effort"] ? { reasoningEffort: args["reasoning-effort"] } : {}),
+    ...(args["no-web-search"] ? { webSearchEnabled: false }
+      : args["web-search"] ? { webSearchEnabled: true }
+      : {}),
   };
```

Omit fields when not set so the server applies its config default. Do **not** hardcode any default on the client.

### 4. HELP text (currently L33–L60) — append

```diff
         --moderation <auto|low>             Default: low
         --session <id>                      Apply session style sheet if enabled
+        --reasoning-effort <none|low|medium|high|xhigh>
+        --web-search / --no-web-search      Override default web search toggle
```

## Diff: `bin/commands/edit.ts`

Mirror the same three changes:

```diff
 const SPEC = {
   flags: {
     prompt:  { short: "p", type: "string" },
     quality: { short: "q", type: "string", default: "low" },
     size:    { short: "s", type: "string", default: "1024x1024" },
     out:     { short: "o", type: "string" },
     json:    {              type: "boolean" },
     timeout: {              type: "string", default: "180" },
     server:  {              type: "string" },
     model:   {              type: "string" },
     mode:    {              type: "string", default: "auto" },
     moderation: {            type: "string", default: "low" },
     session: {              type: "string" },
+    "reasoning-effort": {  type: "string" },
+    "web-search":      {  type: "boolean" },
+    "no-web-search":   {  type: "boolean" },
     help:    { short: "h", type: "boolean" },
   },
 };
```

Same validation block + same body-spread pattern around the existing `request(server.base, "/api/edit", ...)` call.

## Diff: `bin/commands/ls.ts`

`bin/lib/output.ts` exports `table` and `color` already used in this file. Server filters by `sessionId` (`routes/history.ts:43`); favorites is a row-level boolean enriched server-side (`routes/history.ts:46`).

```diff
 const SPEC = {
   flags: {
     count:  { short: "n", type: "string", default: "20" },
     json:   { type: "boolean" },
+    session: { type: "string" },
+    favorites: { type: "boolean" },
     server: { type: "string" },
     help:   { short: "h", type: "boolean" },
   },
 };
```

```diff
   const limit = parseInt(args.count) || 20;
+  const qs = new URLSearchParams();
+  if (args.session) qs.set("sessionId", args.session);
+  if (args.count) qs.set("limit", String(limit));
+  const path = qs.toString() ? `/api/history?${qs.toString()}` : "/api/history";
   let resp;
-  try { resp = await request(server.base, "/api/history"); }
+  try { resp = await request(server.base, path); }
   catch (e) { die(exitCodeForError(e), e.message); }

-  const items = (resp.items || resp.history || []).slice(0, limit);
+  let items = (resp.items || resp.history || []);
+  if (args.favorites) items = items.filter((it) => it.isFavorite === true);
+  items = items.slice(0, limit);
```

Note: `--favorites` is a client-side filter, documented as such in HELP. Server has no `favorites` query param.

## Diff: `bin/commands/show.ts`

`POST /api/metadata/read` requires `{ dataUrl: "data:image/...;base64,..." }` (`routes/metadata.ts:14–24`). The image bytes can be fetched from the server's history URL (`item.url`) or from the on-disk path under `config.storage.generatedDir`.

```diff
 import { parseArgs } from "../lib/args.js";
 import { resolveServer, request } from "../lib/client.js";
 import { openUrl } from "../lib/platform.js";
 import { out, die, color, json, exitCodeForError } from "../lib/output.js";
+import { fileToDataUri } from "../lib/files.js";
+import { config } from "../../config.js";

 const SPEC = {
   flags: {
     json:   { type: "boolean" },
     reveal: { type: "boolean" },
+    metadata: { type: "boolean" },
     server: { type: "string" },
     help:   { short: "h", type: "boolean" },
   },
 };
```

After the existing `if (!item) die(...)` line, before the json/print branch:

```diff
+  let metadata = null;
+  if (args.metadata) {
+    try {
+      const dataUrl = await fileToDataUri(`${config.storage.generatedDir}/${item.filename}`);
+      const meta = await request(server.base, "/api/metadata/read", {
+        method: "POST",
+        body: { dataUrl },
+      });
+      metadata = meta;
+    } catch (e) {
+      out(color.dim("(metadata unavailable: " + e.message + ")"));
+    }
+  }

   if (args.json) { json(args.metadata ? { ...item, metadata } : item); }
   else {
     out(color.bold(item.filename));
     // ... existing body ...
+    if (metadata) {
+      out(color.dim("  metadata:"));
+      out(JSON.stringify(metadata, null, 2).split("\n").map(l => "    " + l).join("\n"));
+    }
   }
```

## Tests

Add to `tests/cli.smoke.test.js` (or create if absent — match the file pattern of existing test files):

```js
test("gen --reasoning-effort none builds correct body", async () => {
  const captured = [];
  const fakeRequest = (base, path, opts) => {
    captured.push({ path, body: opts.body });
    return { images: [] };
  };
  // …invoke gen with --reasoning-effort none, assert captured[0].body.reasoningEffort === "none"
});

test("gen --reasoning-effort bogus exits non-zero", async () => {
  // run child process: ima2 gen "x" --reasoning-effort bogus
  // expect exit code 2, stderr contains "must be one of"
});

test("gen --web-search and --no-web-search mutually exclusive", async () => {
  // run with both flags; expect exit 2
});

test("ls --session s_123 sends sessionId query", async () => {
  // mock fetch, assert URL contains "sessionId=s_123"
});

test("ls --favorites filters client-side", async () => {
  // seed two items, one with isFavorite=true; assert only that one is printed
});

test("show foo.png --metadata posts {dataUrl} to /api/metadata/read", async () => {
  // intercept request, assert path === "/api/metadata/read" and body.dataUrl matches data:image/...;base64,
});
```

## Acceptance

- `bin/commands/{gen,edit,ls,show}.ts` updated with the diffs above.
- `--reasoning-effort` validates against the canonical 5-value set on the client to fail fast (server still validates again at `lib/imageModels.ts:5`).
- `gen --help` and `edit --help` print the new flags with valid values inline.
- All Phase 1 smoke tests green.
- README.md "CLI Commands" section updated with the new flags. (Doc update is part of this phase, not deferred.)
- No new files added. No `bin/ima2.ts` changes.

## Watchouts

- `bin/lib/args.ts` repeatable `boolean` flags: confirm `--no-web-search` parses cleanly. If `parseArgs` does not accept hyphenated boolean keys, fall back to a single `--web-search <true|false>` string flag and parse manually.
- Do **not** echo `reasoningEffort: "medium"` (or any default) when the user does not pass `--reasoning-effort`. Server resolves the default via `config.js`; the client must not duplicate it.
- `show --metadata` will silently degrade if the file is not in `config.storage.generatedDir`. That is acceptable for Phase 1; Phase 4 introduces a standalone `metadata` command that handles arbitrary paths.

## Out of Scope for Phase 1

- No new top-level commands.
- No SSE streaming.
- No new files anywhere.
- Does not add `--reasoning-effort` to `node generate` (Phase 4 covers that path).
