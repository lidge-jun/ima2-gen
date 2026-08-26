---
created: 2026-08-25
tags: [ima2-gen, devlog, roadmap, comfyui, video, provider-ux, capability-discovery]
---

# 000 — Comfy video 실행, provider UX, 동적 capability 노출 로드맵

## Loop spec

- Archetype: spec-satisfaction repair (wp1, wp3, wp4) + bounded design 판단 (wp2).
- Trigger: 사용자가 Comfy로 연결한 GUI에서 MiniMax H3 모델을 클릭해도 지정되지
  않는다고 보고했다. 실측 결과 이건 클릭 핸들러 버그가 아니라 어제 유닛이 의도적으로
  건 lock이며, 그 lock 뒤에는 실제로 미구현된 실행 경로가 있다.
- Goal: (1) Comfy video를 실제로 실행 가능하게 만들어 H3 선택이 정직하게 동작하고,
  (2) 12개로 늘어난 provider lane을 읽을 수 있는 UI로 만들고, (3) CLI help와 packaged
  skill이 하드코딩 산문 대신 live registry에서 capability를 유도하게 한다.
- Non-goals: npm publish, release cut, main PR, 자격증명 변경, 원격 호스트 변경
  (read-only probe만 허용), 새 provider lane 추가.
- Verifier: `npm run typecheck`, `npm run typecheck:tests`, `npm test`,
  `npm run test:inventory`, `cd ui && npm run build`, 그리고 실제 브라우저 렌더
  관측과 fired-branch activation trace.
- Stop: 7개 criteria가 전부 fresh evidence로 충족되면 DONE.
- Memory artifact: 이 폴더의 `000`~`040` 문서와 `evidence/` 하위 경로.
- Escalation: 동일 실패 2회면 RCA, 3회면 P 복귀.

## Resource bounds

- 도구/자격 범위: 로컬 repo, localhost:3333 (실행 중인 ima2 v3.10.0), 공개 웹,
  read-only 원격 probe.
- 쓰기 범위: `routes/`, `lib/`, `ui/src/`, `bin/`, `skills/`, `tests/`,
  `structure/`, 이 devlog unit.
- 비용: 유료 API 신규 호출 없음. Comfy 실행은 사용자의 로컬/원격 GPU만.
- push는 `dev`에 한해 사용자가 사전 승인했다. main/PR/release는 범위 밖.

## Tier-2 검증된 외부 사실 (2026-08-25)

| 사실 | 증거 | 티어 |
|---|---|---|
| ComfyUI core `PreviewVideo.as_dict()`는 `{"images": values, "animated": (True,)}`를 반환한다 | `comfy_api/latest/_ui.py:432-437`, main이 직접 curl로 원문 확인 | Tier 2 (main 직접 확인) |
| `SavedResult`는 `{filename, subfolder, type}` dict다 | 같은 파일 `:27-29`, main 직접 확인 | Tier 2 (main 직접 확인) |
| native `SaveVideo`/`SaveWEBM`는 `ui.PreviewVideo`를 반환한다 | `comfy_extras/nodes_video.py`, Luna lane comfy-video-api | Tier 2 (lane) |
| `VHS_VideoCombine`는 custom key `gifs`를 쓴다 | VideoHelperSuite `nodes.py` | Tier 2 (lane) |
| `videos`는 core key가 아니다 — 호환용으로만 취급 | core `_ui.py` serializer 전수 | Tier 2 (lane) |
| `/view`는 `filename`, `subfolder`, `type` 쿼리를 받는다 | `server.py:466-503, 943-959` | Tier 2 (lane) |
| 공식 H3 workflow는 `SaveVideo`로 끝나고 `17n+5` 프레임 그리드/24fps를 쓴다 | Comfy-Org `video_minimax_h3_i2v.json` | Tier 2 (lane) |
| `/history` 는 완료 직후 outputs가 비어 있을 수 있다 (persistence race) | 공식 예제 vs 비디오 클라이언트의 명시적 지연 | Tier 2 lead |
| Agent Skills 스펙은 SKILL.md 안에 live registry를 두지 않는다; progressive disclosure + 런타임 조회가 규범 | agentskills.io/specification, MCP `tools/list` | Tier 2 (lane) |
| 대형 카탈로그 UI는 provider 그룹 + 상태 배지 + configured/reachable/available 분리를 쓴다 | OpenRouter, LibreChat, LM Studio, Cursor, ComfyUI-Manager 문서 | Tier 2 (lane) |

