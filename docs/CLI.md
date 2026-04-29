# CLI Reference

Every server route under `/api/*` has a CLI wrapper. The CLI is a thin shell over the local server, so most commands require a running `ima2 serve` (the few exceptions — `serve`, `setup`, `doctor`, `status`, `open`, `reset`, `config` — work without a live server).

For a quick start, see the [main README](../README.md). For endpoint mapping, see [API.md](API.md).

## Server commands

| Command | Description |
|---|---|
| `ima2 serve [--dev]` | Start the local web server; `--dev` enables verbose server diagnostics |
| `ima2 setup` / `ima2 login` | Reconfigure saved auth (interactive) |
| `ima2 status` | Show config and OAuth status |
| `ima2 doctor` | Diagnose Node, package, config, and auth |
| `ima2 open` | Open the web UI in a browser |
| `ima2 reset` | Remove saved config |

## Common flags

These work on most client commands:

| Flag | Meaning |
|---|---|
| `--server <url>` | Override server discovery (default uses `~/.ima2/server.json`, falls back to `IMA2_SERVER` env) |
| `--json` | Emit machine-readable JSON instead of human-formatted output |
| `-h`, `--help` | Show subcommand help |

## Generation

| Command | Description |
|---|---|
| `ima2 gen <prompt>` | Generate from the CLI |
| `ima2 edit <file> --prompt <text>` | Edit an existing image |
| `ima2 multimode <prompt>` | Multi-image SSE generation (streams `phase` / `partial` / `image` events) |
| `ima2 node generate` | Node-mode generate (SSE; supports `--no-stream`) |
| `ima2 node show <nodeId>` | Read node metadata |

Generation flags include `--reasoning-effort {none\|low\|medium\|high\|xhigh}`, `--web-search` / `--no-web-search`, `--model`, `--mode`, `--moderation`, `--ref <file>` (repeatable, up to 5), `-q low|medium|high`, `-n <count>`, `-o <file>`.

```bash
ima2 gen "a poster of a samurai cat" --model gpt-5.4 --reasoning-effort high
ima2 edit input.png --prompt "make it rainy" --web-search
ima2 multimode "two cats playing" -n 2
ima2 node generate --node n_abc --prompt "add neon lights" --no-stream
```

## History and metadata

| Command | Description |
|---|---|
| `ima2 ls [--session <id>] [--favorites]` | List recent history |
| `ima2 show <name> [--metadata]` | Reveal a generated asset; optional embedded-metadata read |
| `ima2 history rm <name> [--permanent]` | Soft-delete (default) or permanently delete |
| `ima2 history restore --trash-id <id>` | Restore from trash |
| `ima2 history favorite <name>` | Toggle favorite (sends `X-Ima2-Browser-Id`) |
| `ima2 history import <file>` | Import a local image (raw PNG/JPEG/WEBP) into history |
| `ima2 metadata <file>` | Read embedded metadata from any local image (no server roundtrip needed for the read itself, but the route lives on the server) |

## Sessions and graphs

| Command | Description |
|---|---|
| `ima2 session ls / show <id> / create <title> / rm <id> / rename <id> <title>` | Session CRUD |
| `ima2 session graph save <id> --file <graph.json>` | Save a graph (uses GET-then-PUT with `If-Match` to guard against `GRAPH_VERSION_CONFLICT`) |
| `ima2 session graph load <id>` | Read the latest graph snapshot |
| `ima2 session style-sheet get <id> / put <id> --file <style.json> / enable <id> / disable <id> / extract <id>` | Style-sheet ops (advanced; UI no longer surfaces this — kept for API-level workflows) |

## Annotations and canvas

| Command | Description |
|---|---|
| `ima2 annotate get <name>` | Read annotation for an image |
| `ima2 annotate set <name> --body <json\|@file\|->` | Write annotation (sends `X-Ima2-Browser-Id`) |
| `ima2 annotate rm <name>` | Remove annotation |
| `ima2 canvas-versions save <imagefile> [--source <name>] [--prompt <text>]` | Save a raw PNG canvas version |
| `ima2 canvas-versions update <name> <imagefile>` | Update an existing canvas version |

## Prompt library

| Command | Description |
|---|---|
| `ima2 prompt ls [-q <search>] [--folder <id>] [--favorites]` | List prompts |
| `ima2 prompt show <id>` | Read one prompt |
| `ima2 prompt create --name <n> --text <t> [--folder <id>] [--tags <a,b>]` | Create |
| `ima2 prompt edit <id> [--name] [--text] [--folder] [--tags]` | Edit |
| `ima2 prompt rm <id>` | Delete |
| `ima2 prompt favorite <id>` | Toggle favorite |
| `ima2 prompt export <id> [-o <file>]` | Export one prompt to JSON |
| `ima2 prompt folder ls / create <name> / rename <id> <name> / rm <id> [--strategy moveToRoot\|deleteItems]` | Folder CRUD |
| `ima2 prompt import sources` | List configured import sources |
| `ima2 prompt import refresh --source <id>` | Re-index a source |
| `ima2 prompt import curated --source <id> --q <query>` | Curated import (commits prompts) |
| `ima2 prompt import discovery --q <query> --seeds <a,b,c>` | Discovery import (curator-only on some servers) |
| `ima2 prompt import folder <localpath>` | Import a local folder of prompts |

