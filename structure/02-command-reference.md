---
created: 2026-04-23
tags: [ima2-gen, CLI, commands, automation]
aliases: [ima2 CLI, ima2 commands, image generation CLI]
---

# Command Reference

The `ima2` CLI lets users configure the server, generate images, edit images, inspect history, and list active jobs without opening the browser UI. Server commands and server-client commands share the same entrypoint.

This matters because `ima2-gen` is both a browser app and an automation tool. Users can run `npx ima2-gen serve` for an instant local app, while scripts can call `ima2 gen` or `ima2 edit` against the same server. If the CLI contract drifts, README examples, tests, server discovery, and API response handling drift with it.

Before using client commands, make sure a server is running. `ima2 serve` starts the server and OAuth proxy, then advertises the actual bound URL in `~/.ima2/server.json`. Client commands such as `ima2 gen`, `ima2 edit`, `ima2 ls`, `ima2 ps`, and `ima2 ping` use that advertisement file or an override to find the server, including fallback ports when the default is busy.

---

## Execution Flow

```mermaid
sequenceDiagram
    participant User as User
    participant CLI as ima2 CLI
    participant Adv as ~/.ima2/server.json
    participant Server as Express server
    participant OAuth as openai-oauth

    User->>CLI: ima2 serve
    CLI->>Server: tsx server.ts (dev) / node server.js (publish)
    Server->>OAuth: start local proxy
    Server->>Adv: advertise port
    User->>CLI: ima2 gen prompt
    CLI->>Adv: read advertised port
    CLI->>Server: POST /api/generate
    Server->>OAuth: image request
    Server-->>CLI: image data and filename
```

## Server Commands

| Command | Alias | Role | Main files |
|---|---|---|---|
| `ima2 serve [--dev]` | none | Run setup if needed and start the server; `--dev` enables verbose diagnostics | `bin/ima2.ts`, `server.ts` |
| `ima2 setup` | `login` | Configure API key or OAuth interactively | `bin/ima2.ts` |
| `ima2 status` | none | Show config, provider, and OAuth session state | `bin/ima2.ts`, `lib/codexDetect.ts` |
| `ima2 doctor` | none | Check Node, package, node_modules, config, and storage state | `bin/ima2.ts`, `bin/lib/storage-doctor.ts` |
| `ima2 open` | none | Open the web UI at the advertised or default port | `bin/ima2.ts`, `bin/lib/platform.ts` |
| `ima2 reset` | none | Reset `~/.ima2/config.json` to an empty object | `bin/ima2.ts` |
| `ima2 --version` | `-v` | Print the package version | `bin/ima2.ts`, `package.json` |
| `ima2 --help` | `-h` | Print top-level help | `bin/ima2.ts` |

## Client Commands

The CLI surface was expanded to near-feature-parity with the server API in #45 (`feat(cli): full feature parity with server API`, commit 9698fc1). The table below groups commands by the API surface they wrap. Run `ima2 <command> --help` for full per-command flags.

| Command | Server API | Role |
|---|---|---|
| `ima2 gen <prompt>` | `POST /api/generate` | Generate image(s) from a prompt and optional references |
| `ima2 edit <file>` | `POST /api/edit` | Edit an existing image with a prompt |
| `ima2 multimode <spec>` | `POST /api/generate/multimode` | Run a multimode generation sequence |
| `ima2 node <subcommand>` | `/api/node/*` | Node-mode generate/show/list (graph-aware) |
| `ima2 session <subcommand>` | `/api/sessions*` | List/load/save/rename/delete sessions and style sheets |
| `ima2 history <subcommand>` | `/api/history*` | List, show, favorite, restore, soft-delete, permanent-delete history items |
| `ima2 prompt <subcommand>` | `/api/prompts*` and `/api/prompt-import/*` | Prompt library list/show/save/delete/import/export |
| `ima2 annotate <subcommand>` | `/api/annotations/:filename` | Get/put/delete canvas annotations |
| `ima2 canvas-versions <subcommand>` | `/api/canvas-versions*` | List/save canvas version snapshots |
| `ima2 metadata <subcommand>` | `/api/metadata/read` | Read embedded XMP metadata from images |
| `ima2 comfy <subcommand>` | `/api/comfy/export-image` | Export images to a ComfyUI bridge workspace |
| `ima2 cardnews <subcommand>` | `/api/cardnews/*` | Dev-gated card-news templates/sets/jobs |
| `ima2 config <get\|set>` | local | Read/write `~/.ima2/config.json` |
| `ima2 inflight <subcommand>` | `/api/inflight*` | List/cancel running jobs (alias surface for `ps`/`cancel`) |
| `ima2 storage <subcommand>` | `/api/storage*` | Storage status and open generated dir |
| `ima2 billing` | `/api/billing` | Show billing/usage summary |
| `ima2 providers` | `/api/providers` | Show available providers and modes |
| `ima2 oauth <subcommand>` | `/api/oauth*` | OAuth status and helpers |
| `ima2 ls` | `GET /api/history` | History list (legacy alias of `history list`) |
| `ima2 show <name>` | `GET /api/history` plus file path | Show or reveal one history item |
| `ima2 ps` | `GET /api/inflight` | List running classic/node jobs (legacy alias of `inflight list`) |
| `ima2 cancel <requestId>` | `DELETE /api/inflight/:requestId` | Mark a running/known job as canceled (legacy alias of `inflight cancel`) |
| `ima2 ping` | `GET /api/health` | Check server reachability and health |

