# API Reference

This document lists the local HTTP API exposed by `ima2 serve`.

Base URL:

```text
http://localhost:3333
```

## Provider Policy

Image generation is OAuth-only in the current build.

- `provider: "oauth"` is the supported generation path.
- `provider: "api"` returns `403` with `APIKEY_DISABLED` for image generation, edit, and node generation.
- API keys may still be used by auxiliary developer paths such as billing checks or style-sheet extraction.

## Health And Status

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/health` | Server health, version, paths, provider policy |
| `GET` | `/api/providers` | Provider availability; API-key generation is disabled |
| `GET` | `/api/oauth/status` | OAuth proxy status and visible models |
| `GET` | `/api/billing` | Billing/status probe, including API key source when configured |

## Storage

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/storage/status` | Summarized gallery storage status for support UI |
| `POST` | `/api/storage/open-generated-dir` | Ask the server process to open the generated image folder |

`GET /api/storage/status` returns a support-safe summary, not raw legacy path arrays by default.

```json
{
  "ok": true,
  "data": {
    "generatedDirLabel": "~/.ima2/generated",
    "generatedCount": 0,
    "legacyCandidatesScanned": 18,
    "legacySourcesFound": 0,
    "legacyFilesFound": 0,
    "state": "not_found",
    "messageKind": "apology",
    "recoveryDocsPath": "docs/RECOVER_OLD_IMAGES.md",
    "doctorCommand": "ima2 doctor",
    "overrides": {
      "generatedDir": false,
      "configDir": false
    }
  }
}
```

Storage `state` values:

| State | Meaning |
|---|---|
| `ok` | Current gallery has files or no recovery notice is needed |
| `recoverable` | Legacy folders/files are still present and may be recoverable |
| `not_found` | Current gallery is empty and no legacy folder was found |
| `unknown` | Storage status inspection failed or was incomplete |

`POST /api/storage/open-generated-dir` opens the generated image folder on the machine running `ima2 serve`. If the browser is connected to a remote server, VM, container, WSL instance, or another computer on the network, this action targets that server machine, not necessarily the browser device.

## In-Flight Jobs

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/inflight` | Active jobs only by default |
| `GET` | `/api/inflight?includeTerminal=1` | Includes recent terminal jobs for debugging |
| `DELETE` | `/api/inflight/:requestId` | Cancel or forget an active job |

In-flight logs and responses use `requestId` for correlation. Logs should not include raw prompts, reference data URLs, generated base64, tokens, cookies, auth headers, or raw upstream bodies.

## Generation

### `POST /api/generate`

Text-to-image and reference-guided root generation.

```json
{
  "prompt": "a shiba in space",
  "quality": "medium",
  "size": "1024x1024",
  "format": "png",
  "moderation": "low",
  "provider": "oauth",
  "model": "gpt-5.4",
  "references": [],
  "requestId": "optional-client-id"
}
```

Supported quality values: `low`, `medium`, `high`.

Supported moderation values: `auto`, `low`.

Recommended model: `gpt-5.4`. Current app default: `gpt-5.4-mini`. `gpt-5.5` is the strongest quality option when supported, but callers should expect higher quota pressure and possible Codex CLI/backend capability requirements.

### `POST /api/edit`

Image edit / image-to-image generation.

The request includes a prompt and image payload. Like `/api/generate`, this route rejects `provider: "api"` unless API-key image generation is intentionally implemented in code.

### `POST /api/node/generate`

Node-mode generation and child edits.

Body fields:

```json
{
  "parentNodeId": "optional-server-node-id",
  "prompt": "continue this image",
  "quality": "medium",
  "size": "1024x1024",
  "format": "png",
  "moderation": "low",
  "model": "gpt-5.4",
  "references": [],
  "externalSrc": "optional-history-url",
  "sessionId": "session-id",
  "clientNodeId": "client-node-id",
  "requestId": "request-id",
  "provider": "oauth"
}
```

When `parentNodeId` is present, the server loads the stored parent node image and uses the edit path. Extra node references are currently supported only for root nodes.

The route can stream Server-Sent Events when the client sends `Accept: text/event-stream`. Possible events include `phase`, `partial`, `done`, and `error`.

### `GET /api/node/:nodeId`

Fetch stored node metadata and asset URL.

## Reference Images

Reference uploads are capped at 5 items. The frontend compresses large JPEG/PNG files before sending them. HEIC/HEIF files are rejected with a user-facing conversion hint.

Server-side validation may return these reference codes:

| Code | Meaning |
|---|---|
| `REF_NOT_ARRAY` | `references` was not an array |
| `REF_TOO_MANY` | More than the configured reference count |
| `REF_NOT_STRING` | A reference item was not a string |
| `REF_EMPTY` | A reference item was empty |
| `REF_TOO_LARGE` | A reference exceeded the configured base64 size |
| `REF_NOT_BASE64` | A reference was not valid base64 |

## History

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/history` | List generated assets |
| `GET` | `/api/history?groupBy=session` | Group assets by session title |
| `DELETE` | `/api/history/:filename` | Tombstone a generated asset |
| `POST` | `/api/history/:filename/restore` | Restore a recently deleted asset |

