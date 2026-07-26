# 004 — LunaSearch 메이저 미디어 MCP sweep

조사일: 2026-07-15. 사용자가 지정한 LunaSearch 절차에 따라 서로 다른 검색 공간을 5개 lane으로 나눠 병렬 조사하고, 본 에이전트가 주요 공식 원문을 다시 열어 교차검증했다.

## 실행 메모

- Lane 1: Higgsfield/Runway/Krea와 유사한 multi-model creative subscription service.
- Lane 2: avatar/video editor/workflow service.
- Lane 3: model aggregator/API marketplace.
- Lane 4: image/design generation service.
- Lane 5: video model/provider service.
- 각 lane은 provider 공식 문서·공식 product page·공식 GitHub만 primary evidence로 채택했다.
- LunaSearch skill의 legacy model override `gpt-5.3-codex-luna`는 현재 runtime에서 사용할 수 없어, 지침의 fallback에 따라 같은 5-lane query를 세션 기본 모델로 재실행했다. 조사 구조와 source gate는 그대로 적용했다.

## 합성 결론

이 조사의 제품 기준은 “ima2가 provider를 대체한다”가 아니라 “사용자가 자신의 공식 MCP 연결을 더 잘 활용하도록 돕는 open-source local client”다. 따라서 official MCP가 hard gate이고 OAuth/account-credit 연결이 primary다. API key 방식도 provider 공식 MCP라면 secondary로 남기지만 REST API-only 후보는 구현 목록에서 제외한다.

### 지금 가장 유력한 구독형 peer

| 순위 | Provider | 이유 | 결정적 제약 |
|---:|---|---|---|
| 1 | Magnific | paid-plan OAuth, multi-model image/video, image/video editing, upscale, batch, video concatenation까지 공개 | exact `tools/list`, async/cancel, transport subtype은 인증 확인 필요 |
| 2 | Higgsfield | 사용자 요구와 가장 직접 일치하고 모델·MCP Apps 범위가 넓음 | 공개 exact schema와 native extend/stitch 노출 불명 |
| 3 | Runway | 기존 plan credits, remote OAuth, 강한 video platform | Workflow Stitch가 MCP tool인지 불명 |
| 4 | Krea | multi-model image/video/workflow/upscale, 계정 OAuth | exact tools와 billing 문구가 약함 |
| 5 | Recraft/Ideogram | subscription credits와 tool 계약이 비교적 명확 | image 중심; 범용 video provider가 아님 |

Magnific은 이번 확장 조사에서 새로 발견된 가장 중요한 후보다. 공개 문서가 `video concatenation`을 직접 명시하므로 “MCP 내장 기능으로 이어붙이기”를 검증할 첫 비교군이다. 다만 marketing capability를 adapter 계약으로 쓰지 않고, 인증된 `tools/list`에서 ordered clips와 결과 계약을 확인해야 한다.

### 기능은 가장 강하지만 격리해야 하는 후보

Pika 공식 experimental MCP는 `Extend Video`, `Re-cut Video`, `Modify Video`, `Trim Video`, `Stitch Videos`, overlays, transitions를 명시한다. 따라서 질문한 영상 연장/이어붙이기가 MCP tool 자체로 가능한 가장 직접적인 공개 증거다. 동시에 Pika가 페이지 상단에서 experiment이며 rough around the edges라고 경고하므로 production provider로 바로 채택하지 않는다.

### 전문 workflow lane

| Provider | 강점 | ima2 제품상 위치 |
|---|---|---|
| HeyGen | OAuth, 기존 plan credits, Video Agent/avatar/template/voice/lip-sync/translation/status/stop | Avatar/Localization mode |
| Rendley | trim/caption/transition/music/brand/export를 포함한 full video editor | 생성 결과 후처리/timeline mode |
| Canva | design generation, transactional editing, assets/templates/resize, MP4 export | 기능상 editable design mode; 서면 허용 전 terms-blocked |
| BFL FLUX | OAuth, exact image tools, multi-reference/edit/inpaint/outpaint/variations | 고품질 image specialist/control |

Canva MP4 export는 video generation이나 clip stitch와 동일하지 않다. 또한 Canva MCP policy는 competitive product 구축과 일부 third-party design export를 제한하므로 ima2-gen 통합은 서면 허용 전 차단한다. HeyGen avatar workflow와 Rendley timeline workflow도 ima2의 generic T2V model picker에 억지로 합치지 않는다.

