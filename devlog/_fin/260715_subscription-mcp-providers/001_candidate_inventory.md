# 001 — 공식 미디어 MCP 후보 원장

조사 기준일: 2026-07-15. 검색 결과 snippet이 아니라 provider 공식 페이지·문서·공식 GitHub를 열어 확인한 후보만 채택했다.

## 평가 기준

- Official: provider 회사가 직접 운영하거나 공식 org에서 배포하는가.
- Transport: ima2-gen Node 서버에서 쓸 수 있는 Streamable HTTP인가, local stdio bridge가 필요한가.
- Auth/billing: 기존 구독 OAuth/credits인가, 별도 API key/paygo인가.
- Media fit: 이미지/영상 생성 외에 edit·extend·stitch·reframe·upscale가 있는가.
- Contract visibility: tool 이름과 파라미터가 공개되어 있는가, 인증 후 `tools/list`가 필요한가.

## 채택 gate

- Primary: provider-operated official MCP + 사용자 OAuth/account credits.
- Secondary: provider-operated official MCP + user-supplied API key/paygo.
- Excluded: REST API만 있고 official MCP가 없거나 제3자/community wrapper만 있는 경우.
- ima2-gen의 역할은 공식 MCP tool을 발견·정규화·호출하는 open-source local client다. provider API를 재판매하거나 우회하지 않는다.

## Tier A — 구독형/OAuth, ima2 provider 우선 후보

| Provider | Endpoint | 인증·과금 | 확인된 범위 | 계약 가시성 | 판정 |
|---|---|---|---|---|---|
| Higgsfield | `https://mcp.higgsfield.ai/mcp` | 계정 OAuth, 기존 Higgsfield credits | 30+ 이미지/영상 모델, history, Soul, Reframe, Upscale Video 등 MCP Apps | 공개 tool schema 없음; 공식 CLI schema는 별도 증거 | Pilot 1 |
| Runway | `https://mcp.runwayml.com/mcp` | 계정 OAuth, 기존 Runway plan credits; Explore Mode 제외 | 이미지/영상 생성, product URL/reference image | 로그인 후 tools 표시; AI edit·Stitch/Workflow의 MCP 노출 불명 | Pilot 2 |
| Magnific | `https://mcp.magnific.com` | OAuth 2.1, 모든 유료 plan; MCP 생성/변환은 항상 account credits 소비 | multi-model image/video, image edit/extend/upscale, video project/clip edit/upscale/relight, batch, video concatenation | 기능 목록 공개; exact input schema는 인증 필요 | Pilot 3 |
| Krea | `https://api.krea.ai/mcp` | 계정 OAuth, API key 없음; account compute 사용으로 추정하되 tools/list에서 재확인 | image/video, enhance/upscale, user workflow, Veo/Kling/Runway/Sora 등 | 공개 tool 이름 없음 | Tier A |
| Recraft | `https://mcp.recraft.ai/mcp` | OAuth; remote MCP는 web subscription credits | raster/vector generate/edit, style, vectorize, background, upscale, balance | tool 이름/파라미터 공개 | Pilot control |
| Ideogram | `https://mcp.ideogram.ai/mcp` | OAuth; 같은 web subscription credits | generate/bulk, edit, reframe, background, upscale, collections, dataset/train | 예시 tool 이름 공개 | Tier A |
| BFL FLUX | `https://mcp.bfl.ai` | OAuth, 선택한 BFL organization credits 직접 과금 | FLUX.2 generate/edit/multi-ref/style/inpaint/outpaint/variations/history/credits | tool 이름·범위 공개 | 이미지 전문 Tier A |

## Tier A-X — 공식이지만 experimental

| Provider | Endpoint | 인증·과금 | 확인된 범위 | 제약 | 판정 |
|---|---|---|---|---|---|
| Pika | `https://experiment-mcp.pika.art/api/mcp` | interactive auth, token bundle; MCP별 metering 비공개 | image/video/audio 생성·편집, T2V/I2V/V2V, reference/extend/re-cut/modify, trim/stitch/overlay/transition, captions/lip-sync | 공식 페이지가 “experiment”, “rough around the edges”라고 명시 | 격리 spike만 |

## Tier B — 전문 workflow provider

