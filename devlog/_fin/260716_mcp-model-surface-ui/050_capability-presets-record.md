# 050 — Model Capability Presets: Build Record (wp1)

세션: 019f65ff-2065-7363-a253-09185ba7f06b · goalplan: ima2-gen-mcp-capability-runway-higgsfield-durati · 날짜: 2026-07-16

## 무엇을 만들었나

모델을 고르면 그 모델이 실제로 지원하는 값만 노출·기본선택·보정되는 수직 슬라이스.

- `f30550e` feat(mcp): capability preset 보존 + runway args 검증
- `ed57da5` feat(mcp-ui): provider capabilities 기반 모델별 프리셋 표시
- `7863743` fix(mcp): 업로드 전 계약 검증 + 종속 콤보 정규화 (sol 리뷰 F1–F4 반영)

## 계약 표면

- 서버: `GET /api/mcp/providers/:id/models` 가 모델별 `capabilities`(source, aspectRatios, parameters{min/max/options/default}, inputRoles)를 내려준다. Runway는 `verified-contract` 정적 카탈로그, Higgsfield는 `models_explore` 기반 `provider-declared`(read-only, 무과금).
- 어댑터(runway): 미선언 파라미터/범위 밖 값/미지원 ratio·model은 tool call 이전에 reject. 종속 콤보는 정규화 — veo-3.1 1080p면 duration→8 강제, gen-4.5 I2V면 generateAudio 제거(기본 UI 상태가 스스로 거부되지 않도록).
- 라우트: `/api/mcp/generate` 는 202 이전(= start-frame 업로드 이전)에 `buildGenerateCall` 로 순수 검증을 돌려 위반 시 400. 업로드가 검증보다 먼저 나가던 순서 결함(sol F2) 해소.
- UI: `mcpSelection.reconcile` 이 모델 전환 시 stale ratio/parameter를 capability 기준으로 보정, 기본값 자동 적용. 프리셋 컨트롤은 core(duration/resolution/quality/mode) 우선 + advanced 접이식.

## sol 리뷰(FAIL→해소)

| # | 심각도 | 지적 | 처리 |
|---|--------|------|------|
| F1 | High | mcp-connection-routes 계약 테스트가 capabilities 없는 응답을 기대 | id/label 사영 비교 + capabilities.source 존재 단언으로 갱신 |
| F2 | High | start-frame 업로드가 어댑터 검증보다 먼저 실행 | 핸들러에서 202 전 순수 pre-validation, 400 반환. 회귀 테스트: 업로드 dep 미호출 단언 |
| F3 | High | gen-4.5 기본 상태(generateAudio:true)+start frame 이 스스로 거부 | 어댑터가 I2V 시 generateAudio drop (정규화) |
| F4 | Med | veo-3.1 1080p+6s 무효 콤보가 reconcile 을 통과 | 어댑터가 duration→8 강제. UI 단 cross-field 메타데이터는 잔여(아래) |

## 브라우저 QA (localhost:3435, headless Chrome)

- provider 드롭다운: 코어 6종 + Runway + Higgsfield(Locked 배지) 정상.
- Runway·video: Seedance 2 → duration 4–15(기본 10), resolution 480/720/1080p, audio On 기본. Veo 3.1 전환 → duration 4/6/8(기본 8*), resolution 720/1080p 로 컨트롤이 즉시 교체됨. 증거: `evidence/veo31-presets.png`
- Higgsfield: 카탈로그 브라우즈 가능(락 유지), nano_banana_2 등 resolution 1k/2k/4k, soul_2 quality 1.5k/2k + soul_id 프리셋 확인. 유료 호출 0건.
- 참고: 세션 초기에 관찰된 "Video 탭 → 코어 이탈"은 stale ref 클릭 + 리빌드 전 번들 캐시로 판명(재현 불가, DOM 직접 클릭으로 정상 확인).

## 검증

- typecheck / typecheck:tests 통과, MCP 스위트 95/95, ui build 통과.
- 전체 `npm test` 1459/1461 — 실패 2건은 병행 작업 소속(asset-gen lightbox 계약, structure/01 라인카운트 드리프트 19파일 전부 MCP 슬라이스 밖).

## 잔여(후속 phase 후보)

- UI가 cross-field 제약(veo 1080p→8s)을 모델 카탈로그 메타데이터로 받아 컨트롤 자체를 비활성/보정하는 것 — 현재는 서버 정규화로 계약만 보장.
- Higgsfield 유료 플랜 확보 시 Tier2 smoke(실제 생성 1건)로 provider-declared 카탈로그 실측 검증.
