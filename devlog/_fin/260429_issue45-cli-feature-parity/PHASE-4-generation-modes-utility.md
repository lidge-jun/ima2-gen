# Phase 4 — Generation Modes & Utility

## Goal

Cover generation surfaces beyond `gen`/`edit`: multimode (SSE), node-mode, plus the utility endpoints (annotations, canvas versions, metadata, comfy export). Introduces the first SSE streaming in CLI.

## Verified endpoints

### Multimode (`routes/multimode.ts`)

| Endpoint | Line | Notes |
|---|---:|---|
| `POST /api/generate/multimode` | 36 | SSE, always streams |

**Verified SSE event types** (events written via `sendSse` at multimode.ts L14):

| Event | Payload | Cited line |
|---|---|---|
| `phase` | `{ phase: "streaming", requestId, sequenceId, maxImages }` | L146 |
| `partial` | `{ image: "data:<mime>;base64,...", requestId, sequenceId, index }` | L162 |
| `image` | full image item: `{ image, filename, prompt, ..., sequenceTotalReturned, sequenceStatus }` | L222 |
| `done` | `{ ok, requestId, sequenceId, requested, returned, ... }` | L227 |
| `error` | `{ error, code?, status?, requestId, ... }` | L70, L79, L88, L96, L103, L117, L262 |

Critical correction from earlier draft: **`partial` is a full data URL**, not progressive base64 chunks. Treat it as "preview snapshot" not "byte stream chunk".

### Node mode (`routes/nodes.ts`)

| Endpoint | Line | Notes |
|---|---:|---|
| `POST /api/node/generate` | 59 | SSE only when `Accept: text/event-stream`. Otherwise responds JSON |
| `GET /api/node/:nodeId` | 439 | non-streaming |

### Annotations (`routes/annotations.ts`)

| Endpoint | Line | Headers |
|---|---:|---|
| `GET /api/annotations/:filename` | 38 | **`X-Ima2-Browser-Id` required** (annotations.ts:42) |
| `PUT /api/annotations/:filename` | 55 | same |
| `DELETE /api/annotations/:filename` | (around 80) | same |

### Canvas versions (`routes/canvasVersions.ts`)

| Endpoint | Line | Body |
|---|---:|---|
| `POST /api/canvas-versions` | 24 | raw PNG bytes + `?sourceFilename=` query OR `X-Ima2-Canvas-Source-Filename` header + prompt via `getPrompt(req)` (`X-Ima2-Canvas-Prompt` header or query) |
| `PUT /api/canvas-versions/:filename` | 44 | raw PNG bytes + same `sourceFilename` + prompt inputs |

**Phantoms removed** from earlier draft: `GET /api/canvas-versions`, `POST /api/canvas-versions/:filename`, `DELETE /api/canvas-versions/:filename`, restore route. None exist.

### Metadata (`routes/metadata.ts`)

| Endpoint | Line | Body |
|---|---:|---|
| `POST /api/metadata/read` | 14 | `{ dataUrl: "data:image/...;base64,..." }` |

### Comfy (`routes/comfy.ts`)

| Endpoint | Line | Body |
|---|---:|---|
| `POST /api/comfy/export-image` | 19 | `{ filename }` (exact-shape check) |

## New file: `bin/lib/sse.ts`

Single helper for SSE consumption. No external lib.

```ts
// bin/lib/sse.ts (sketch — actual file ~80 lines)

export type SseEvent = { event: string; data: any };

/**
 * Stream events from an SSE endpoint, yielding parsed events.
 * Handles chunk boundaries (events split across reads), data-only (no event:) frames,
 * and graceful AbortSignal cancellation.
 */
export async function* streamSse(
  url: string,
  init: { method?: string; body?: any; headers?: Record<string, string>; signal?: AbortSignal },
): AsyncGenerator<SseEvent> {
  const res = await fetch(url, {
    method: init.method || "POST",
    headers: { ...(init.headers || {}), Accept: "text/event-stream", "Content-Type": "application/json" },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  });
  if (!res.ok || !res.body) throw new Error(`SSE failed: HTTP ${res.status}`);

  const decoder = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, { stream: true });
    // Split on blank line — SSE event delimiter
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseFrame(frame);
      if (ev) yield ev;
    }
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try { return { event, data: JSON.parse(dataLines.join("\n")) }; }
  catch { return { event, data: dataLines.join("\n") }; }
}
```

Tests live in `tests/cli-sse.test.js`:

