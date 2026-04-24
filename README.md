# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **Read in other languages**: [한국어](docs/README.ko.md) · [日本語](docs/README.ja.md) · [简体中文](docs/README.zh-CN.md)

A minimal CLI and web UI for OpenAI's **GPT Image 2** (`gpt-image-2`) image generation. Supports OAuth (free via ChatGPT Plus/Pro) or API key authentication. Features include parallel generation, multi-image references, CLI automation, and persistent history.

![ima2-gen screenshot](assets/screenshot.png)

---

## Quick Start

```bash
# Run instantly with npx (no install)
npx ima2-gen serve

# Or install globally
npm install -g ima2-gen
ima2 serve
```

First run prompts you to pick an auth method:

```
  Choose authentication method:
    1) API Key  — paste your OpenAI API key (paid)
    2) OAuth    — login with ChatGPT account (free)
```

Web UI opens at `http://localhost:3333`.

---

## Features

All features shown in the screenshot are available today:

### Authentication
- **OAuth** — log in with your ChatGPT Plus/Pro account, $0 per image
- **API Key** — paste your `sk-...` key, pay per call

Authentication status is indicated live in the left panel (green dot = ready, red dot = disabled). By default, the API key method is disabled, making OAuth the primary route.

### Generation controls
| Control | Options |
|---------|---------|
| **Quality** | Low (fast) · Medium (balanced) · High (best) |
| **Size** | `1024²` `1536×1024` `1024×1536` `1360×1024` `1024×1360` `1824×1024` `1024×1824` `2048²` `2048×1152` `1152×2048` `3824×2160` `2160×3824` · `auto` · custom |
| **Format** | PNG · JPEG · WebP |
| **Moderation** | Low (relaxed filter, default) · Auto (standard filter) |
| **Count** | 1 · 2 · 4 parallel |

All sizes adhere to `gpt-image-2` constraints: every side must be a multiple of 16, the long-to-short ratio must be ≤ 3:1, and the total pixel count must be between 655,360 and 8,294,400.

### Workflow
- **Multi-reference**: Attach up to 5 reference images by dragging and dropping them anywhere on the left panel.
- **Prompt with context**: Combine text and reference images in a single request.
- **Use current**: Re-use the selected image as a new reference with a single click.
- **Canvas actions**: Download, copy to clipboard, or copy the prompt directly from the canvas.
- **Sticky gallery strip**: A fixed-position gallery strip at the bottom that never scrolls out of view.
- **Gallery modal (+)**: A comprehensive grid view of your entire generation history.
- **Session persistence**: Safely refresh the page mid-generation; your pending jobs will automatically reconcile.

### CLI (Headless Automation)
```bash
ima2 gen "a shiba in space" -q high -o shiba.png
ima2 gen "merge these" --ref a.png --ref b.png -n 4 -d out/
ima2 ls -n 10
ima2 ps
ima2 ping
```

See the full command matrix below.

---

## CLI Commands

### Server commands
| Command | Alias | Description |
|---------|-------|-------------|
| `ima2 serve` | — | Start the web server (auto-setup on first run) |
| `ima2 setup` | `login` | Reconfigure authentication method |
| `ima2 status` | — | Show current config & auth status |
| `ima2 doctor` | — | Diagnose environment & dependencies |
| `ima2 open` | — | Open web UI in browser |
| `ima2 reset` | — | Clear saved configuration |
| `ima2 --version` | `-v` | Show version |
| `ima2 --help` | `-h` | Show help |

### Client Commands (requires a running `ima2 serve`)
| Command | Description |
|---------|-------------|
| `ima2 gen <prompt>` | Generate image(s) from the CLI |
| `ima2 edit <file>` | Edit an existing image (requires `--prompt`) |
| `ima2 ls` | List recent history (table or `--json`) |
| `ima2 show <name>` | Reveal one history item (`--reveal`) |
| `ima2 ps` | List active jobs (`--kind`, `--session`) |
| `ima2 ping` | Health-check the running server |

The running server advertises its port via `~/.ima2/server.json`. Client commands will automatically discover it; you can override this by using `--server <url>` or setting `IMA2_SERVER=...`.

### Exit codes
`0` OK · `2` Bad arguments · `3` Server unreachable · `4` APIKEY_DISABLED · `5` 4xx error · `6` 5xx error · `7` Safety refusal · `8` Timeout.

---

## Roadmap

Public roadmap (subject to change). Version numbers reflect the actual release cycle, not time estimates.

### ✅ Shipped
- **0.06** Session DB — SQLite-backed history with sidecar JSON
- **0.07** Multi-reference — up to 5 attachments, i2i merged into unified flow
- **0.08** In-flight tracking — Refresh-safe pending state and phase tracking
- **0.09** Node mode (dev-only) — Graph-based canvas for branching generations
- **0.09.1** CLI integration — `gen` / `edit` / `ls` / `show` / `ps` / `ping` + `/api/health` + port advertisement

