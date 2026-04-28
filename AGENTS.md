# ima2-gen — AI Context

## What This Project Does
GPT Image 2 (gpt-image-2) 이미지 생성기 CLI + 웹 UI
- OAuth (ChatGPT 계정) 또는 API Key 인증 지원
- 텍스트→이미지, 이미지→이미지(편집) 생성
- 병렬 생성 (최대 8장)

## Tech Stack
- Runtime: Node.js >=20 (ES Module)
- Server: Express 5
- API Client: OpenAI SDK v5
- OAuth: openai-oauth (ChatGPT 세션 프록시)
- Frontend: React + Vite (`ui/src`, built to `ui/dist`)

## Project Structure
```
image_gen/
├── bin/                  # CLI entry + subcommands
├── server.js             # Express bootstrap / static UI serving
├── config.js             # Runtime config
├── routes/               # API route modules (`*.ts` source)
├── lib/                  # Server helpers (`*.ts` source + emitted/legacy `*.js`)
├── ui/src/               # React/Vite app source
├── ui/dist/              # Built frontend served by server.js
├── site/                 # Astro marketing/docs site
├── integrations/comfyui/ # ComfyUI bridge/custom node
├── structure/            # Current architecture reference docs
├── devlog/               # `_plan`, `_fin`, `_spikes`
├── tests/                # node:test contracts/regressions
└── package.json
```

## Devlog Phase Roadmap
- Current active plans live under `devlog/_plan/`.
- Completed plans live under `devlog/_fin/`.
- Legacy phase docs live under `devlog/_plan/_legacy/`.
- Use `structure/07-devlog-map.md` and `devlog/_plan/README.md` as the current roadmap references.

## Conventions
- ES Module only (import/export)
- File length < 500 lines (split if exceeded)
- Function length < 50 lines
- try/catch mandatory for all async operations
- Config values in config.js or .env, never hardcode

## Test Command
```bash
npm test
cd ui && npx tsc -b --noEmit
cd ui && npm run build
```

## Heartbeat
- 20분마다 devlog/_plan 점검 및 다음 작업 제안
- 완료된 phase는 _fin/으로 이동 (YYMMDD_ prefix)
