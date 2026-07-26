# 000 — CLI 진입점 라우팅: 멀티 프로바이더 시대의 모델 해석 계약

세션: 019f697f-1526-7772-a439-f63893b07905 · 상태: 인터뷰 완료(Mind 스캔 2라운드) → P
선행 유닛: devlog/_plan/260716_mcp-model-surface-ui (Variant D 드롭다운, MCP capability 프리셋)

## 문제

Runway/Higgsfield MCP 편입으로 image/video 모델이 코어 6레인 + MCP 2레인으로 늘었는데 CLI는 못 받아준다:

- `bin/commands/gen.ts` --provider enum이 코어 전용(runway/higgsfield 없음)
- `bin/commands/video.ts` provider "grok" 하드코딩, grok-imagine 2종만 허용 — Seedance 2/Veo 3.1 접근 불가
- `/api/mcp/generate`(202+비동기)는 CLI 진입점 자체가 없음

## 인터뷰 확정 결정 (사용자 답변, 2026-07-16)

| # | 결정 | 내용 |
|---|------|------|
| A1 | **완전 엄격 fail-closed** | bare `ima2 gen`/`ima2 video`는 kind별 기본 모델 미설정 시 exit 2 + 그룹 모델 리스트 + 해결 명령 출력. 자동 시드/자동 라우팅 없음. breaking change 수용 — 메이저 버전 + 문서/스킬 이관이 DONE에 포함 |
| A2 | **레인 id 네임스페이스** | `<lane>/<model>` 문법. lane ∈ oauth\|api\|grok\|grok-api\|agy\|gemini-api\|runway\|higgsfield (기존 요청 레인과 1:1). bare 모델 id는 카탈로그에서 유일할 때만 허용 |
| A3 | **1차 범위** | `gen` + `video` + 신규 `ima2 models` + `defaults` 확장. edit/multimode/node/cardnews는 후속 phase |

## Mind 스캔 결과가 강제한 스코프 항목

1. **MCP 비동기 브리지** — `/api/mcp/generate`는 202 후 eventBus로 진행. CLI는 `GET /api/events`(SSE, `lastEventId` 재개 지원, jobId 필터)로 done/error 대기 경로 신설.
2. **JSON 에러 봉투** — `--json` 실패 시에도 구조화 JSON(stdout) + exit code. 현재 stderr 텍스트/JSON 혼재(`bin/lib/output.ts:17-20` die 경로) 정리. 봉투: `{"ok":false,"code":"NO_DEFAULT_MODEL","kind":"video","models":[...],"fix":["ima2 defaults set video runway/veo-3.1"]}`.
3. **가용성 분리** — `ima2 models`는 모델 존재와 레인 가용성(ready/locked/disconnected/key-missing)을 분리 표기. `defaults set`은 locked/미연결 레인 거부(경고+exit 2).
4. **defaults 삼중장부 통합** — 기존 `ima2 defaults`(GPT oauth/api 전용) + grok config 기본값 + 신규 레인 기본값을 한 표면으로. 신규 키: `defaults.image`, `defaults.video` (레인 한정 id).
5. **파손면은 문서/스킬로 한정** — 내부 코드(cardnews/node/storyboard/video route)는 CLI를 shell-out하지 않음(검증됨). 이관 대상은 020 문서의 체크리스트.

## OPEN ASSUMPTIONS (medium, 기록)

- 서버측 무음 모델 폴백(`lib/imageModels.js:26-32,119-122`)은 1차 유지 — 엄격성은 CLI 계약으로 강제. 서버 strict 모드는 후속 검토.
- edit/multimode의 zero-config 잔존은 과도기로 수용, 후속 phase에서 동일 규칙 이관.
- video 기본 모델 문서 불일치(문서 grok-imagine-video-1.5 vs 코드 GROK_VIDEO_MODEL_BASE, `bin/commands/video.ts:176-180`)는 020 이관에서 정정.
- 시멘틱 버저닝: 2.x → 3.0.0 (fail-closed breaking). npm publish는 사용자 승인 후.

## Phase 구성 (1 phase = 1 PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 010_phase1.md | CLI strict 라우팅 구현: resolver + `ima2 models` + defaults 확장 + MCP wait + JSON 봉투 + 계약 테스트 | 260716_mcp-model-surface-ui 완료분 |
| wp2 | 020_phase2.md | 문서/스킬 이관 + 버전 범프: 패키지 스킬 3종+references, README, site en/ko | wp1 (새 계약 확정 후) |
| wp3 | 030_reference-media.md | 레퍼런스 미디어 파이프라인: end frame·image/video/audio refs를 서버 계약·UI 슬롯·CLI 플래그로 (inputRoles 게이트) | wp1 (MCP wait·resolver) |
| wp4 | 040_character-persistence.md | 캐릭터/레퍼런스 영속성: ima2 자체 캐릭터 저장(assets/elements 매핑) + Higgsfield soul/Runway references 브리지 | wp3 |
| wp5 | 050_derivative-diversity.md | 파생 제작 다양성: edit_video·multishot·motion_control·voice/dubbing·upscale 분류와 도입 우선순위 | wp3 |

2026-07-20 로드맵 확장: [001](001_current-feature-delta.md)이 7/16→7/20 기능 delta 근거,
[041](041_wp4-roadmap-expansion.md)/[051](051_wp5-roadmap-expansion.md)이 wp4/wp5의
현재 기능 반영 amendment(저장 모델·Accept 치환). wp4/wp5 구현 시 040/050과 041/051을 함께 읽는다.

## 로드맵 문서 사이클 (현재 진행, docs-only)

이번 PABCD 사이클의 산출물은 030 스키마 상세 확정 + 040/050 신규 문서다 (LOOP-DOCS-FIRST-01).
조사 규율: cxc-search Tier1 발견 + Tier2 원문 증명, 문서마다 소스 근거 섹션(URL+확인일), 미증명은 unverified 표기.
검색 레인: ①Higgsfield 캐릭터/soul 영속성 ②Runway 레퍼런스·캐릭터 일관성 ③스냅샷 tool 분류(로컬). 과금 호출 0.

## Loop-spec

- Loop archetype: verifier-defined (계약 테스트 + 실CLI 스모크가 done을 정의)
- Write scope: bin/, bin/lib/, bin/commands/, lib/capabilities.js(defaults 노출), tests/, (wp2) skills/, README.md, site/, package.json version
- Out-of-scope: 서버 생성 파이프라인 로직, UI, edit/multimode/node/cardnews 명령 동작 변경, npm publish(승인 필요)
- Budget: 과금 호출 0 기본(스모크는 리스트/에러 경로), Runway 실생성 최대 1건은 사용자 명시 승인 시에만

## 검증 게이트 (공통)

`npm run typecheck` · `npm run typecheck:tests` · 신규/갱신 node:test 계약 · 로컬 서버 대상 실CLI 스모크(무과금: 리스트/에러 경로만, MCP 실생성은 Runway 1건 이내 사용자 승인 시) · devlog 증거.
