# 02 — ComfyUI Custom Node Follow-Up

## Purpose

This is not PR1. It documents the follow-up direction so PR1 does not expand
into a broad integration.

The custom node lets ComfyUI call a running ima2 server.

```mermaid
flowchart LR
  A[ComfyUI node] --> B[ima2 server]
  B --> C[OAuth/OpenAI]
  B --> D[generated result]
  D --> E[Comfy IMAGE]
```

## Recommended Transport

Use direct HTTP to the ima2 server.

Avoid default subprocess execution:

```text
ComfyUI node -> ima2 gen subprocess
```

Reasons:

- shell quoting risk
- path discovery risk
- timeout handling is harder
- file output parsing is brittle
- security posture is weaker than direct HTTP

Subprocess may be kept as an explicit debug fallback only after the HTTP path is
stable.

## Node Pack Layout

Suggested path:

```text
integrations/comfyui/ima2_gen_bridge/
  __init__.py
  nodes.py
  README.md
```

Initial node:

```text
Ima2 Generate
```

Inputs:

| Input | Type | Notes |
|---|---|---|
| `prompt` | STRING | multiline |
| `server_url` | STRING | optional, default auto-discovery |
| `model` | enum | optional, default server config |
| `quality` | enum | low/medium/high |
| `size` | STRING | `1024x1024`, etc. |
| `moderation` | enum | auto/low |
| `timeout` | INT | bounded |

Outputs:

| Output | Type |
|---|---|
| `image` | IMAGE |
| `metadata` | STRING |

## PR2 Exact Node Contract

Planned files:

```text
integrations/comfyui/ima2_gen_bridge/
  __init__.py
  nodes.py
  README.md
```

`nodes.py` exposes:

```python
NODE_CLASS_MAPPINGS = {
    "Ima2Generate": Ima2Generate,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Ima2Generate": "Ima2 Generate",
}
```

The node function signature must provide defaults for optional ComfyUI inputs:

```python
def generate(
    self,
    prompt,
    server_url="",
    quality="medium",
    size="1024x1024",
    moderation="low",
    timeout=180,
    model="",
    mode="auto",
    web_search=True,
):
```

Model values must match currently supported image generation models only:

```text
"", "gpt-5.5", "gpt-5.4", "gpt-5.4-mini"
```

Do not expose `gpt-5.3-codex-spark`; the current server rejects it for image
generation.

The ComfyUI widget name may be `web_search`, but the ima2 HTTP payload key must
be `webSearchEnabled`. The custom node must not send a raw `web_search` JSON
field to ima2.

## PR2 HTTP Contract

The node calls the existing ima2 route:

```text
POST /api/generate
```

Request body:

```json
{
  "prompt": "<prompt>",
  "quality": "medium",
  "size": "1024x1024",
  "n": 1,
  "format": "png",
  "moderation": "low",
  "mode": "auto",
  "webSearchEnabled": true
}
```

`model` is included only when the user selects a non-empty model.

Headers:

```text
Content-Type: application/json
X-ima2-client: comfyui/bridge
```

Expected success response shape:

```json
{
  "image": "data:image/png;base64,...",
  "elapsed": "1.2",
  "filename": "1234_abcd.png",
  "requestId": "req_..."
}
```

The node reads the single-image `image` field and `filename`. It should not
require an `images[]` response.

## Server Discovery

The node should mirror the ima2 CLI discovery order where practical:

1. explicit `server_url`
2. `IMA2_SERVER`
3. `~/.ima2/server.json`
4. `http://127.0.0.1:3333`

Only loopback URLs are valid.

Accepted URL examples:

```text
http://127.0.0.1:3333
http://localhost:3333
http://[::1]:3333
```

Rejected URL examples:

```text
https://127.0.0.1:3333
http://192.168.0.2:3333
http://example.com:3333
http://user:pass@127.0.0.1:3333
http://127.0.0.1:3333/path
http://127.0.0.1:3333?x=1
```

Use direct Python HTTP with the standard library. Do not shell out to `ima2`.

## Exclusions

- No OpenAI API key field.
- No Codex/OAuth token file reads.
- No API-key provider selection.
- No runtime package install.
- No ComfyUI server route registration.
- No arbitrary local file reads.
- No workflow JSON manipulation.
- No subprocess invocation.
- No `shell=True`.
- No `provider: "api"` payload.

## Later / Uncommitted Image Input Node

This is not PR1 or PR2 scope. It remains an uncommitted later follow-up unless
user demand makes image input from ComfyUI back into ima2 worth prioritizing.

After `Ima2 Generate` is stable:

```text
Ima2 Edit / Reference Generate
```

It must:

- convert ComfyUI `IMAGE` tensors to temp PNG/JPEG
- call ima2 `/api/edit` or `/api/generate` references
- decode ima2 result data URL
- return ComfyUI `IMAGE`
- clean temp files