## Card News (gated)

Card News requires the server to be started with `IMA2_CARD_NEWS=1` (or `features.cardNews: true` in `~/.ima2/config.json`). When disabled, the CLI exits 2 with a clear message instead of producing a 404.

| Command | Description |
|---|---|
| `ima2 cardnews templates` | List image-templates and role-templates |
| `ima2 cardnews template preview <id>` | Preview an image template |
| `ima2 cardnews sets` | List card sets |
| `ima2 cardnews set show <id>` / `set manifest <id>` | Show a set or its manifest |
| `ima2 cardnews draft / generate / export [--data <json>]` | Pass-through bodies (server forwards `req.body`) |
| `ima2 cardnews job create [--data <json>]` | Create + start a job |
| `ima2 cardnews job show <jobId>` | Show one job |
| `ima2 cardnews job retry <jobId> [--cards <id,id>]` | Retry a job (optionally specific cards) |
| `ima2 cardnews card regenerate <cardId> [--data <json>]` | Regenerate a single card |

## Observability and jobs

| Command | Description |
|---|---|
| `ima2 ps` | Alias for `inflight ls` (kept for backward compatibility) |
| `ima2 cancel <id>` | Alias for `inflight rm` |
| `ima2 inflight ls [--kind classic\|node] [--session <id>] [--terminal]` | List active (and optionally terminal) jobs with phase / model / prompt |
| `ima2 inflight rm <requestId>` | Force-remove a stuck job |
| `ima2 storage status` | Storage inspection (richer than `doctor`) |
| `ima2 storage open` | Open the generated dir in the OS file manager (POST) |
| `ima2 billing` | API usage / quota |
| `ima2 providers` | Configured providers |
| `ima2 oauth status` | OAuth proxy state |
| `ima2 ping` | Health-check the running server |

## Config

`config` reads/writes `~/.ima2/config.json` (the file layer). Effective values follow `env > file > defaults`.

| Command | Description |
|---|---|
| `ima2 config path` | Print the config file path |
| `ima2 config ls [--effective]` | Print the file layer (default), or merged effective config with `--effective` |
| `ima2 config get <key>` | Read a dotted key from the effective config; secrets matching `/token\|secret\|apikey\|password/i` are redacted |
| `ima2 config set <key> <value>` | Write to the file layer; rejects unknown keys, refuses auth keys (`provider`, `apiKey`), warns when an env var is overriding the same key, prints a restart-required note |
| `ima2 config rm <key>` | Remove a key from the file layer |

Allowed keys (whitelist):

```
imageModels.default          imageModels.reasoningEffort
log.level                    features.cardNews
cardNewsPlanner.{enabled,model,timeoutMs,deterministicFallback}
comfy.{defaultUrl,uploadTimeoutMs,maxUploadBytes}
storage.{generatedDir,generatedDirName}
server.{port,host,bodyLimit}
oauth.{proxyPort,statusTimeoutMs,restartDelayMs}
limits.{maxRefCount,maxParallel}
history.{defaultPageSize,maxPageCap}
```

To change `provider` / `apiKey`, run `ima2 setup` or `ima2 login` instead.

## Other

| Command | Description |
|---|---|
| `ima2 comfy export <filename>` | Export a ComfyUI workflow (`POST /api/comfy/export-image`) |

## Discovery

The server writes `~/.ima2/server.json` on start. CLI commands read this file to find the actual port (the backend can fall back from `3333` to `3334+`). Override discovery with `--server <url>` or `IMA2_SERVER=http://localhost:3333`.

## Examples

```bash
# Generation with reasoning effort and web search
ima2 gen "poster" --model gpt-5.4 --moderation low --reasoning-effort high
ima2 edit input.png --prompt "make it rainy" --web-search
ima2 multimode "two cats playing" -n 2 -o cat_{i}.png

# History and metadata
ima2 ls --session sess_abc --favorites
ima2 show img_xyz.png --metadata
ima2 history import ./local.png

# Prompts
ima2 prompt ls -q sunset
ima2 prompt import refresh --source curated

# Observability
ima2 inflight ls --terminal
ima2 storage status --json

# Config
ima2 config set imageModels.reasoningEffort high
ima2 config get log.level
ima2 config ls --effective --json
```
