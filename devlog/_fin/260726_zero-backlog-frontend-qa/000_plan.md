---
title: "000 — 제로 백로그 + 프론트엔드 폴리시 QA 로드맵"
lane: "260726_zero-backlog-frontend-qa"
created: 2026-07-26
updated: 2026-07-26
status: "WP0 docs-only 진행 중"
class: C4 (multi-surface delivery + backlog closeout)
session: 019f9a25-273e-7603-b73d-9bc44e8f9d46
goalplan: .codexclaw/goalplans/ima2-gen-0-open-issue-0-open-pr-0-devlog-plan-cx/
tags: [ima2-gen, devlog, roadmap, frontend, a11y, issue-triage]
---

# 000 — 제로 백로그 + 프론트엔드 폴리시 QA

## Objective

ima2-gen을 **open issue 0건 / open PR 0건 / `_plan` 잔여 정리 완료** 상태로 만든다.
동시에 `cxc-dev-frontend` 폴리시 기준으로 UI 표면의 접근성·반응형·카피 결함을
실제로 수정한다. 실행 형식은 HOTL PABCD 체인이며 WP0을 포함해 최소 11 사이클이다.

## Loop-spec 헤더

- **Loop archetype**: spec-satisfaction repair. 각 work-phase의 검증기가 done을 정의한다.
- **Trigger**: 사용자 요청 — 이슈/devlog 백로그를 0으로 만들고 프론트엔드 QA 루프를 돌린다.
- **Goal (user-visible)**: `gh issue list --state open`이 0건, `gh pr list --state open`이 0건,
  `devlog/_plan` 직속에 README와 차단 근거만 남는다. UI에서 키보드/스크린리더/터치
  접근이 막히던 지점이 실제로 열린다.
- **Non-goals**: npm publish, git push(사용자 승인 전), 유료 provider 실호출,
  `.git` 히스토리 재작성, 신규 provider(Recraft/Magnific) 통합.
- **Verifier**: `npm run typecheck`, `npm run typecheck:tests`, `npm run test:inventory`,
  `npm test`, `cd ui && npm run build`, 렌더 표면 변경 시 브라우저 스크린샷 관찰.
