---
created: 2026-04-23
updated: 2026-04-24
tags: [ima2-gen, node-mode, streaming, sidecar, ui-motion]
aliases: [0.09.5 node streaming, partial image PRD, node glow]
status: planning-audit-revised
owner: Boss + Backend audit + Frontend audit
depends_on: 0.09.14 productized node mode
blocks: 0.10 compare UX (nice-to-have)
---

# 0.09.5 — Node Streaming + RequestId Recovery + Animated Node Glow

## Current Code Baseline

Current code paths:

- Node route: `routes/nodes.js`
- OAuth stream parser: `lib/oauthProxy.js`
- History mapper: `lib/historyList.js`
- Node API client: `ui/src/lib/api.ts`
- Store/recovery: `ui/src/store/useAppStore.ts`
- Node card UI: `ui/src/components/ImageNode.tsx`
- CSS: `ui/src/index.css`

Already implemented:

- Node mode is visible in packaged builds by default.
- Root nodes support node-local reference image attachments.
- Node sidecars/history expose `refsCount`.
- `/api/node/generate` receives `requestId` and returns it in final JSON.
- `lib/oauthProxy.js` parses final streamed image results.

Still missing:

- OAuth image tool payload does not request partial images.
- Partial image SSE events are ignored/unhandled.
- `/api/node/generate` does not stream partial/final node events to the frontend.
- Node sidecar/history do not store `requestId`.
- Reload recovery cannot use `requestId` because `sanitizeForSave()` clears `pendingRequestId`.
- Pending/reconciling node border is static instead of animated/glowing.

## Audit Corrections

Backend and Frontend audit returned FAIL. This plan incorporates the fixes:

- Preserve a reload-safe `recoveryRequestId` because `pendingRequestId` is intentionally sanitized.
- Add `requestId?: string | null` to both `HistoryItem` in `ui/src/lib/api.ts` and `GenerateItem` in `ui/src/types.ts`.
- Open SSE headers only after all validation guards pass.
- After SSE headers are sent, send `event: error` instead of `res.json()`.
- Add `writeSse()` explicitly.
- Keep `generateViaOAuth()` backward compatible by adding final positional `options = {}`.
- Treat `partial_images` and partial event shape as provider-dependent; degrade to final-only if partial events do not arrive.
- Define the client SSE parser in the plan.
- Clear `partialImageUrl` on success, error, stale/cancel cleanup, and graph save sanitization.
- Use transform-based glow instead of `@property`; include mask fallback or fall back to animated box-shadow.

## Part 1 — Easy Explanation

When a node is generating today, users see a mostly static pending skeleton until the final image appears. This phase makes generation feel alive:

1. The node starts a subtle animated glowing border as soon as generation begins.
2. The backend asks the OAuth image tool for partial images.
3. If the upstream sends partial images, the backend forwards them to the browser through SSE.
4. The node card displays the partial preview while the final image is still being produced.
5. The final image replaces the partial preview when done.
6. The sidecar stores `requestId`, and the graph stores a safe `recoveryRequestId`, so reload recovery can match completed assets more accurately.

Non-goals:

- Classic `/api/generate` streaming.
- Child/edit partial image streaming.
- Changing OAuth-only policy.
- Allowing extra references on child/edit nodes.

Recommended product decisions:

- Apply partial streaming only to root node generate in this phase.
- Apply animated glow to both `pending` and `reconciling` nodes.
- Request `partial_images: 2`.
- If upstream ignores partial image options, keep final-only behavior without user-facing failure.

## Part 2 — Diff-Level Plan

### MODIFY `lib/oauthProxy.js`

Before:

```js
async function readImageStream(res, { requestId = null, scope = "oauth" } = {}) {
  // Parses final response.output_item.done image_generation_call only.
}

export async function generateViaOAuth(
  prompt,
  quality,
  size,
  moderation = "low",
  references = [],
  requestId = null,
  mode = "auto",
  ctx = {},
) {
  const tools = [
    { type: "web_search" },
    { type: "image_generation", quality, size, moderation },
  ];
}
```

After:

