---
created: 2026-04-23
updated: 2026-07-18
tags: [ima2-gen, devlog, roadmap]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 앞으로 구현하거나 검증할 일이 남은 항목만 둔다. 구현 근거와
테스트가 확인된 항목은 `_fin`으로 이동한다. 완료 여부는 폴더 위치만이 아니라
현재 코드, 테스트, GitHub issue 상태, closeout 증거를 같이 본다.

## Naming Standard

`_plan/` 직속 active 폴더는 다음 두 패턴 중 하나를 따른다.

- `YYMMDD_issue<NN>-<kebab-slug>`: 단일 GitHub 이슈가 canonical scope일 때.
- `YYMMDD_<kebab-slug>`: 단일 이슈가 없는 연구, triage, 다중 이슈 map일 때.

Deferred / 미래 항목은 `_plan/` 직속이 아니라 `_plan/_future/`에 둔다.

## 현재 Active Lane

| 순서 | 경로 | 상태 | 역할 |
|---:|---|---|---|
| 1 | `260715_subscription-mcp-providers/` | parent active — 재개 가이드 `130_current_status.md` | WP1~8과 restart recovery는 완료됐고 capabilities 계약 요약은 `0cc560d`로 추가됐다. 090 Tier1 golden harness(`mcp-clean-install`/`security-regression`/`long-job-recovery`/`provider-smoke`)와 Tier2 authenticated smoke(비용 승인 게이트), 100 provider expansion이 남아 parent를 유지한다. |
| 2 | `260716_cli-entry-routing/` | WP1~3 완료·정리, WP4~5 대기 — 재개 가이드 `060_current_status.md` | WP1 models/tools dispatch와 WP3 reference-media 잔여는 `4505642`로 정리됐다. WP4 character persistence(미착수), WP5 derivative diversity가 남았다. |
| 3 | `260718_closeout-sweep/` | 감사 완료, sweep 진행 중 | 2026-07-18 전 lane 감사 매트릭스(`000_audit.md`). sweep 자체의 closeout은 최종 게이트 후 정리. |

2026-07-18 closeout-sweep으로 `_fin` 이동: `260515_fork-prompting-modularization-research/`
(구현 커밋 확인 + 수용 기준 supersede 기록), `260717_element-library-fixes/`
(build·시각 증거), `260716_composer-tray/` (080 전달 + 1440/500 QA),
`260715_spritegen-adoption/` (문서 정정 + 증거), `260715_assetgen_ux_overhaul/` (020/030 사용자 수용 + P1-1/P2 폐기 결정, 040_lane_closeout), `260712_higgsfield-ux-studio/` (010~080+100~130 완료, 090 기준 충족, 후속은 _future/260719_higgsfield-open-ledger). `_future` 이동:
`260715_icon_pipeline/` (구현 0건 handoff).

2026-07-15: `260715_asset_gen_mode/`(에셋 생성 모드 — asset-gen 탭, backgroundPreset,
클라이언트 키잉, 알파 WebM 파생) WP1-WP11 완료로 `_fin/` 이동.

2026-07-20: `260719_higgsfield-recover-guard/`(recover route 409 실행 가드 +
Higgsfield unlock 사전조건 기록) 검증 재확인(typecheck 0 errors,
mcp-recover-route 5/5) 후 `_fin/` 이동. 같은 날짜의
`260719_node22-mcp-timer-unref/`, `260719_windows-ci-matrix-repair/`는 별도
closeout 예정으로 `_plan`에 남는다.