## `gen` Options

| Option | Default | Description |
|---|---|---|
| `-q`, `--quality` | `low` | Passes `low`, `medium`, `high`, or `auto` |
| `-s`, `--size` | `1024x1024` | Passes `WxH` or `auto` |
| `-n`, `--count` | `1` | Generation count; CLI clamps from 1 to 8 |
| `--ref <file>` | none | Attach a reference image; max 5 |
| `-o`, `--out <file>` | generated name | Save path for one image |
| `-d`, `--out-dir <dir>` | current directory | Save directory for multiple images |
| `--json` | false | Print machine-readable JSON |
| `--no-save` | false | Print base64 to stdout without writing files |
| `--force` | false | Allow large base64 output to a TTY |
| `--stdin` | false | Read extra prompt text from stdin |
| `--timeout <sec>` | `180` | HTTP request timeout |
| `--server <url>` | auto-discovered | Override server discovery |
| `--model <id>` | server default | Image model: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, or server-rejected `gpt-5.3-codex-spark` |
| `--mode <auto|direct>` | `auto` | Prompt handling mode |
| `--moderation <auto|low>` | `low` | OAuth moderation level |
| `--reasoning-effort <low|medium|high>` | server default | Reasoning effort hint for prompt-aware models |
| `--web-search` / `--no-web-search` | server default | Toggle Responses-API web search for the request |
| `--session <id>` | none | Apply enabled session style sheet |

## `edit` Options

| Option | Default | Description |
|---|---|---|
| `-p`, `--prompt` | required | Edit instruction |
| `-q`, `--quality` | `low` | Edit quality |
| `-s`, `--size` | `1024x1024` | Output size |
| `-o`, `--out <file>` | generated name | Save path |
| `--json` | false | Print machine-readable JSON |
| `--timeout <sec>` | `180` | HTTP request timeout |
| `--server <url>` | auto-discovered | Target server URL |
| `--model <id>` | server default | Image model: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, or server-rejected `gpt-5.3-codex-spark` |
| `--mode <auto|direct>` | `auto` | Prompt handling mode |
| `--moderation <auto|low>` | `low` | OAuth moderation level |
| `--reasoning-effort <low|medium|high>` | server default | Reasoning effort hint for prompt-aware models |
| `--web-search` / `--no-web-search` | server default | Toggle Responses-API web search for the request |
| `--session <id>` | none | Apply enabled session style sheet |

## `ps` Options

| Option | Default | Description |
|---|---|---|
| `--kind <classic|node>` | all | Filter running jobs by kind |
| `--session <id>` | all | Filter running jobs by session |
| `--terminal` | false | Include recently completed/error/canceled jobs |
| `--json` | false | Print machine-readable JSON |
| `--server <url>` | auto-discovered | Target server URL |

## `cancel`

`ima2 cancel <requestId>` calls `DELETE /api/inflight/:requestId`. It marks the job as canceled in the local server registry; it does not guarantee that an upstream provider request was physically killed.

## Server Discovery Priority

| Priority | Source | Description |
|---:|---|---|
| 1 | `--server <url>` | Strongest per-command override |
| 2 | `IMA2_SERVER` | Environment override for client commands |
| 3 | `~/.ima2/server.json` | URL/port advertisement written by the running server |
| 4 | `http://localhost:3333` | Default fallback |

## Exit Codes

| Code | Meaning |
|---:|---|
| 0 | Success |
| 2 | Bad CLI arguments |
| 3 | Server unreachable |
| 4 | `APIKEY_DISABLED` |
| 5 | 4xx response |
| 6 | 5xx response |
| 7 | Safety refusal |
| 8 | Timeout |

## Sync Checklist

- [ ] If top-level commands in `bin/ima2.ts` change, update the server-command table.
- [ ] If `bin/commands/*.ts` options change, update the option tables and README.
- [ ] If `bin/lib/client.ts` discovery order changes, update this doc and `[[06-infra-operations]]`.
- [ ] If API response shape changes, update `[[03-server-api]]` and CLI normalization logic.
- [ ] If exit-code mapping changes, update README and tests.

## Change Log

- 2026-04-23: Documented the current CLI command surface and discovery contract.
- 2026-04-23: Translated this document from Korean to English.
- 2026-04-26: Added classic CLI parity options, cancel command, terminal inflight listing, and actual-port discovery notes.
- 2026-04-28: Documented the `serve --dev` verbose diagnostics flag and storage-doctor inclusion in `ima2 doctor`. Note that prompt-library, image-metadata, and card-news endpoints have no CLI client today; access them through the web UI or direct HTTP.
- 2026-04-30: Captured the CLI feature-parity #45 surface (multimode, node, session, history, prompt, annotate, canvas-versions, metadata, comfy, cardnews, config, inflight, storage, billing, providers, oauth) and documented the new `--reasoning-effort` and `--web-search` / `--no-web-search` flags on `gen`/`edit`. Switched all `bin/*` path references from `.js` to `.ts` source.

Previous document: `[[01-file-function-map]]`

Next document: `[[03-server-api]]`