- single-event payload parses correctly
- multi-event chunk splits at blank lines
- truncated stream (partial event at EOF) does **not** yield the half event
- `data:` lines without `event:` default to `event: "message"`
- AbortSignal cancellation closes the iterator without throwing

## New file: `bin/commands/multimode.ts`

```ts
// bin/commands/multimode.ts (sketch ~150 lines)
const SPEC = {
  flags: {
    quality: { short: "q", type: "string", default: "low" },
    size:    { short: "s", type: "string", default: "1024x1024" },
    "max-images": { type: "string", default: "4" },
    out:     { short: "o", type: "string" },
    "out-dir": { short: "d", type: "string" },
    json:    { type: "boolean" },
    timeout: { type: "string", default: "600" }, // multimode is slower
    server:  { type: "string" },
    model:   { type: "string" },
    "reasoning-effort": { type: "string" },
    "web-search":    { type: "boolean" },
    "no-web-search": { type: "boolean" },
    moderation: { type: "string", default: "low" },
    session: { type: "string" },
    "show-partial": { type: "boolean" }, // print "[partial #2 received]" lines
    help: { short: "h", type: "boolean" },
  },
};
```

Render rules (the actual differentiator vs `gen`):

```ts
const ac = new AbortController();
process.on("SIGINT", () => { ac.abort(); process.exit(130); });

const url = `${server.base}/api/generate/multimode`;
let images = [];
for await (const ev of streamSse(url, { body, signal: ac.signal })) {
  switch (ev.event) {
    case "phase":
      out(color.dim(`[phase] ${ev.data.phase} (max ${ev.data.maxImages})`));
      break;
    case "partial":
      if (args["show-partial"]) {
        out(color.dim(`[partial #${ev.data.index}] (${ev.data.image.length}B preview)`));
      }
      break;
    case "image":
      images.push(ev.data);
      out(color.green(`✓ image ${images.length}`));
      break;
    case "done":
      out(color.dim(`[done] returned ${ev.data.returned}/${ev.data.requested}`));
      break;
    case "error":
      die(1, `multimode error: ${ev.data.error}${ev.data.code ? ` (${ev.data.code})` : ""}`);
  }
}
// Write images to disk using same pattern as gen.ts (out / outDir / config.storage.generatedDir)
```

## New file: `bin/commands/node.ts`

| CLI | Endpoint | Body / headers |
|---|---|---|
| `node generate <prompt> [--parent <nodeId>] [--ref ...] [--no-stream] [...flags]` | `POST /api/node/generate` (SSE if `--no-stream` not set) | same fields as `gen` plus `parentNodeId` |
| `node show <id> [--json]` | `GET /api/node/:nodeId` | — |

`node generate` reuses `bin/lib/sse.ts`. When `--no-stream`, send a plain `Accept: application/json` and parse a single response (verified at `routes/nodes.ts:25`).

## New file: `bin/commands/annotate.ts`

All three subcommands send `X-Ima2-Browser-Id: <getCliBrowserId()>` (helper from Phase 2):

| CLI | Endpoint | Body |
|---|---|---|
| `annotate get <filename> [--json]` | `GET /api/annotations/:filename` | — |
| `annotate set <filename> --body <json\|@file\|->` | `PUT /api/annotations/:filename` | parsed JSON |
| `annotate rm <filename> [--yes]` | `DELETE /api/annotations/:filename` | — |

Same `--body` resolution as `prompt --text`.

## New file: `bin/commands/canvas-versions.ts`

Only two operations (no GET, no DELETE per route audit):

| CLI | Endpoint | Body |
|---|---|---|
| `canvas-versions save <imagefile> [--source <filename>] [--prompt <text>]` | `POST /api/canvas-versions?sourceFilename=...` | raw PNG bytes |
| `canvas-versions update <filename> <imagefile> [--source <filename>] [--prompt <text>]` | `PUT /api/canvas-versions/:filename?sourceFilename=...` | raw PNG bytes |

Uses `request(..., { raw: true, body: buffer, headers: { "Content-Type": "image/png", "X-Ima2-Canvas-Source-Filename": <source>, "X-Ima2-Canvas-Prompt": <prompt> } })` (Phase 2 client extension). Either query param or header works; CLI prefers headers to avoid URL-encoding pitfalls.

There is **no** `canvas-versions ls` or `rm`. Document this gap; if needed, file a separate issue to add server endpoints.

## New file: `bin/commands/metadata.ts`

```ts
// bin/commands/metadata.ts (sketch ~50 lines)
const SPEC = {
  flags: { json: { type: "boolean" }, server: { type: "string" }, help: { short: "h", type: "boolean" } },
};

