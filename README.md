# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)

Minimal CLI + web UI for OpenAI `gpt-image-2` image generation.

![ima2-gen screenshot](assets/screenshot.png)

## Install & Run

```bash
npx ima2-gen serve
```

Or install globally:

```bash
npm install -g ima2-gen
ima2 serve
```

First run prompts you to choose:

```
  1) API Key  — paste your OpenAI API key (paid)
  2) OAuth    — login with ChatGPT account (free)
```

Then opens `http://localhost:3333`.

## CLI

```bash
ima2 serve    # start server (auto-setup on first run)
ima2 setup    # reconfigure auth
ima2 reset    # clear saved config
```

## Features

- **Dual provider** — OAuth (free, ChatGPT account) or API Key (paid)
- **Text-to-Image** — generate images from text prompts
- **Image-to-Image** — edit/inpaint with drag-and-drop
- **Quality** — low / medium / high
- **Size** — presets (1024 ~ 4K) + custom (any 16px-aligned ratio)
- **Format** — PNG / JPEG / WebP
- **Moderation** — auto (standard) / low (less restrictive)
- **Prompt display** — shown under image, click to copy
- **History** — persisted across page refreshes (localStorage)
- **Download / Copy** — save or clipboard

## Architecture

```
ima2 serve
  ├── Express (:3333)          ← web UI + API
  └── openai-oauth (:10531)    ← embedded OAuth proxy
```

## Config

Stored in `.ima2/config.json` (auto-created, gitignored).

Optional `.env`:
```
OPENAI_API_KEY=sk-proj-...
PORT=3333
OAUTH_PORT=10531
```

## Pricing (API Key mode)

| Quality | 1024x1024 | 1024x1536 | 1536x1024 |
|---------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    |
| Medium  | $0.053    | $0.041    | $0.041    |
| High    | $0.211    | $0.165    | $0.165    |

OAuth mode is free (uses your ChatGPT Plus/Pro subscription).

## License

MIT
