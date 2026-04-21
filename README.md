# Image Gen

Minimal web UI for OpenAI `gpt-image-2` image generation.

## Features

- **Text-to-Image** — generate images from text prompts
- **Image-to-Image** — edit/inpaint existing images with prompts
- **Quality** — low / medium / high
- **Size** — 1024x1024 ~ 4K, plus auto
- **Format** — PNG / JPEG / WebP
- **Moderation** — auto (standard) / low (less restrictive)
- **Cost estimate** — per-request pricing based on quality & size
- **API billing** — check remaining credits
- **History** — session thumbnail strip with click-to-view
- **Download / Copy** — save or clipboard generated images

## Setup

```bash
cp .env.example .env
# Add your OpenAI API key to .env

npm install
npm start
# → http://localhost:3333
```

## .env

```
OPENAI_API_KEY=sk-proj-...
PORT=3333
```

## Tech Stack

- **Backend**: Express 5 + OpenAI SDK
- **Frontend**: Vanilla HTML/CSS/JS (single file, no build step)
- **Model**: `gpt-image-2`

## Pricing Reference (gpt-image-2)

| Quality | 1024x1024 | 1024x1536 | 1536x1024 |
|---------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    |
| Medium  | $0.053    | $0.041    | $0.041    |
| High    | $0.211    | $0.165    | $0.165    |