핵심 함의: **ima2는 이미 Comfy video 파일을 history에서 수집하고 있다.** `images`
키가 곧 video 서술자이기 때문이다. 실패 지점은 수집이 아니라 다운로드 직후의
이미지 매직바이트 검사다.

## 현재 코드 실측 (2026-08-25)

| 위치 | 현재 동작 |
|---|---|
| `routes/models.ts:55` | `COMFY_VIDEO_LOCK_REASON` 상수 |
| `routes/models.ts:316-321` | 모든 video workflow에 `executable:false` + lockReason 부착 |
| `routes/video.ts:188` | `provider !== "grok" && provider !== "grok-api"` 이면 400 |
| `ui/src/components/GenProviderModelSelect.tsx:195` | `onModelChange`가 `comfy-video:` prefix에서 **즉시 return** — 사용자가 본 "클릭이 안 먹는" 실체 |
| `ui/src/store/storeVideoImpl.ts:129` | payload provider가 grok/grok-api로 강제 캐스팅 |
| `lib/comfyImageAdapter.ts:234-247` | `collectImages`가 `outputs[*].images`만 본다 (video도 여기 들어옴) |
| `lib/comfyImageAdapter.ts:274-277` | `detectImageMimeFromB64` 실패 시 `IMAGE_INVALID` — video mp4가 여기서 죽는다 |
| `lib/comfyWorkflowStore.ts:60-68` | `ComfyWorkflowBindings`에 duration/length/refImage 외 video 축 없음 |
| `lib/comfyGraphBind.ts:82-93` | `FIELD_RULES`에 `SaveVideo` output 규칙은 있으나 length/fps 축 없음 |

등록된 실제 workflow: `minimax-h3-fl2va-pruned-nvfp4`, origin `http://127.0.0.1:18188`,
`mediaKind: "video"`, output node `92` = `SaveVideo`.

실행 중인 서버의 `/api/models` lane 실측: oauth, api, grok, grok-api, agy,
gemini-api, atlascloud, minimax, nai, comfy, runway, higgsfield — **12 lane**이다.
목표 문구의 "10 lane"은 core lane만 센 값이므로 wp2는 12 lane 기준으로 진행한다.

## Dependency-ordered work-phase map

| WP | decade | 결과 | 의존 |
|---|---|---|---|
| wp0 | 000 | 본 docs-only diff-level 로드맵 잠금 | — |
| wp1 | 010 | Comfy video 실행 경로 (store→bind→adapter→route→UI) | wp0 |
| wp2 | 020 | 12-lane provider/model 선택 UX | wp1의 실제 lane 상태 |
| wp3 | 030 | CLI help + skill의 동적 capability 유도 | wp1/wp2가 확정한 capability 모양 |
| wp4 | 040 | 통합 검증 + dev push + 로컬 서비스 반영 | wp1-wp3 |

한 work-phase는 한 PABCD cycle이다. 두 decade 문서를 한 B에 합치지 않는다.

## Accept criteria (goalplan c-1..c-7과 1:1)

- c-1 wp0: 이 폴더에 000-range 리서치와 wp1-wp4 각각의 diff-level decade 문서가 있고
  독립 리뷰어 verdict tail이 기록된다.
- c-2 wp1: `provider: "comfy"` video 요청이 route에서 수락되고 검증된 video artifact를
  만든다. 증거 = fired-branch activation trace + 캡처된 테스트 출력.
- c-3 wp1: origin이 살아 있을 때 H3 row가 UI에서 선택된다. 증거 = 읽어들인 스크린샷.
- c-4 wp2: 선택 표면이 lane별 상태와 모델별 capability를 드러낸다. 증거 = Design Read +
  데스크톱/모바일 스크린샷.
- c-5 wp3: CLI help와 skill이 live registry에서 내용을 유도한다. 증거 = 두 가지 lane
  상태에서의 출력 diff.
- c-6 wp4: 전체 게이트 green. 증거 = exit code 포함 fresh 출력.
- c-7 wp4: origin/dev에 push되고 로컬 서비스가 새 빌드를 서빙한다. 증거 = head SHA +
  live `/api/health`, `/api/models`.

## Terminal outcomes

DONE은 7개 criteria 전부 fresh evidence 충족. Comfy origin 18188이 죽어 있으면 그
부분만 BLOCKED로 분리하고 나머지는 계속한다 — lock 제거는 코드 경로 존재로 정당화하되
라이브 실행 증거가 없으면 그 사실을 D에 명시한다.