export default async function metadataCmd(argv) {
  const args = parseArgs(argv, SPEC);
  const file = args.positional[0];
  if (!file) die(2, "filename required");
  const dataUrl = await fileToDataUri(file); // existing helper
  const server = await resolveServer({ serverFlag: args.server });
  const meta = await request(server.base, "/api/metadata/read", {
    method: "POST",
    body: { dataUrl },
  });
  if (args.json) json(meta);
  else out(JSON.stringify(meta, null, 2));
}
```

Note this differs from `show --metadata` (Phase 1) in that this works on **arbitrary local files**, not history-resident ones.

## New file: `bin/commands/comfy.ts`

| CLI | Endpoint | Body |
|---|---|---|
| `comfy export <filename> [-o <file>]` | `POST /api/comfy/export-image` | `{ filename }` (exact shape; do not add other keys) |

Output: writes the response to `<filename>.workflow.json` by default unless `-o` given. Refuses to overwrite without `--force`.

## `bin/ima2.ts` router diff

```diff
   case "session":
   case "history":
   case "prompt":
+  case "multimode":
+  case "node":
+  case "annotate":
+  case "canvas-versions":
+  case "metadata":
+  case "comfy":
   case "ping": {
```

`--help` block adds 6 lines.

## Tests

`tests/cli-sse.test.js` (new):

```js
test("parses single phase event", async () => {
  // mock res.body emitting "event: phase\ndata: {\"phase\":\"streaming\"}\n\n"
  // assert generator yields { event: "phase", data: { phase: "streaming" } }
});

test("buffers across chunk boundaries", async () => {
  // emit "event: phase\nda" + "ta: {}\n\n"
  // single event yielded
});

test("ignores partial trailing frame at EOF", async () => {
  // emit "event: phase\ndata: {" then close
  // generator returns; no event yielded
});

test("AbortSignal stops iteration without throwing", async () => {
  // start consuming, abort mid-stream, assert generator returns cleanly
});
```

`tests/cli.smoke.test.js` (additions):

```js
test("multimode streams 'image' events and writes them", async () => {
  // mock multimode endpoint emitting 2 image events + done
  // assert 2 files written, exit 0
});

test("multimode 'error' event exits non-zero with the message", async () => {
  // mock emitting error event with code MODERATION_BLOCKED
  // assert exit 1, stderr contains code
});

test("node generate --no-stream uses Accept: application/json", async () => {
  // intercept request; assert headers.Accept === "application/json"
});

test("annotate set requires X-Ima2-Browser-Id header", async () => {
  // intercept; assert header present
});

test("canvas-versions save sends raw PNG bytes (Content-Type: image/png)", async () => {
  // intercept; assert Content-Type and body is Buffer not JSON
});

test("metadata <pngfile> posts {dataUrl} to /api/metadata/read", async () => {
  // intercept; body.dataUrl matches /^data:image\/png;base64,/
});

test("comfy export refuses to overwrite without --force", async () => {
  // tmpfile already exists; exec → exit non-zero unless --force
});
```

## Acceptance

- `bin/lib/sse.ts` exists, all unit tests green.
- 6 new `bin/commands/*.ts` files exist (`multimode`, `node`, `annotate`, `canvas-versions`, `metadata`, `comfy`).
- All Phase 4 smoke tests green.
- `multimode` SIGINT handling: Ctrl+C aborts mid-stream and exits 130.
- All Phase 4 modules under 500 lines each.
- README adds `Generation Modes`, `Annotations`, `Canvas Versions`, `Utility` sections.

## Watchouts

- SSE chunked decode uses `TextDecoder({ stream: true })` to handle multi-byte boundary safely. Do not skip the `{ stream: true }` flag.
- `multimode` `--show-partial` is opt-in. Default is silent on partial events because they fire frequently and would clutter the terminal.
- `node generate --no-stream` falls back to plain JSON, but server may still take >60s. Use `timeoutMs: 600_000` for both modes.
- `canvas-versions update <filename>` URL-encodes the filename. Test with a filename containing spaces / Unicode.
- `comfy export` writes to current working directory. Document this in `--help`; users may expect default output beside the source file.

## Out of Scope for Phase 4

- Card News (Phase 5).
- A `--watch` mode that re-runs `multimode` on file changes.
- WebSocket streaming (server only emits SSE).
- `canvas-versions ls/rm` — no server endpoints.