### 🚧 0.10 — Compare & Reuse (Current Cycle)
- **F3 Prompt presets** — Save and apply `{prompt, refs, quality, size}` bundles
- **F3 Gallery groupBy** — Group by `preset`, `date`, or `compareRun`
- **F2 Batch A/B compare** — Spawn 2–6 parallel variants from a single prompt with keyboard-driven judging (`1-6`, `Space` = winner, `V` = variation, `P` = save preset)
- **F4 Export bundle** — Zip selected images along with a `manifest.json` and a `.txt` prompt file per image
- Every server action ships with its CLI counterpart (`ima2 preset / compare / export`)

### 🔭 0.11 — Card-News Mode
- Instagram carousel generation (4, 6, or 10 cards)
- Maintain style consistency via `file_id` fan-out (instead of `previous_response_id` or seeds)
- Support parallel card regeneration without breaking the style chain

### 🔭 0.12 — Style Kit
- Codified house-style presets using style-reference uploads
- Optional `input_fidelity: "high"` for identity-critical edits

### 🗂 Backlog
- Dark/light mode toggle for the Web UI
- Overlay cheat-sheet for keyboard shortcuts
- Collaborative sessions (shared SQLite via WebSocket)
- Plugin system for custom post-processing tasks

---

## Architecture

```
ima2 serve
  ├── Express server (:3333)
  │   ├── GET  /api/health         — version, uptime, activeJobs, pid
  │   ├── GET  /api/providers      — available auth methods
  │   ├── GET  /api/oauth/status   — OAuth proxy health check
  │   ├── POST /api/generate       — text+ref → image (parallel via n)
  │   ├── POST /api/edit           — ref-heavy edit path
  │   ├── GET  /api/history        — paginated sidecar listing
  │   ├── GET  /api/inflight       — in-progress jobs (kind/session filters)
  │   ├── GET  /api/sessions/*     — node-graph sessions (dev-only)
  │   ├── GET  /api/billing        — API credit / cost info
  │   └── Static files (public/)   — web UI
  │
  ├── openai-oauth proxy (:10531)  — embedded OAuth relay
  └── ~/.ima2/server.json          — port advertisement for CLI auto-discovery
```

**Node mode** is dev-only (`npm run dev`) and will remain excluded from npm releases until the session DB and multi-user features are finalized.

---

## Configuration

Configuration is stored in `~/.ima2/config.json` (auto-created and gitignored).

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key (skips OAuth) |
| `PORT` | `3333` | Web server port |
| `OAUTH_PORT` | `10531` | OAuth proxy port |
| `IMA2_SERVER` | — | Client: override target server URL |

```bash
cp .env.example .env
```

---

## API Pricing (API Key Mode Only)

| Quality | 1024×1024 | 1024×1536 | 1536×1024 | 2048×2048 | 3840×2160 |
|---------|-----------|-----------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    | $0.012    | $0.023    |
| Medium  | $0.053    | $0.041    | $0.041    | $0.106    | $0.200    |
| High    | $0.211    | $0.165    | $0.165    | $0.422    | $0.800    |

**OAuth mode is free** — usage is billed against your existing ChatGPT Plus/Pro subscription.

---

## Development

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev    # server with --watch + Node mode enabled
npm test       # 92+ tests covering health checks, CLI library, commands, and the server
```

Frontend Stack:
- Vite + React for the web UI and Node-mode canvas
- Zustand for UI/session state
- Fonts: Outfit and Geist Mono

## Tech Stack
- **Runtime**: Node.js ≥20
- **Server**: Express 5, SQLite (better-sqlite3)
- **API**: OpenAI SDK v5
- **OAuth**: `openai-oauth` proxy
- **Tests**: Node built-in test runner

---

## Troubleshooting

**Port already in use / "Why is it on 3457?"**
→ The default port is `3333`. If the `PORT` environment variable is set in your shell (e.g., inherited from another server like `cli-jaw`), `ima2` will use it instead. You can unset it or run `PORT=3333 ima2 serve`.

**`ima2 ping` says server unreachable**
→ Ensure that `ima2 serve` is running. Check `~/.ima2/server.json` or override the target URL using `ima2 ping --server http://localhost:3333`.

**OAuth login not working**
→ Manually run `npx @openai/codex login`, and then start the server with `ima2 serve`.

**`ima2 doctor` fails on `node_modules`**
→ Run `npm install`.

**Images not generating**
→ Run `ima2 status` to verify your configuration. If you are using an API key, it must start with `sk-`.

---

## Release

```bash
npm run release:patch   # 1.0.2 → 1.0.3
npm run release:minor   # 1.0.x → 1.1.0
npm run release:major   # 1.x.x → 2.0.0
```

## License

MIT