History rows can include node metadata such as `sessionId`, `nodeId`, `clientNodeId`, `requestId`, and `refsCount`.

## Sessions And Graphs

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/sessions` | List graph sessions |
| `POST` | `/api/sessions` | Create a session |
| `GET` | `/api/sessions/:id` | Load a session and graph |
| `PATCH` | `/api/sessions/:id` | Rename a session |
| `DELETE` | `/api/sessions/:id` | Delete a session |
| `PUT` | `/api/sessions/:id/graph` | Save graph snapshot |

`PUT /api/sessions/:id/graph` requires an `If-Match` header containing the current graph version.

Version mismatch returns `GRAPH_VERSION_CONFLICT` and the current version. This only means the client saved against a stale graph version; it is not proof that another browser tab changed the graph.

Graph save requests may include observability headers:

```text
X-Ima2-Graph-Save-Id
X-Ima2-Graph-Save-Reason
X-Ima2-Tab-Id
```

## Style Sheets

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/sessions/:id/style-sheet` | Load session style sheet |
| `PUT` | `/api/sessions/:id/style-sheet` | Save style sheet |
| `PATCH` | `/api/sessions/:id/style-sheet/enabled` | Toggle style sheet usage |
| `POST` | `/api/sessions/:id/style-sheet/extract` | Extract style fields from prompt/reference |

Style-sheet extraction can require an API key/openai client. This does not reopen API-key image generation.

## Common Error Codes

| Code | Meaning |
|---|---|
| `APIKEY_DISABLED` | API-key image generation is disabled |
| `INVALID_IMAGE_MODEL` | Model name is unknown or unsupported |
| `IMAGE_MODEL_UNSUPPORTED` | Model exists but cannot use image generation |
| `INVALID_MODERATION` | Moderation value is not `auto` or `low` |
| `SAFETY_REFUSAL` | Upstream safety refusal |
| `MODERATION_REFUSED` | Content generation refused by moderation |
| `AUTH_CHATGPT_EXPIRED` | Codex/ChatGPT OAuth session expired |
| `AUTH_API_KEY_INVALID` | API key is invalid, revoked, out of quota, or wrong org |
| `NETWORK_FAILED` | Network, proxy, VPN, or firewall failure |
| `OAUTH_UNAVAILABLE` | Local OAuth proxy is not available |
| `OPEN_GENERATED_DIR_FAILED` | The server could not open the generated image folder |
| `GRAPH_VERSION_REQUIRED` | Missing graph `If-Match` header |
| `GRAPH_VERSION_CONFLICT` | Stale graph version |
| `GRAPH_TOO_LARGE` | Graph exceeds node/edge limits |
| `NODE_NOT_FOUND` | Node metadata was not found |

## CLI Discovery

The server writes an advertisement file at:

```text
~/.ima2/server.json
```

CLI commands such as `ima2 ping`, `ima2 gen`, and `ima2 ls` use this file unless `--server` or `IMA2_SERVER` is provided.

Current shape:

```json
{
  "port": 3334,
  "url": "http://localhost:3334",
  "pid": 12345,
  "startedAt": 1777180000000,
  "version": "1.0.0",
  "backend": {
    "configuredPort": 3333,
    "actualPort": 3334,
    "url": "http://localhost:3334"
  },
  "oauth": {
    "configuredPort": 10531,
    "actualPort": 10532,
    "url": "http://127.0.0.1:10532",
    "status": "ready"
  }
}
```

Top-level `port` and `url` are kept for older CLI clients. New code should prefer `backend.url`.