```js
function buildImageTool({ quality, size, moderation, partialImages = 0 }) {
  return partialImages > 0
    ? { type: "image_generation", quality, size, moderation, partial_images: partialImages }
    : { type: "image_generation", quality, size, moderation };
}

async function readImageStream(res, {
  requestId = null,
  scope = "oauth",
  onPartialImage = null,
} = {}) {
  // Continue parsing final image_generation_call exactly as today.
  // Additionally detect provider partial image events when available.
  // For every partial event:
  // onPartialImage?.({ b64, index, eventType });
}

export async function generateViaOAuth(
  prompt,
  quality,
  size,
  moderation = "low",
  references = [],
  requestId = null,
  mode = "auto",
  ctx = {},
  options = {},
) {
  const { partialImages = 0, onPartialImage = null } = options;
  const tools = [
    { type: "web_search" },
    buildImageTool({ quality, size, moderation, partialImages }),
  ];
}
```

Provider uncertainty:

- The local repo does not currently contain a partial image fixture.
- Implementation must support the expected partial event shape in tests and gracefully degrade to final-only if no partial events arrive.

### MODIFY `routes/nodes.js`

Add helper:

```js
function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.flush?.();
}
```

Before:

```js
const r = parentB64
  ? await editViaOAuth(...)
  : await generateViaOAuth(...);

res.json({ nodeId, parentNodeId, requestId, image, filename, url, ... });
```

After:

```js
const wantsSse = req.headers.accept?.includes("text/event-stream");

// Important: run provider/prompt/ref/edit-ref/moderation validation before
// writing SSE headers. Validation failures keep the existing JSON 400/403.

if (wantsSse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

const onPartialImage = wantsSse && !parentB64
  ? ({ b64, index }) => writeSse(res, "partial", {
      requestId,
      index,
      image: `data:image/${format === "jpeg" ? "jpeg" : format};base64,${b64}`,
    })
  : null;

const r = parentB64
  ? await editViaOAuth(effectivePrompt, parentB64, quality, size, moderation, normalizedPromptMode, ctx, requestId)
  : await generateViaOAuth(
      effectivePrompt,
      quality,
      size,
      moderation,
      refCheck.refs,
      requestId,
      normalizedPromptMode,
      ctx,
      { partialImages: wantsSse ? 2 : 0, onPartialImage },
    );

const payload = { nodeId, parentNodeId, requestId, image, filename, url, refsCount, ... };

if (wantsSse) {
  writeSse(res, "done", payload);
  res.end();
} else {
  res.json(payload);
}
```

Catch path:

```js
if (wantsSse && res.headersSent) {
  writeSse(res, "error", { error: { code, message: err.message }, parentNodeId });
  res.end();
} else {
  res.status(err.status || 500).json({ error: { code, message: err.message }, parentNodeId });
}
```

Sidecar meta adds:

```js
requestId,
```

### MODIFY `lib/historyList.js`

Before:

```js
clientNodeId: meta?.clientNodeId || null,
kind: meta?.kind || null,
refsCount: Number.isFinite(meta?.refsCount) ? meta.refsCount : 0,
```

After:

```js
clientNodeId: meta?.clientNodeId || null,
requestId: meta?.requestId || null,
kind: meta?.kind || null,
refsCount: Number.isFinite(meta?.refsCount) ? meta.refsCount : 0,
```

### MODIFY `ui/src/lib/api.ts`

Add to `HistoryItem`:

```ts
requestId?: string | null;
```

Add stream event types:

```ts
export type NodeGenerateStreamEvent =
  | { type: "partial"; requestId?: string; index?: number; image: string }
  | { type: "error"; error: { code?: string; message: string } }
  | ({ type: "done" } & NodeGenerateResponse);
```

Add parser:

```ts
function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7);
    if (line.startsWith("data: ")) data += line.slice(6);
  }
  if (!data) return null;
  return { event, data: JSON.parse(data) };
}
```

Add stream request:

```ts
export async function postNodeGenerateStream(
  payload: NodeGenerateRequest,
  handlers: {
    onPartial?: (event: Extract<NodeGenerateStreamEvent, { type: "partial" }>) => void;
  } = {},
): Promise<NodeGenerateResponse> {
  const res = await fetch("/api/node/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload),
  });
  // Read response.body with TextDecoder.
  // Parse event/data lines by "\n\n" boundary.
  // on partial: handlers.onPartial.
  // on done: resolve NodeGenerateResponse.
  // on error: throw Error with code.
}
```

Keep `postNodeGenerate()` JSON fallback unchanged.

### MODIFY `ui/src/types.ts`

Add to `GenerateItem`:

```ts
requestId?: string | null;
```

### MODIFY `ui/src/store/useAppStore.ts`

Add to `ImageNodeData`:

```ts
partialImageUrl?: string | null;
recoveryRequestId?: string | null;
```

When generation starts:

```ts
pendingRequestId: flightId,
recoveryRequestId: flightId,
partialImageUrl: null,
```

