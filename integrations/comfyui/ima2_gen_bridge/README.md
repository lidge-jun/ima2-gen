# ima2-gen ComfyUI Bridge

This custom node lets ComfyUI call a running local `ima2-gen` server and return
the generated image as a ComfyUI `IMAGE`.

## Install

Copy or symlink this folder into your ComfyUI custom nodes directory:

```bash
ComfyUI/custom_nodes/ima2_gen_bridge
```

For development from this repository:

```bash
ln -s /path/to/ima2-gen/integrations/comfyui/ima2_gen_bridge \
  /path/to/ComfyUI/custom_nodes/ima2_gen_bridge
```

Restart ComfyUI after installing.

## Prerequisite

Start the ima2 server before queueing the node:

```bash
ima2 serve
```

The node never asks for OpenAI credentials. It only calls the local ima2 HTTP
server you already started.

## Node

Add the node from:

```text
Add Node -> ima2-gen -> Ima2 Generate
```

Inputs:

| Input | Description |
| --- | --- |
| `prompt` | Text prompt sent to ima2. |
| `server_url` | Optional loopback ima2 server origin. Leave empty for auto-discovery. |
| `quality` | `low`, `medium`, or `high`. |
| `size` | Image size string such as `1024x1024`. |
| `moderation` | `low` or `auto`. |
| `timeout` | Request timeout in seconds. |
| `model` | Optional ima2 image model override. |
| `mode` | `auto` or `direct` prompt mode. |
| `web_search` | Maps to ima2 `webSearchEnabled`. |

Outputs:

| Output | Description |
| --- | --- |
| `image` | Generated ComfyUI `IMAGE`. |
| `filename` | Saved ima2 generated filename. |
| `metadata` | JSON metadata string with request details. |

## Server Discovery

When `server_url` is empty, the node checks:

1. `IMA2_SERVER`
2. `IMA2_ADVERTISE_FILE`
3. `IMA2_CONFIG_DIR/server.json`
4. `~/.ima2/server.json`
5. `http://127.0.0.1:3333`

Only loopback HTTP origins are accepted:

```text
http://127.0.0.1:3333
http://localhost:3333
http://[::1]:3333
```

Remote hosts, credentials, paths, queries, fragments, and HTTPS URLs are
rejected.

## Scope

This PR2 node is text-to-image only. Image input, edit, reference generation,
and workflow automation are later follow-ups.