### API-key/paygo lane

| Provider | 운영 형태 | 판정 |
|---|---|---|
| fal | provider-hosted Streamable HTTP, bearer key, 1,000+ model/9 tools | 강한 aggregator지만 기존 구독 재사용 아님 |
| Replicate | hosted SSE 또는 official local package, API token, full HTTP API | 강한 aggregator지만 arbitrary schema 정규화 필요 |
| Leonardo.Ai | hosted MCP, API-Key/API plan | 현재 MCP는 image generate 1 tool/3 models로 좁음 |
| HiAPI | hosted HTTP, bearer key, prepaid balance | 기능상 적합하나 신뢰·약관·공식 본문 재검증 우선 |
| MiniMax | official self-host Python/JS MCP, API key | provider-authored지만 managed remote OAuth 아님 |
| Hera | hosted HTTP, x-api-key, create/get/upload | motion graphics specialist |
| Golpo | official local MCP, API key | narrated explainer specialist |

이 표의 후보도 official MCP를 실제 호출하는 경우에만 유효하다. 같은 회사의 REST API를 MCP 없이 직접 붙이는 경로는 이번 계획에 포함하지 않는다.

### Lead와 제외

- ZenCreator는 OAuth beta와 넓은 image/video 범위를 확인했지만 major service 기준에는 아직 약하다.
- Varosity는 provider page의 40+ model/BYOK 주장을 확인했지만 독립적인 공식 technical reference가 부족하다.
- Google Veo는 공식 codelab의 local MCP sample만 확인됐다. Google-managed Veo MCP endpoint가 아니다.
- Adobe Firefly, Freepik, Stability AI, Luma, Kling, Seedance, Sora, Midjourney, Synthesia, Captions, VEED의 provider-operated media MCP는 이번 공식-source 조사에서 확인하지 못했다.
- 위 `not-verified`는 “없음”의 증명이 아니다. 새 공식 문서가 나오면 재평가한다.

## 본 에이전트가 재확인한 핵심 원문

- Magnific: https://www.magnific.com/ai/docs/magnific-mcp
- Pika: https://experiment.pika.art/mcp
- BFL FLUX: https://docs.bfl.ml/api_integration/mcp_integration
- Canva: https://www.canva.dev/docs/mcp/tools/
- HeyGen: https://developers.heygen.com/mcp/overview
- Leonardo.Ai: https://docs.leonardo.ai/docs/connect-to-leonardoai-mcp

세부 endpoint/auth/billing/source 상태는 `001_candidate_inventory.md`와 `003_source_ledger.md`를 canonical ledger로 사용한다.

## 계획에 반영한 결정

1. WP1 authenticated schema cohort를 Higgsfield/Runway/Magnific/Recraft로 확장하되 Magnific은 read-only schema 확인 이후 product-adapter 허용 근거를 별도 확보한다.
2. Magnific concat과 Pika extend/stitch를 `video.extend.native`/`video.stitch` 후보로 기록하되 live schema 전에는 capability를 켜지 않는다.
3. Pika는 별도 token store와 feature flag를 쓰는 experimental canary로 격리한다.
4. BFL·HeyGen·Rendley는 범용 provider picker가 아니라 specialist mode 후보로 유지하고, Canva는 terms-blocked로 둔다.
5. API-key aggregator는 subscription OAuth lane과 과금/보안/UI를 섞지 않는다.
6. provider catalog는 ima2가 지원 모델을 임의로 선언하지 않고 연결된 MCP의 live `tools/list`에서 구성한다.
7. 공식 MCP가 사라지거나 OAuth/인증 계약이 바뀌면 해당 provider를 자동 unavailable로 내리고 direct API fallback은 하지 않는다.

## 다음 증거 gate

- 무과금 `initialize`/`tools/list`와 sanitized schema hash.
- OAuth account/plan entitlement와 refresh-token 저장 정책.
- provider별 MCP product embedding/competitive-use 약관과 필요한 서면 승인.
- Magnific concat/Pika stitch의 입력이 실제 clip ref/URL을 받는지 확인.
- native extend가 combined output을 주는지 extension segment만 주는지 확인.
- status/cancel/result URL TTL/credit delta를 최소 비용 smoke에서 검증.

이 gate를 통과하기 전에는 MCP 기능명을 ima2 UI action으로 hardcode하지 않는다.