2026-07-25 archival sweep (`_fin/260725_devlog_archival/000_archival_record.md`
에 유닛별 증거): `260718_260718-runway-mcp-loss-hardening/`(mcpRecover 라우트
랜딩 + 7/23 라이브 recover 검증), `260719_node22-mcp-timer-unref/`(`ac7ed6c`),
`260719_windows-ci-matrix-repair/`(`778336c`·`d066ab3`·`fdc8759`),
`260722_higgsfield-hardening/`(전 WP 랜딩, 업스트림 BLOCKED는 042에 기록),
`260723_docker-pr115-release301/`(v3.0.1 closeout),
`260723_release-train-3.0.0/`(v3.0.0 퍼블리시),
`260724_node-mode-hardening/`(3 phase 전부 랜딩),
`260725_structured_filename/`(`08796ac` 스쿼시 머지, PR #116 supersede)를
`_fin/`으로 이동. lane 1~3은 active로 유지.

Deferred (`_plan/_future/`): `260715_icon_pipeline/`,
`260430_issue27-canvas-svg-export/`,
`260430_issue28-canvas-pptx-export/`, `260430_issue31-provider-masked-edit/`,
`260529_issue80-batch-comparison-matrix/`, `260602_storyboard-planner-skill/`.

## 2026-05-16 GH / Devlog Closeout

이번 pass에서 GitHub issue와 devlog를 대조해 완료 처리한 항목:

| GitHub | 기존 plan 경로 | 이동한 경로 | 완료 근거 |
|---|---|---|---|
| #33/#37/#38 | `_plan/260428_issue33-mobile-overhaul-logs/` | `_fin/260428_issue33-mobile-overhaul-logs/` | mobile UX follow-up issues are closed; logs are archive evidence, not active work. |
| #47 | `_plan/260429_issue47-inflight-reload-reconcile/` | `_fin/260429_issue47-inflight-reload-reconcile/` | GitHub #47 closed; reload reconcile tests exist. |
| #48 | `_plan/260429_issue48-prompt-import-search-ux/` | `_fin/260429_issue48-prompt-import-search-ux/` | GitHub #48 closed; prompt import search workspace contracts exist. |
| none | `_plan/260503_error-toast-stack/` | `_fin/260503_error-toast-stack/` | Error toast stack shipped; `tests/toast-stack-contract.test.js` covers the UI/store contract. |
| #60 | `_plan/260508_issue60-multimode-incremental-progress/` | `_fin/260508_issue60-multimode-incremental-progress/` | GitHub #60 closed; incremental backend/frontend contracts exist. |
| #62 | `_plan/260513_issue62-cli-skill-capabilities/` | `_fin/260513_issue62-cli-skill-capabilities/` | GitHub #62 closed; packaged skill/defaults/capabilities shipped. |
| #59 | `_plan/260514_issue59-generate-as-first-node/` | `_fin/260514_issue59-generate-as-first-node/` | `createRootNodeFromHistoryItem` and visible current-image button are implemented. |
| #63 | `_plan/260515_issue63-delete-focus-recovery/` | `_fin/260515_issue63-delete-focus-recovery/` | GitHub #63 closed; viewer focus recovery contract exists. |
| #64-#70 plus #68/#69 | `_plan/260515_issue64-70-hardening-pabcd/` | `_fin/260515_issue64-70-hardening-pabcd/` | CLI/skill, prompt import, destructive safety, package release, readiness popup, gallery/multimode UX hardening are implemented with contracts. |
| #64-#70 research | `_plan/260515_ux-cli-install-hardening-audit/` | `_fin/260515_ux-cli-install-hardening-audit/` | Research ledger completed; implementation evidence now lives in code/tests and the closeout audit. |
| agent-mode | `_plan/260516_agent-mode-codex-rs-workspace/` | `_fin/260516_agent-mode-codex-rs-workspace/` | Agent Mode workspace/runtime implemented and verified with tests plus agbrowse. |

Detailed issue-to-evidence matrix:

- `_fin/260516_gh-issue-hardening-jawdev/README.md`
- `_fin/260515_issue64-70-hardening-pabcd/README.md`

## 남은 Active Scope

| Issue | Devlog | Next gate |
|---|---|---|
| #31 | `_future/260430_issue31-provider-masked-edit/` | 업스트림 API mask 지원 확인 후 활성화. |
| #27 | `_future/260430_issue27-canvas-svg-export/` | SVG serializer 구현. |
| #28 | `_future/260430_issue28-canvas-pptx-export/` | PptxGenJS export, #27 overlay 재사용. |
| #71 | `../_fin/260516_issue71-classic-prompt-context-injection/` (planning 문서; 이슈는 open) | 가장 큰 feature. 별도 sprint. |
| #80 | `_future/260529_issue80-batch-comparison-matrix/` | MVP 기획 후 별도 마일스톤 (P2). |
| #84 | — | Common video generation pipeline. Structural refactor, not quick. |
| #85 | — | AssetRef / asset ID model. Structural migration, not quick. |
| #88 | — | Last-frame extraction service abstraction. Current same-origin/server paths work; full fallback chain remains. |
| #89 | — | Source provenance UI for auto-selected I2V sources. Partially covered by lineage metadata, not fully shipped. |
| — | `260531_video-settings-persistence/` | Add video defaults persistence. |
| — | `260601_video-mode-persistence-refresh/` | Persist video mode and select video mode on continue-from-video. |

## 다음 작업 원칙

- 완료된 안정화 폴더는 `_plan`에 다시 끌어오지 않는다.
- 새 구현은 `_plan`의 남은 open issue에서 시작하고, 완료 즉시 `_fin`으로 이동한다.
- `_plan`과 GitHub 상태가 다르면 먼저 GitHub issue body/comments와 현재 코드/test를 확인한다.
- 문서만 갱신한 pass라도 완료/미완료 판정 근거를 `_fin` closeout에 남긴다.

## 변경 기록

- 2026-07-17: 완료 단위 전수 감사 후 `_fin` 이동:
  `260711_production-hardening/`, `260715_oauth_fallback_reference_retention/`,
  `260716_mcp-model-presets/`, `260716_mcp-model-surface-ui/`,
  `260717_ux_refinement/`. `_fin`과 byte-identical이던
  `260531_pr-issue-review-rebase-plan/`의 `_plan` 중복 사본도 제거했다.
  이동 전후 파일 수와 합성 SHA-256을 대조했고, 잔여 조건이 있는 8개 단위는
  위 Active Lane에 1:1로 유지했다.

- 2026-07-15: 구독형 media MCP provider 조사 레인 추가
  (`260715_subscription-mcp-providers/`). Higgsfield/Runway/Magnific/Recraft를
  authenticated schema cohort로 선정하고 Pika experimental, BFL/HeyGen/Rendley/Canva
  specialist, fal/Replicate 등 API-key lane을 분리했다. 구현은 시작하지 않음.
- 2026-07-16: 구독형 MCP 레인 인터뷰 종료 + roadmap 확정
  (`260715_subscription-mcp-providers/`). 약관 Luna sweep(생태계는 tool 계약
  재게시가 표준 관행, Runway/Higgsfield ToS 문구는 수용된 잔여 리스크) 후
  decade 문서 000~090을 post-interview canonical로 개정. 020/040/070 신설,
  기존 020/030/040/050을 030/050/060/080으로 리넘버. UI provider/model 분리와
  비디오 라우팅 결정표는 080에 반영. 구현은 다음 cycle(010)부터.
- 2026-07-15: asset-gen 키잉 전후 비교 후속 완료
  (`260715_asset_gen_keyed_preview/`). 원본/배경 제거 2-up, 저장 직후 keyed
  PNG/WebM 결과 카드, checkerboard/배지, stale async target/SSE cleanup과 malformed
  payload guard를 구현. exact 320px overflow 0, 이미지 저장 E2E asset 레코드 확인,
  luna low 최종 감사 PASS. 완료 후 `_fin` 이동.
- 2026-07-15: Higgsfield UX 레인 Phase 060 구현 확인 (XMP `presetIds` 전파 1건
  잔여). Phase 070/080/090 구현 PABCD 루프 진입
  (goalplan `implement-higgsfield-ux-studio-phases-060-090-fo`).
  difflevel roadmap을 현재 코드 상태에 맞춰 갱신: 060을 Part I 완료로 이동,
  070/080 decade doc에 현재 코드 상태 주석 추가, stale path 정정
  (`presetCatalog.ts`→`presets.ts`, `storeGenerateImpl.ts`→`storeGenImpl.ts`,
  continuity owner `videoSeriesChain.ts`→`videoContinuity.ts`).
- 2026-07-11 (3차): production-hardening 구현 라운드 완료. `_fin` 이동:
  `260605_stabilize-split/` (Phase 3 분할 완료 — 4파일 전부 500줄 이하),
  `260516_agent-mode-followup-jawdev/` + `260517_agent-ui-polish-jawdev/`
  (잔여 스코프 구현 완료; Refs/Web projection·forms/style-lock은 future로
  disposition). 최종 게이트: typecheck/typecheck:tests 통과, `npm test`
  1120개 중 1118 pass 0 fail(2 skip), ui:build 통과, 전역 설치본 동기화 +
  서버 재기동, agbrowse 브라우저 QA (Agent 데스크톱/Queue 탭/모바일 탑바).
- 2026-07-11 (2차): 비디오 persistence 2개 레인 `_fin` 이동 완료 — 계약 테스트
  `tests/video-defaults-persistence-contract.test.js` 신설(7 pass)로 reload/탭
  sync/continue-from-video 모드 전환 검증. `_fin`의 기존 stale 사본은 최신
  closeout 포함 본으로 갱신.
- 2026-07-11: production-hardening pass 시작 (`260711_production-hardening/`,
  goalplan `ima2-gen-production-hardening-devlog-fin-closeou`). `_fin` 이동:
  `260711_skill-structured-prompting/` (closeout + 계약 테스트 통과),
  `260711_canvas-i2i-annotation-cleanup/` (closeout + 1094 테스트; G1 후속은
  새 레인 WP7 승계), `260707_gpt56-oidc-devlog-hardening/` (v2.0.15 npm 게시
  확인 — publish.yml `windows-consumer` 게이트 통과가 publish 선행 조건).
  비디오 persistence 2개 레인은 sol 탐사 결과 현재 코드에 수정 반영 확인
  (`persistenceRegistry.ts:31`, `storePersistence.ts:237`, `useAppStore.ts:145/388`,
  `storeSettingsImpl.ts:77`, `storeUIImpl.ts:66`, `continueFromItem.ts:31`) —
  계약 테스트 증거 확보 후 이동 예정.
- 2026-07-10: `v2.0.14` preview/latest provenance, 동일 release SHA,
  Luna/Terra `medium` 생성은 통과했다. 이후 Windows 전역 업데이트에서
  package-local Codex를 PATH에서 찾지 못하고 `.cmd`를 직접 실행하는 OAuth
  회귀가 확인돼 archive를 보류하고 corrective release 단계를 추가했다.
- 2026-07-07: devlog hardening pass (`260707_gpt56-oidc-devlog-hardening/030_wp3`).
  `_fin` 이동: `260624_agy-pr-integration/`, `260627_docs-refresh/`,
  `260627_preview-deploy-pipeline/`, `260628_wp6_docs_code_grounding/`,
  `260629_grok-video-15-1080p/` (v2.0.4-2.0.5 출하), loose 문서
  `260601_model-selector-visibility.md` (pill trigger 출하 확인). `_plan`에
  남아있던 `_fin`/`_future` 중복 사본 11건 제거 (byte-diff로 동일성 확인:
  sidecar-atomicity, sidebar-parity, api-key-accordion, shimmer-f5fix,
  grok-gemini-research, security_audit, switch_account, grok-url-continue,
  issue93, issue80, storyboard-planner + SSE/audit 낱개 .md 7건).
  KEEP: `260605_stabilize-split/` — Phase 3 backend 분할 미완
  (4개 파일 500줄 초과). Active lane 표를 실제 폴더 목록과 1:1로 재작성.
- 2026-06-11: `_plan/260611_provider-brand-ui-polish/` implemented and moved to `_fin/260611_provider-brand-ui-polish/`. Provider identity metadata, provider card selector, Gemini copy cleanup, Agent provider card parity, contracts, full test/build, and Browser visual QA completed.
- 2026-06-01: `_plan` cleanup pass. `_fin` 이동: `260519_issue72-slash-command-dropup/` (GH #72 implemented; dropup/filter/Tab/arrow/Enter/Escape/click contracts exist), `260531_video-integration-audit/` (audit complete; follow-ups split to #84/#85/#88/#89), `260531_video-phase2-full-api/` (edit/extend/frame/analyze/continue API+CLI shipped), `260531_video-provider-expansion/` (xAI video contract research complete), `260531_video-series-and-agent-tool/` (trash fallback, video topic chain, Agent `ima2.generate_video` shipped), `260601_video-continuity-workflow-research/` (ContinuityJob/lineage/CLI continue/planner prompt guidance shipped). Remaining fast candidates: video defaults persistence, video mode refresh persistence, agent video sidecar atomicity, source provenance chip.
- 2026-05-31: 오늘 66 commits (v1.1.15→v1.1.18) 후 정리. `_fin` 이동: `260529_issue78-prompt-autofill-perf/` (GH #78 closed), `260529_issue79-metadata-ui-polish/` (GH #79 closed), `260530_grok-provider-integration/` (shipped), `260530_grok-publish-pages-readiness/` (shipped), `260530_grok_tool_pipeline/` (shipped), `260531_grok-video-i2v-ship/` (build completion report 확인), `260517_agent-mode-auto-generation-jawdev/` (implementation-patched). PR #81 (Nix flake) + PR #3 (validation errors) 리뷰 및 리베이스 계획 문서화 (`260531_pr-issue-review-rebase-plan/`). 열린 이슈 6개 (#80/#72/#71/#31/#28/#27) 모두 아직 미구현 확인 — 닫을 대상 없음.
- 2026-05-29: 3개 lane 전체 소스코드 검증 + phase 문서 작성 완료. #78: 3 phase (01 autofill fix, 02 img perf, 03 pointer throttle) — `saveGenerationDefaultsPatch` localStorage 오염 추가 발견. #79: 3 phase (01 elapsed/reasoning persistence, 02 metadata display, 03 modal overflow) — overview 원인 정정: 모달 짤림은 `max-height`가 아니라 sidebar `overflow: hidden`이 진짜 원인, AgentModelSheet는 정상. #80: 1 phase (01 MVP design) — Agent Queue/Planner/Runtime 인프라 검증, N개 독립 QueueItem 방식 MVP 설계.