| Provider | Endpoint | 인증·과금 | 확인된 범위 | 적합한 ima2 역할 | 판정 |
|---|---|---|---|---|---|
| HeyGen | `https://mcp.heygen.com/mcp/v1/` | OAuth, 기존 HeyGen premium credits, 전 plan | Video Agent, avatar/template video, voice, translation/lip-sync, status/stop | Avatar/Localization mode | 후속 |
| Rendley | `https://mcp.rendley.com/mcp` | OAuth 또는 bearer API key; plan/credits | project, stock/AI media, trim, caption, ratio, transition, music, brand kit, MP4/WebM export | 생성 후 editor/timeline | 후속 |
| Canva | `https://mcp.canva.com/mcp` | 사용자 OAuth; core는 all plans, resize Pro+, brand/autofill Enterprise | design generate/edit transaction, asset/template/brand, resize, PNG/JPG/PDF/PPTX/MP4 export | 기능상 design mode지만 competitive-product/third-party export policy 검토 필요 | Terms-blocked |

## Tier C — official MCP이지만 API key/paygo 또는 좁은 전문 영역

| Provider | Transport/auth | 확인된 범위 | 기본 lane에서 후순위인 이유 |
|---|---|---|---|
| fal | `https://mcp.fal.ai/mcp`, bearer key | 1,000+ 모델 검색/schema/pricing/run/async/cancel/upload | 기존 구독 재사용이 아니라 fal API 과금; direct SDK와 경제성 비교 필요 |
| Replicate | hosted MCP 또는 `replicate-mcp`, API token | 전체 HTTP API, model search/run/prediction | 별도 API 과금; arbitrary model schema를 제품 UX로 정규화해야 함 |
| Leonardo.Ai | `https://mcp.leonardo.ai/v1/mcp`, `API-Key` | 현재 MCP는 `generate-image`와 Lucid Origin/Realism/Ideogram 3.0 | Leonardo 전체 API보다 현저히 좁고 API plan 필요 |
| HiAPI | `https://mcp.hiapi.ai/mcp`, bearer key | image/edit/video/audio, model/capability/pricing 조회 | prepaid pay-per-use aggregator; 공식 문서 본문 재검증과 신뢰/약관 심사 필요 |
| MiniMax | official local stdio/SSE package, API key | image/video/audio/music/voice clone | remote OAuth 구독형 아님; 공개 README의 모델 계약이 최신 catalog보다 좁을 수 있음 |
| Hera | `https://mcp.hera.video/mcp`, `x-api-key` | motion graphics create/get/upload | 3-tool 전문 생성기; 일반 cinematic provider 대체 아님 |
| Golpo | official local MCP, API key | prompt/script/audio/document→narrated explainer, history/download | API access 최소 비용/plan 제약이 크고 explainer 전문 |

## Lead 또는 공식 sample

- ZenCreator: provider-hosted OAuth beta로 image/video/edit/lip-sync 범위가 넓지만 major 서비스 검증이 부족하다.
- Varosity: provider 도메인의 40+ model/BYOK MCP 주장만 확인되어 독립 문서·registry 증거 전에는 lead다.
- Google Veo: 공식 codelab은 local FastMCP 구축 예제이며 Google이 운영하는 managed Veo MCP endpoint가 아니다.

## 제외/보류

- ImageMCP 등 제3자 BYOK proxy: provider 공식 운영이 아니므로 token·출력 보관·terms 검토 전 채택하지 않는다.
- 검색 시점에 provider-operated MCP를 확인하지 못한 Midjourney, Luma Dream Machine, Kling, Seedance, Sora 단독 서비스: community MCP를 공식 계약처럼 쓰지 않는다. Kling/Veo/Seedance/Sora 계열 모델은 Magnific·Pika·Krea·fal·Replicate 등의 aggregator를 통해 접근할 수 있지만 upstream provider의 공식 MCP와 동일시하지 않는다.
- Adobe Firefly, Freepik, Stability AI: 공식 media-generation MCP를 확인하지 못했다. Stability 검색 결과의 대표 package는 제3자 wrapper다.

## 구현 우선순위 결정 규칙

1. provider-operated official MCP임이 확인되고 WP1에서 인증 및 `tools/list`가 성공해야 한다.
2. 사용자 구독 credits가 MCP 호출에 적용됨을 공식 문서나 account balance 무과금 조회로 확인한다.
3. 이미지 또는 영상 결과 URL을 ima2 서버가 다운로드할 수 있어야 한다.
4. long-running job이 polling/task tool 또는 blocking call로 끝까지 관찰 가능해야 한다.
5. 최소 하나의 기존 ima2 capability와 손실 없이 매핑되어야 한다.
6. native workflow 기능은 `tools/list` 입력 schema가 확인된 것만 UI에 노출한다.
7. provider가 MCP를 agent interaction 전용으로 제한하거나 경쟁 제품/제3자 export를 금지하면 서면 허용 또는 명시적 약관 근거 전까지 adapter를 구현하지 않는다.
8. official MCP 없이 REST API만 존재하는 provider는 이 레인에서 adapter 후보로 승격하지 않는다.
