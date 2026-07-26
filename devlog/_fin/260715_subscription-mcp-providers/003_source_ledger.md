# 003 — 공식 출처와 증거 상태

## Tier A

| Provider | 공식 출처 | 확인한 주장 | 남은 불확실성 |
|---|---|---|---|
| Higgsfield | https://higgsfield.ai/mcp | endpoint, OAuth/no API key, 기존 credits, 30+ models, async/history, MCP Apps의 Reframe/Upscale 등 | tools/list, extend/stitch tool |
| Higgsfield CLI | https://github.com/higgsfield-ai/cli , https://github.com/higgsfield-ai/cli/blob/main/MODELS.md | upload/job polling, start/end image, video/audio refs, Reframe/Draw-to-Video/Dubbing 등 platform schema | CLI와 MCP tool의 1:1 동일성은 보장 안 됨 |
| Higgsfield Extender | https://higgsfield.ai/ai-video-extender | forward/backward/two-way/target length/loop/prompt-guided native extension 제품 기능 | MCP 공개 여부 |
| Runway MCP | https://runwayml.com/news/mcp , https://help.runwayml.com/hc/en-us/articles/51931843164691-Connecting-to-Runway-MCP | endpoint, OAuth, plan credits, image/video generation, Streamable HTTP, Explore Mode 제외 | exact tools, Apps/Workflow 노출 |
| Runway Workflow | https://help.runwayml.com/hc/en-us/articles/47184761711379-Using-Utility-Nodes-in-Workflows , https://help.runwayml.com/hc/en-us/articles/51322758699411-Stitch-Videos | Stitch/trim/reverse/retime/FPS/resize/crop 기능이 플랫폼에 존재 | MCP 도구 여부 |
| Magnific | https://www.magnific.com/ai/docs/magnific-mcp | endpoint, paid-plan OAuth, account credits, image/video tools, batch, video concatenation | exact schemas, transport subtype, async/cancel; product/pipeline integration은 API 안내이므로 terms/permission |
| Krea | https://www.krea.ai/mcp | endpoint, OAuth, image/video/enhance/workflow, model roster | billing 문구와 exact tools |
| Recraft | https://www.recraft.ai/docs/mcp-reference/remote-server , https://www.recraft.ai/docs/mcp-reference/tools | endpoint, OAuth, subscription credit billing, tool names/params | live schema drift |
| Ideogram | https://ideogram.ai/features/mcp/ | endpoint, OAuth, same subscription, generate/edit/reframe/upscale/train examples | full tools/list/cancel |
| BFL FLUX | https://docs.bfl.ml/api_integration/mcp_integration | endpoint, OAuth, BFL credits, generate/edit/variations/history/credits exact tools | live schema drift |
| Pika experimental | https://experiment.pika.art/mcp | official endpoint, interactive auth, extend/re-cut/modify/trim/stitch/overlay/transition 등 공개 toolkit | experimental SLA, MCP별 과금, live schema |

## Tier B/C

| Provider | 공식 출처 | 확인한 주장 |
|---|---|---|
| HeyGen | https://developers.heygen.com/mcp/overview , https://www.heygen.com/model-context-protocol | endpoint, OAuth, existing plan credits, Video Agent/avatar/template/voice/lip-sync/translation/status/stop tools |
| Rendley | https://docs.rendley.com/mcp/getting-started/ , https://docs.rendley.com/mcp/authentication/ | endpoint, OAuth/API key, project/timeline editing/export/usage |
| Canva | https://www.canva.dev/docs/mcp/ , https://www.canva.dev/docs/mcp/tools/ , https://www.canva.dev/docs/mcp/usage-policy/ , https://www.canva.dev/docs/mcp/prohibited-use/ | endpoint, OAuth, plan별 tools, design generation/edit transaction/assets/resize/export; competitive product와 일부 third-party export 제한 |
| fal | https://fal.ai/docs/documentation/setting-up/mcp | endpoint, API key, 9 tools, 1,000+ models, async/cancel, same API pricing |
| Replicate | https://replicate.com/docs/reference/mcp , https://mcp.replicate.com/ | hosted/local official MCP, API token, complete HTTP API operations |
| Leonardo.Ai | https://docs.leonardo.ai/docs/connect-to-leonardoai-mcp | endpoint, API-Key/API plan, 현재 `generate-image`와 3개 model만 MCP 지원 |
| HiAPI | https://www.hiapi.ai/docs/for-ai/ , https://www.hiapi.ai/en/pricing | endpoint, bearer key, image/video/audio tools, prepaid pay-per-use 주장; 본문 재검증 필요 |
| MiniMax | https://platform.minimax.io/docs/guides/mcp-guide , https://github.com/MiniMax-AI/MiniMax-MCP | official self-host package, image/video/audio/music tools, API key, stdio/SSE/HTTP |
| Hera | https://docs.hera.video/mcp-server | endpoint, API key, create/get/upload 3 tools |
| Golpo | https://video.golpoai.com/guide/golpo-ai-mcp-server | official local MCP, API key, explainer generation/history/download |

## Lead/negative source state

- ZenCreator (`https://mcp.zencreator.pro/`)와 Varosity (`https://varosity.ai/`)는 provider-owned page를 확인했지만 규모·운영 안정성·독립 문서 증거가 부족해 lead다.
- Google Veo codelab (`https://codelabs.developers.google.com/adk-multimodal-tool-part-2?hl=en`)은 공식 sample이지 Google-managed MCP service가 아니다.
- Adobe Firefly, Freepik, Stability AI, Luma, Kling, Seedance, Sora, Midjourney, Synthesia, Captions, VEED는 이번 조사에서 provider-operated media MCP를 공식 원문으로 확인하지 못했다. 이는 부재 증명이 아니라 `not-verified` 판정이다.

## Evidence labels

- `official-public`: 원문에서 endpoint/auth/billing/tool이 직접 확인됨.
- `official-platform-only`: 기능은 provider 플랫폼에 있지만 MCP 노출은 확인 안 됨.
- `auth-required`: 공개 페이지로 부족하고 실제 계정 `tools/list`가 필요함.
- `inference`: 공식 정황에서 추론했지만 구현 계약으로 쓰지 않음.

`official-platform-only`와 `inference`는 adapter mapping의 근거로 사용할 수 없다. WP1의 sanitized `tools/list`가 `auth-required` 항목을 승격해야 한다.
