# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Minimal CLI + web UI for OpenAI **GPT Image 2** (`gpt-image-2`) image generation. Supports both **API Key** (paid) and **OAuth** (free, via ChatGPT account) authentication.

![ima2-gen screenshot](assets/screenshot.png)

## Quick Start

```bash
# Run instantly with npx (no install needed)
npx ima2-gen serve

# Or install globally
npm install -g ima2-gen
ima2 serve
```

On first run, you'll be prompted to choose an auth method:

```
  ima2-gen — GPT Image 2 Generator

  Choose authentication method:

    1) API Key  — paste your OpenAI API key (paid)
    2) OAuth    — login with ChatGPT account (free)
```

The web UI opens at `http://localhost:3333`.

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

### Client commands (require a running `ima2 serve`)
| Command | Description |
|---------|-------------|
| `ima2 gen <prompt>` | Generate image(s) from the CLI |
| `ima2 edit <file>` | Edit an existing image (requires `--prompt`) |
| `ima2 ls` | List recent history (table or `--json`) |
| `ima2 show <name>` | Reveal one history item (path / `--reveal`) |
| `ima2 ps` | List active jobs (`--kind`, `--session`) |
| `ima2 ping` | Health-check the running server |

The running server advertises itself at `~/.ima2/server.json`. Client commands auto-discover it; override with `--server <url>` or `IMA2_SERVER` env.

```bash
# start the server (one terminal)
ima2 serve

# in another terminal:
ima2 ping
ima2 gen "a shiba in space" -q high -o shiba.png
ima2 gen "merge these" --ref a.png --ref b.png -n 4 -d out/
ima2 ls -n 10
ima2 ps
```

Exit codes: `0` ok · `2` bad args · `3` server unreachable · `4` APIKEY_DISABLED · `5` 4xx · `6` 5xx · `7` safety refusal · `8` timeout.

## Features

| Feature | Description |
|---------|-------------|
| **Dual Auth** | OAuth (free via ChatGPT Plus/Pro) or API Key (paid, usage-based) |
| **Text-to-Image** | Generate images from text prompts with quality boosters |
| **Image-to-Image** | Edit/inpaint existing images with drag-and-drop upload |
| **Parallel Generation** | Generate up to 8 images simultaneously |
| **Quality Presets** | Low (fast) / Medium (balanced) / High (best) |
| **Size Options** | Standard presets (1024–4K) + custom size (any 16px-aligned ratio) |
| **Format** | PNG, JPEG, WebP output |
| **Moderation** | Auto (standard) or Low (less restrictive) |
| **Prompt Display** | Shows prompt under generated image, click to copy |
| **History** | Persisted across page refreshes via localStorage |
| **Download / Copy** | Save to file or copy to clipboard |
| **Billing Dashboard** | Shows API credit balance or monthly cost |

## Architecture

```
ima2 serve
  ├── Express server (:3333)
  │   ├── GET  /api/providers      — available auth methods
  │   ├── GET  /api/oauth/status   — OAuth proxy health check
  │   ├── POST /api/generate       — text-to-image (supports parallel via n)
  │   ├── POST /api/edit           — image-to-image inpainting
  │   ├── GET  /api/billing        — API credit / cost info
  │   └── Static files (public/)   — web UI
  │
  └── openai-oauth proxy (:10531)  — embedded OAuth proxy for ChatGPT auth
```

## Configuration

Config is stored in `.ima2/config.json` (auto-created, gitignored).

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key (skips OAuth) |
| `PORT` | `3333` | Web server port |
| `OAUTH_PORT` | `10531` | OAuth proxy port |

Create a `.env` file to set these:

```bash
cp .env.example .env
# Edit .env with your values
```

## API Pricing (API Key Mode)

| Quality | 1024×1024 | 1024×1536 | 1536×1024 | 2048×2048 | 3840×2160 |
|---------|-----------|-----------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    | $0.012    | $0.023    |
| Medium  | $0.053    | $0.041    | $0.041    | $0.106    | $0.200    |
| High    | $0.211    | $0.165    | $0.165    | $0.422    | $0.800    |

OAuth mode is **free** — uses your existing ChatGPT Plus/Pro subscription.

## Development

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev    # starts server with --watch for auto-reload
npm test       # run tests
```

## Tech Stack

- **Runtime**: Node.js (>=18)
- **Server**: Express 5
- **API Client**: OpenAI SDK v5
- **OAuth**: openai-oauth (ChatGPT session proxy)
- **Frontend**: Vanilla HTML/CSS/JS (Outfit + Geist Mono fonts)
- **Testing**: Node.js built-in test runner

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server + static file serving |
| `openai` | Official OpenAI API client |
| `openai-oauth` | ChatGPT OAuth proxy for free image generation |
| `dotenv` | Environment variable loading |

## Troubleshooting

**`ima2 doctor` fails on node_modules**
→ Run `npm install`

**OAuth login not working**
→ Run `npx @openai/codex login` manually, then `ima2 serve`

**Port already in use**
→ Set `PORT=3334` in `.env` or run `PORT=3334 ima2 serve`

**Images not generating**
→ Check `ima2 status` to verify config. Ensure API key starts with `sk-`.

## Release

```bash
npm run release:patch   # 1.0.2 → 1.0.3
npm run release:minor   # 1.0.x → 1.1.0
npm run release:major   # 1.x.x → 2.0.0
```

## License

MIT
