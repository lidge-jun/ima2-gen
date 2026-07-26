---
title: "060 — 현재 상태 및 재개 가이드"
lane: "260716_cli-entry-routing"
status: "wp1~wp4 완료 · wp5 Runway P1/P2 완료(edit_video 라이브 한도 대기) · Higgsfield 게이트 유지"
updated: "2026-07-21"
evidence: "2026-07-18 closeout-sweep audit + 2026-07-20/21 wp4·wp5 구현 루프(1806/1806 green)"
---

# 060 — CLI 진입점 라우팅: 현재 상태 및 재개 가이드

2026-07-18 closeout-sweep 기준, 이 lane은 **wp1~wp3 구현 완료** 상태다. 다음 실제 구현 단위는 wp4 캐릭터 영속성이고, wp5는 이미 있는 Runway media-action 위에 파생 UX/CLI를 추가하는 순서가 가장 안전하다.

## 현재 상태

| WP | 상태 | 완료/잔여 범위 | 증거 / 커밋 |
|---|---|---|---|
| wp1 | 완료 | strict model routing, fail-closed 기본 모델, 모델/도구 dispatch | `80da5e7`; 모델/도구 dispatch 후속은 `4505642` |
| wp2 | 완료 | CLI 문서·스킬 이관 및 버전 갱신 | `21b9b9b` |
| wp3 | 완료 | end frame·이미지/비디오 레퍼런스의 서버 계약, inputRoles 게이트, UI 슬롯, CLI 연동 | `a878e74`; 잔여 타입/카탈로그/UI 스타일은 `4505642`; [Gen-4 Turbo 슬롯 증거](evidence-wp3-gen4turbo-slots.png), [Seedance 슬롯 증거](evidence-wp3-seedance-slots.png) |
| wp4 | 완료 (라이브 증거 포함) | 042-046 슬라이스 전부 랜딩 + Runway 실생성 1건(041 Accept 6, 2026-07-20 사용자 승인): 저장 모델(lib/characterBindings.ts), /api/mcp/generate characterElementId(lib/mcp/characterRefs.ts), UI 카드+슬롯, CLI --character. 라이브 sidecar에 characterElementId+referenceParents(tag) 기록 확인 | `7dec392` `813b5a2` `3d9c046` `b0f6cb6` `d33354e` `4af8555`; 전체 스위트 1772/1772; [바인딩 카드 증거](evidence-wp4-bindings-card.png) |
| wp5 | Runway P1/P2 완료 · edit_video 라이브 한도 대기 | multishot: 전용 라우트+adapter, 라이브 720p/5s 성공(`f0517f2`, sidecar 1784539402777). upscale: 파라미터 노출+`ima2 upscale`+ResultActions 팝오버(`6fe3822`, 베이스 라이브 1784538508044). edit_video: 2단 구현+stage-1 동기 shape 확정(`7274ed0`), 라이브 full-flow는 Runway 504/워크스페이스 한도로 NEEDS_HUMAN | 052-054 docs; 전체 스위트 1806/1806 |

wp3 후속 `4505642`에는 `ui/src/lib/mcpProviders.ts`의 end-frame/reference-video typed inputRoles, `mcp-models-catalog`의 `audio_references` 부정 assertion, 오른쪽 패널 reference-slot 스타일이 포함된다.

## 남은 작업 순서

### 1. wp4 — 캐릭터 영속성 전체 구현

`040_character-persistence.md`의 조사 결론 위에 [041](041_wp4-roadmap-expansion.md)의
amendment(저장 모델/Accept 치환)를 적용한다. 충돌 시 041 우선.

1. **저장 모델** — `element(kind=character)` 메타데이터에 `CharacterProviderBinding`을 저장·조회한다. provider, `stateless-refs`/`trained-id`, 원본 `refFilenames`, Runway tag, Higgsfield `externalId`(`soul_id`)와 학습 상태를 보존하고 roundtrip 계약 테스트를 먼저 고정한다.
2. **MCP 요청 연결** — `characterElementId`를 `/api/mcp/generate`에 수용하고 결과 lineage에도 기록한다. 현재 `routes/mcpMedia.ts:224-227,337-345,408-437`은 start/end/reference/video 입력만 다루므로 여기서부터 연결한다.
3. **provider 브리지** — Runway는 binding의 원본 레퍼런스를 최대 3장 `referenceImages[{url,tag}]`로 매 생성마다 전개한다. Higgsfield는 결제/연결 조건을 확인한 뒤 `soul_id`를 생성 params로 전달하고, 학습 전·실패 상태는 실행 불가로 닫는다.
4. **UI** — character element 상세에 provider binding 카드(Runway tag, Higgsfield 학습/크레딧 상태)를 추가하고, `image_references`를 선언한 MCP 모델에서만 캐릭터 슬롯을 노출한다.
5. **CLI** — wp1 resolver 위에 `ima2 gen/video --character <element-id|name>`를 추가하고, 모델 capability·provider binding 미충족은 명시 에러로 fail-closed 처리한다.

### 2. wp5 — 파생 제작 다양성 (2026-07-21 상태)

완료: multishot(routes/mcpMultishot.ts, auto/custom, 라이브 증거), upscale 파라미터
(lib/mcp/adapters/runway.ts UpscaleImageParams, `ima2 upscale`, ResultActions 팝오버),
edit_video 2단(lib/mcp/editVideoPreview.ts 동기 stage-1 + submit 경로).
잔여:

1. **edit_video 라이브 full-flow 재검증** — Runway edit_video 엔드포인트가 504
   (CloudFront 30s)를 연발하는 시간대가 있고, stage-2는 "Runway workspace limit
   reached"를 반환했다. 제공자/계정 한도 회복 후 preview→submit을 1회 재실행한다.
2. **multishot CLI/UI 표면** — 라우트는 있고 CLI/직접 UI 슬롯은 없다(053 §3 기록).
3. **wp5c / Higgsfield 결제 후** — `motion_control`과 `reframe`을 먼저 검토하고 wp4의 캐릭터/Soul 흐름과 묶는다. `voice_change`·`dubbing`은 입력 음성 검증과 언어 선택이 독립 표면이므로 별도 단위로 분리한다.
## 재개 절차와 검증 게이트

1. 잔여 작업 전 `040`/`041`/`050`/`051`과 042-046/052-054의 계약을 다시 읽고, 현재 MCP tools/list 스냅샷과 provider 연결/결제 상태를 재확인한다.
2. 각 서브 phase 완료 전 `npm run typecheck`, `npm run typecheck:tests`, 영향 받은 `node --test` 계약(실행기는 반드시 `node --import tsx --test` — plain node --test는 모듈 이중 인스턴스로 이벤트 테스트가 거짓 실패한다), `npm run test:inventory`, `cd ui && npm run build`를 실행한다. 2026-07-21 기준선은 전체 **1806/1806**, 두 typecheck, UI build green이다.
3. 실행 증거(요청 shape, lineage, UI 슬롯/결과 카드)를 해당 WP devlog에 남기고, 과금·결제 전제와 unverified provider 계약은 proven처럼 승격하지 않는다.

## 주의 — generic elementIds와 혼동 금지

wp4의 `characterElementId`는 `lib/generatePipeline.ts`의 core-image generic `elementIds`와 다른 계약이다. 전자는 **MCP/provider character binding**을 찾아 Runway 레퍼런스 재전송 또는 Higgsfield `soul_id`를 연결하고 lineage에 남기는 식별자다. generic element 주입을 그대로 재사용하거나 `elementIds`만 전달해서 wp4가 구현됐다고 판단하면 안 된다.