- **Stop condition**: 모든 work-phase가 done이고 criteria가 capturedEvidence와 함께 met.
- **Memory artifact**: 이 devlog 유닛 + goalplan `goalplan.json` / `ledger.jsonl`.
- **Expected terminal outcomes**: DONE(대부분), BLOCKED(외부 provider 계약: #31),
  NEEDS_HUMAN(유료 인증 smoke: subscription-mcp Tier 2).
- **Escalation**: 동일 실패 3회 반복 시 P로 복귀(LOOP-REPAIR-01). 유료 호출·push는 즉시 중단하고 사용자 승인 요청.
- **위임 (bidirectional)**: 하향 — 독립 조사/리뷰는 explorer/reviewer 서브에이전트(gpt-5.6-sol)에게
  파견한다. 상향 — 서로 다른 두 에이전트가 같은 패킷에 실패하면 메인이 회수한다(DISPATCH-RETIRE-01).
- **HOTL 자원 경계**: 도구 범위 = 로컬 파일시스템 + git(로컬) + `gh`(이슈 코멘트/클로즈) + 로컬 dev 서버.
  쓰기 범위 = `ui/**`, `routes/**`, `lib/**`, `bin/**`, `tests/**`, `devlog/**`, `structure/**`, `scripts/**`.
  벽시계 경계 = 세션 내. 유료 API 호출 예산 = 0.

## 인벤토리 (2026-07-26T16:46Z 기준, 조사 근거는 001/002)

### GitHub

| 항목 | 수 | 비고 |
|---|---:|---|
| open issue | 9 | #27 #28 #31 #80 #84 #85 #88 #90 #98 |
| open PR | 0 | 새로 만들지 않는다 |

### devlog `_plan` 직속

| 유닛 | 상태 |
|---|---|
| `260715_subscription-mcp-providers/` | Tier1 harness 4종 미구현, Tier2는 유료 승인 필요 |
| `260716_cli-entry-routing/` | WP4 완료, WP5는 edit-video/multishot CLI 표면 잔여 |
| `260718_closeout-sweep/` | 2026-07-18 감사 문서. 최신 커밋 미반영 |
| `_future/` 6개 + 원장 1개 | 전부 구현 전 |

## Work-phase 맵 (의존성 순서, PHASE-SPLIT-01)

효율이나 난이도가 아니라 **아키텍처 빌드 순서**로 나눈다. 기반(공통 훅/타입) →
핵심 기능(export/matrix/provenance) → 통합(CLI/harness) → 정리(이슈·devlog closeout).

**의존 선언은 실제 import/타입/런타임 의존만 담는다** (A-감사 blocker 4 반영).
최초 계획은 WP5→WP6→WP7→WP8을 사슬로 묶었는데 코드상 그런 의존이 없었다. 임의
직렬화는 롤백 단위를 키우기만 한다. 아래가 정정된 맵이다.

| WP | 문서 | 제목 | 실제 의존 | 근거 |
|---:|---|---|---|---|
| WP0 | 이 문서 + 001/002 | docs-only 로드맵 잠금 | — | |
| WP1 | [010](010_a11y_foundation.md) | 접근성 기반: 모달 포커스 + 라이브 리전 | WP0 | |
| WP2 | [020](020_touch_target_responsive.md) | 터치 타깃·반응형·reduced-motion | — | 독립 (CSS 전용) |
| WP3 | [030](030_icon_copy_cleanup.md) | 아이콘 문자·미번역 카피 제거 | WP1 | `PromptDetailModal`을 함께 수정 |
| WP4 | [040](040_provenance_chip.md) | provenance chip UI (#90) | — | 독립 |
| WP5 | [050](050_canvas_export_formats.md) | Canvas SVG/PPTX export (#27 #28) | WP1 | 툴바 포맷 메뉴가 WP1 키보드 계약을 따름 |
| WP6 | [060](060_frame_extraction_service.md) | FrameExtractionService 추상화 (#88) | — | 독립 |
| WP7 | [070](070_video_request_unification.md) | 공통 VideoGenerationRequest (#84) | — | 독립 |
| WP8 | [080](080_asset_ref_model.md) | AssetRef 참조 모델 (#85) | WP7 | `VideoGenerationRequest`에 `sourceAssetId`를 얹음 |
| WP9 | [090](090_comparison_matrix.md) | 비교 매트릭스 (#80) | WP4 | 셀이 `ProvenanceChip`을 재사용 |
| WP10 | [100](100_mcp_tier1_harness.md) | MCP Tier1 golden harness | — | 독립 (서버/CLI 전용) |
| WP11 | [110](110_backlog_closeout.md) | 이슈 처분 + devlog 아카이브 | WP1~WP10 | 이슈 close 근거가 앞 커밋 |

독립 WP가 많다는 것은 순서를 아무렇게나 해도 된다는 뜻이 아니다. **실행 순서는
번호순을 유지한다.** 다만 의존이 없으므로 한 사이클이 막혀도 다음이 블록되지 않고
각 롤백이 독립적이다.

WP6·WP7 관계는 특히 명확히 해둔다. 최초에 WP7이 WP6에 의존한다고 적었지만
`lib/agentImageVideoGen.ts:266-280`(Agent 경로)은 프레임 추출과 무관하다.

WP11이 마지막인 이유는 명확하다. 이슈를 닫는 근거가 앞 사이클의 구현 커밋이기
때문이다. 구현 전에 닫으면 그건 정리가 아니라 은폐다.

## 문서 규약 (A-감사 blocker 1)

모든 `file:line` 인용은 **저장소 루트 기준 전체 경로**를 쓴다.
파일명만 적고 줄 번호를 붙이는 방식이 아니라 `ui/src/store/storeVideoImpl.ts:167`처럼
디렉터리를 포함한 전체 경로로 적는다.
축약 경로는 검증할 수 없고, `lib/`(서버)와 `ui/src/lib/`(클라이언트)처럼 같은 이름의
디렉터리가 양쪽에 존재해 실제로 혼동을 만든다.

같은 문단에서 반복 인용할 때 콜론과 줄 번호만 남기는 축약도 금지한다. 문맥이 사람에게는
명확해도 기계 검증이 불가능하고, 문서를 부분적으로 읽는 리뷰어는 어느 파일인지 알 수 없다.

규약 준수는 `scripts/check-devlog-citations.mjs`로 확인한다. 두 패턴을 검사한다.

1. 백틱 뒤에 콜론과 숫자가 바로 오는 인용 (줄 번호만 남은 축약)
2. 디렉터리 구분자 없이 확장자와 줄 번호만 있는 인용 (파일명만 남은 축약)

검사 스크립트를 별도 파일로 두는 이유는 자기참조 때문이다. 검사 정규식을 이 문서에
그대로 적으면 **규약을 설명하는 예시 자체가 검사에 걸린다**(A-감사 round 5에서 실제로
발생했다). 패턴은 코드에, 설명은 문서에 둔다.

2026-07-26 A-감사 round 5 기준 두 패턴 모두 0건이다.

## Accept criteria (goalplan `criteria[]`와 1:1)

| id | 시나리오 | 기대 증거 |
|---|---|---|
| C1 | 모달/시트 키보드 경로 | 포커스 트랩·복원 계약 테스트 green + 스크린샷 |
| C2 | 터치 타깃 44px, 중간 뷰포트 무붕괴 | CSS 검증 + 390/768/1440 스크린샷 |
| C3 | 문자 글리프가 의미에 맞는 SVG 아이콘 + ARIA 계약으로 대체 | 딩벳 0건 rg + 의미 적합성 리뷰(저장≠즐겨찾기) + 렌더 확인 |
| C4 | provenance chip 5개 표면 노출 | 계약 테스트 + 스크린샷 |
| C5 | Canvas SVG/PPTX export 동작 | 산출 파일 열림 확인 + 테스트 |
| C6 | frame extraction 폴백 체인 발화 | 폴백 경로 활성화 테스트(C-ACTIVATION-GROUNDING-01) |
| C7 | 세 표면이 공통 video 요청 타입 사용 | typecheck + 계약 테스트 |
| C8 | assetId 우선, filename 폴백 | 양방향 계약 테스트 |
| C9 | 조합 매트릭스 생성·표시 | 매트릭스 테스트 + 스크린샷 |
| C10 | Tier1 harness 4종 green, provider smoke는 skip | `npm test` 출력 |
| C11 | open issue 0 / open PR 0 | `gh issue list --state open` 빈 출력 |
| C12 | `_plan` 직속에 README + 차단 근거만 | `ls devlog/_plan` 결과 |
| C13 | 전 게이트 green | 5종 명령 exit 0 |

## 검증 게이트

```bash
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm test
cd ui && npm run build
```

테스트 실행기는 `node --import tsx --test`를 쓴다. plain `node --test`는 모듈
이중 인스턴스 때문에 이벤트 계약 테스트가 거짓 실패한다(260716 lane 기록).

## SoT 동기화 대상 (SOT-SYNC-01)

- `structure/` 아래 해당 아키텍처 문서 — 각 WP의 C에서 갱신
- `devlog/_plan/README.md` — WP11에서 최종 갱신
- `skills/ima2*/SKILL.md` — CLI/표면이 바뀐 WP에서만