Use stream API:

```ts
const res = await postNodeGenerateStream(payload, {
  onPartial: (event) => {
    set({
      graphNodes: get().graphNodes.map((n) =>
        n.id === targetClientId
          ? { ...n, data: { ...n.data, partialImageUrl: event.image, pendingPhase: "partial" } }
          : n,
      ),
    });
  },
});
```

On success:

```ts
delete nextData.referenceImages;
delete nextData.partialImageUrl;
delete nextData.recoveryRequestId;
```

On error/stale cleanup:

```ts
partialImageUrl: undefined,
```

In `sanitizeForSave()` preserve `recoveryRequestId` but clear transient pending state:

```ts
const recoveryRequestId = d.pendingRequestId ?? d.recoveryRequestId ?? null;
return {
  ...safe,
  status: "empty",
  pendingRequestId: null,
  recoveryRequestId,
  pendingPhase: null,
  pendingStartedAt: null,
  partialImageUrl: undefined,
  error: undefined,
};
```

Recovery matching:

```ts
const requestKey = n.data.pendingRequestId ?? n.data.recoveryRequestId ?? null;
const recovered =
  items.find((h) => requestKey && h.requestId === requestKey)
  ?? items.find((h) =>
    (h.sessionId ?? null) === sid &&
    (h.clientNodeId ?? null) === n.id &&
    (!startedAt || (h.createdAt ?? 0) >= startedAt),
  );
```

History hydration maps:

```ts
requestId: it.requestId ?? null,
```

### MODIFY `ui/src/components/ImageNode.tsx`

Render partial preview before skeleton:

```tsx
{d.partialImageUrl && isBusy ? (
  <img className="image-node__partial" src={d.partialImageUrl} alt={t("node.partialImageAlt")} />
) : d.imageUrl && d.status !== "asset-missing" ? (
  <img src={d.imageUrl} alt={t("node.nodeImageAlt")} />
) : isBusy ? (
  <div className="image-node__skeleton" />
) : ...}
```

### MODIFY `ui/src/index.css`

Use transform-based glow, not `@property`.

```css
.image-node--pending,
.image-node--reconciling {
  position: relative;
  border-color: color-mix(in srgb, var(--amber) 65%, transparent);
}

.image-node--pending::before,
.image-node--reconciling::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 1px;
  background: conic-gradient(transparent, var(--amber), transparent 42%);
  animation: node-glow-spin 1.8s linear infinite;
  pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: source-out;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}

@keyframes node-glow-spin {
  to { transform: rotate(360deg); }
}

.image-node__partial {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  filter: saturate(0.9) blur(0.5px);
  animation: node-partial-in 0.28s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .image-node--pending::before,
  .image-node--reconciling::before,
  .image-node__partial {
    animation: none;
  }
}
```

If mask rendering fails in browser QA, fall back to animated `box-shadow` pulse.

### MODIFY `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`

Add:

```json
"partialImageAlt": "Partial node preview"
```

```json
"partialImageAlt": "노드 중간 미리보기"
```

### MODIFY docs

- `structure/03-server-api.md`: document `/api/node/generate` JSON fallback + SSE opt-in, `partial/done/error` events, `requestId` history.
- `structure/04-frontend-architecture.md`: document `postNodeGenerateStream`, `partialImageUrl`, glow.
- `structure/05-node-mode.md`: document lifecycle `queued -> streaming -> partial -> done` and `recoveryRequestId`.

### ADD `tests/node-streaming-sse.test.js`

Coverage:

- Express app with `registerNodeRoutes`.
- Mock OAuth endpoint returns fixture SSE with partial and final events.
- `Accept: text/event-stream` response emits `partial` then `done`.
- Without SSE Accept, JSON fallback still works.
- Test uses local mock server only; no external network.

### MODIFY `tests/prompt-fidelity.test.js` or ADD source contract test

Assert:

- `partial_images` payload support exists.
- `routes/nodes.js` stores `requestId` in meta.
- `lib/historyList.js` returns `requestId`.
- `ui/src/lib/api.ts` defines `postNodeGenerateStream`.

## Verification

```bash
npm test
npm run build
cd ui && npx tsc -b --noEmit
git diff --check
```

Manual smoke checklist:

```text
Node mode -> root node prompt -> generate
Expected: glowing border starts immediately
Expected: partial preview appears if upstream emits partials
Expected: final image replaces partial preview
Expected: errors clear partial preview
Expected: reload recovery can match by requestId/recoveryRequestId
```
