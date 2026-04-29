---
created: 2026-04-23
tags: [ima2-gen, devlog, roadmap, node-mode]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 지금부터 "앞으로 할 일"만 담는다. 이미 구현되어 코드로 확인된 항목은 `_fin`으로 보냈다. 오래된 phase 문서는 완료가 아니라 과거 방향성이므로 `_plan/_legacy`에 둔다.

현재 active lane은 2026-04-29 기준 실제 폴더와 GitHub 이슈 상태를 기준으로 다시 줄였다. 모바일 UX는 #33 실기기 피드백을 반영해 #37/#38로 재분리했고, #34의 큰 UX 제안은 #39~#43으로 쪼갰다. Canvas/Gallery navigation leak #35는 구현 완료되어 `_fin/260429_gallery_canvas_arrow_navigation_leak`로 이동했다.

2026-04-29 10:20 기준 TypeScript migration (#24)은 `main`에 merge/push 되었고, 기능적 완료 상태로 `_fin/260429_typescript-migration/`에 보관한다. #24는 strict-only cleanup과 JS runtime artifact 전략을 관찰 추적하는 이슈로 남기며, 새 구현의 첫 gate는 merged `main` 기준 `npm test`, UI build, package smoke green이다.

작업을 시작할 때는 이 문서를 먼저 본다. 완료 여부는 `_plan`에 남은 문서가 아니라 현재 코드, 테스트, GitHub issue 상태로 판정한다.

---

## 현재 active lane

| 순서 | 경로 | 상태 | 역할 |
|---:|---|---|---|
| 1 | `260428_0.09.45-mobile-ui-overhaul/` | partial | #33 1차 모바일 RightPanel/settings drawer. 실기기 피드백상 설정 정보구조는 #37로 후속 분리. |
| 2 | `260428_0.09.46-mobile-classic-layout/` | partial | 모바일 app bar / compose sheet. `appbar.compose` 직관성 문제는 #38로 후속 분리. |
| 3 | `260428_0.09.47-mobile-overlays/` | partial | 모바일 overlay/settings nav. SettingsWorkspace는 #37에서 다시 정리. |
| 4 | `260428_0.09.48-mobile-node-cardnews/` | partial | Node/Card News 모바일 대응. CSS/test coverage가 남아 active로 유지. |
| 5 | `260429_community_ux_split/` | triaged | #33/#34를 #37~#43으로 분할한 UX triage map. |
| 6 | `0.25-canvas-intelligence/` | planned | 투명배경화, Illustrator식 raster vectorization, SAM3/Magic Layers식 layer extraction + PPTX reconstruction. |
| 7 | `260429_issue37-mobile-settings-workspace/` | planned/post-TS | GitHub #37. 모바일 SettingsWorkspace IA 재설계. |
| 8 | `260429_issue38-mobile-generate-flow/` | planned/post-TS | GitHub #38. 모바일 생성/compose entry 명확화. |
| 9 | `260429_issue41-generation-activity-log/` | planned/post-TS | GitHub #41. generation 실패/진행 상태 passive feedback. |
| 10 | `260429_issue39-gallery-delete-semantics/` | planned/post-TS | GitHub #39. Del/Shift+Del soft/permanent delete 의미 정리. |
| 11 | `260429_issue40-viewer-lightbox/` | planned/post-TS | GitHub #40. 이미지 inspection lightbox. |
| 12 | `260429_issue43-settings-persistence-audit/` | planned/post-TS | GitHub #43. desktop/mobile persisted settings parity. |
| 13 | `260429_issue42-gallery-current-session-default/` | planned/post-TS | GitHub #42. Gallery current-session default + All Images toggle. |
| 14 | `260429_prompt_import_search_ux/` | planned | Prompt import dialog 검색 UX 개선. 검색 결과가 하단에 밀리는 문제, 불명확한 체크박스, 불러오기 CTA/프리뷰 부족을 정리한다. |
| 15 | `0.09.41-censorship-bypass/` | research | GPT Image 2 moderation false-positive 우회 전략 연구. |
| 16 | `0.99_future/` | deferred | security hardening, containerization 등 원격/배포 전략 확정 후 처리. |

## Post-TS implementation order

Oracle browser `gpt-5-pro`의 2026-04-29 감사 결과 기준으로, TypeScript migration 이후 구현 순서는 아래를 기본값으로 둔다.

1. `260429_issue37-mobile-settings-workspace/`: 모바일 settings IA P0.
2. `260429_issue38-mobile-generate-flow/`: 모바일 generate/compose P1.
3. `260429_issue41-generation-activity-log/`: generation passive failure feedback P1.
4. `0.25-canvas-intelligence/31-provider-masked-edit/`: provider capability gate가 있는 #31.
5. `260429_issue39-gallery-delete-semantics/`: Gallery soft/permanent delete semantics.
6. `260429_issue40-viewer-lightbox/`: viewer inspection lightbox.
7. `260429_issue43-settings-persistence-audit/`: mobile/desktop settings persistence audit.
8. `260429_issue42-gallery-current-session-default/`: current-session Gallery default.
9. `0.25-canvas-intelligence/27-logo-vector-package/`: Illustrator식 raster-to-vector asset package.
10. `0.25-canvas-intelligence/28-layerdocument-pptx-reconstruction/`: LayerDocument -> PPTX reconstruction.

## Stale assumptions corrected

- GitHub #27 is not "annotation SVG export" as the main product. The active scope is logo/reference raster-to-vector packaging. Annotation SVG can be an optional overlay only.
- GitHub #28 is not "dump SVG into PPTX". The active scope is `LayerDocument -> PptxGenJS` reconstruction with PNG-alpha fallback.
- GitHub #31 must not fake masked edit through prompt-only generation. Provider capability must be proven before enabling UI.
- Gallery permanent delete should verify the existing `/api/history/:filename/permanent` route after #24 rather than assume the API is absent.

## 완료로 이동한 항목

| 원래 경로 | 이동한 경로 | 완료 판정 근거 |
|---|---|---|
| `_plan/0.01-react-migration` | `_fin/260423_0.01-react-migration` | `ui/src`, `ui/dist`, React/Vite build 구조가 존재한다. |
| `_plan/0.03-apikey-block` | `_fin/260423_0.03-apikey-block` | 서버가 `provider: "api"`를 `APIKEY_DISABLED`로 차단한다. UI는 0.07 UX 기준에 따라 disabled option으로 남긴다. |
| `_plan/0.04-node-mode-foundation` | `_fin/260423_0.04-node-mode-foundation` | `@xyflow/react`, `NodeCanvas`, `ImageNode`, `/api/node/generate`, `lib/nodeStore.js`가 존재한다. |
| `_plan/0.06-session-db` | `_fin/260423_0.06-session-db` | `better-sqlite3`, `lib/sessionStore.js`, `/api/sessions/*`, graph version 저장이 존재한다. |
| `_plan/0.07-ux-chrome-refactor` | `_fin/260423_0.07-ux-chrome-refactor` | right panel, fixed history strip, gallery modal, size preset test, dev UI gate가 존재한다. |
| `_plan/0.09-node-expansion` | `_fin/260423_0.09-node-expansion` | Node session, inflight, graphVersion, gallery/session grouping이 구현되었다. 남은 stale 버그는 0.09.4로 분리한다. |
| `_plan/0.09.1-cli-integration` | `_fin/260423_0.09.1-cli-integration` | `bin/commands/*`, `bin/lib/*`, `/api/health`, `~/.ima2/server.json` advertise, CLI tests가 존재한다. |
| `_plan/0.09.2-crossplatform` | `_fin/260423_0.09.2-crossplatform` | `bin/lib/platform.js`, `spawnBin`, `openUrl`, `onShutdown`, CI workflow가 존재한다. |
| `_plan/0.09.3-stability` | `_fin/260423_0.09.3-stability` | history pagination, soft delete/restore, codex detection, gallery redesign, filename collision fix가 존재한다. |
| `_plan/phase-0` | `_fin/260423_phase-0-readme-cli-folder` | README/CLI 확장 완료 기록이다. 기존 `_fin/260422_phase-0_readme-cli.md`와 중복되는 폴더형 사본이다. |
| `_plan/smoke-ws-v2` | `_fin/260423_smoke-ws-v2` | web_search smoke 결과가 완료된 실험 증거이다. |
| `_plan/audit-0.02-0.03.md` | `_fin/260423_audit-0.02-0.03.md` | 0.02/0.03 UX 탐색 흡수 판단이 끝난 감사 기록이다. |
| `_plan/0.09.5-node-streaming` | `_fin/260424_0.09.5-node-streaming` | Node SSE partial preview, sidecar/history `requestId`, requestId recovery, animated pending/reconciling border glow, regression tests가 구현되었다. |
| `_plan/0.09.4-node-generation-stale` | `_fin/260425_0.09.4-node-generation-stale` | 구현/감사/자동 smoke 기록이 있고 이후 0.09.6 inflight persistence로 남은 신뢰성 축을 닫았다. |
| `_plan/0.09.4.1-image-model-dropdown` | `_fin/260425_0.09.4.1-image-model-dropdown` | model allowlist, UI selector, metadata, tests가 현재 코드/구조 문서에 반영되어 있다. |
| `_plan/0.09.7.1-style-button-relocation` | `_fin/260425_0.09.7.1-style-button-relocation` | style button이 `PromptComposer`/`NodeStyleButton`으로 이동했고 sidebar inline panel 제거 방향이 코드에 반영되어 있다. |
| `_plan/0.09.8-error-message-ux` | `_fin/260425_0.09.8-error-message-ux` | `errorClassify`, `errorCodes`, `errorHandler`, `ErrorCard`, i18n, classifier test가 존재한다. |
| `_plan/0.21-custom-size-input` | `_fin/260425_0.21-custom-size-input` | keyboard-safe custom input, generation-time confirm modal, contract tests가 존재한다. |
| `_plan/00_prompt` | `_fin/260425_00_prompt-quality-prompt-reference` | prompt 원문/diff 기록은 완료된 reference로 보관하고 active plan에서 제외한다. |
| `_plan/0.09.33-upstream-validation-errors` | `_fin/260427_0.09.33-upstream-validation-errors` | upstream 4xx validation error가 `INVALID_REQUEST`로 정규화되고, classic/node JSON/SSE/UI/folder-open 회귀 테스트와 `npm test`, `npm run ui:build`가 통과했다. |
| `_plan/0.09.31-github-pages-landing` | `_fin/260428_0.09.31-github-pages-landing` | bilingual ko/en 라우팅, OG image, FAQ 상세 페이지, 한국어 카피 polish, 공유 install scripts가 모두 main에 배포되었다 (`c57027c`, `1442bd1`, `50ce358`, `6edcc9b`, `8199d46`). |
| `_plan/0.09.34-node-connect-regression` | `_fin/260428_0.09.34-node-connect-regression` | 상하좌우 directional handle, deterministic edge id, handle anchor 보존, edge disconnect/reconnect 안정화가 모두 코드에 반영되었다 (`863ec72`, `1ec4e9f`, `90f7db3`, `4ff25eb`, `d962944`). |
| `_plan/0.09.35-safety-refusal-misclassification` | `_fin/260428_0.09.35-safety-refusal-misclassification` | `SAFETY_REFUSAL` blind fallback이 `EMPTY_RESPONSE`로 교체되어 GitHub Issue #5가 닫혔다 (`45b7892 fix(error): replace SAFETY_REFUSAL fallback with EMPTY_RESPONSE (#5)`). |
| `_plan/0.09.36-gallery-double-sidebar-rail` | `_fin/260428_0.09.36-gallery-double-sidebar-rail` | gallery strip이 adaptive rail로 이동되고 GitHub Issue #7이 닫혔다 (`dd482fc feat(ui): move gallery strip to adaptive rail`). |
| `_plan/0.09.37-generation-controls-custom-plus` | `_fin/260428_0.09.37-generation-controls-custom-plus` | custom size 슬롯 + 수동 batch count가 추가되고 GitHub Issue #9가 닫혔다 (`0e29e68 feat: add custom generation controls`, `40b838a`, `8adf19e`). |
| `_plan/0.09.38-image-metadata-embed-restore` | `_fin/260428_0.09.38-image-metadata-embed-restore` | PNG/JPEG/WebP metadata embed + drag-and-drop restore가 구현되어 GitHub Issue #13이 닫혔다 (`e1b72fc feat: embed and restore image metadata`). |
| `_plan/0.09.39-reference-4k-refusal-diagnostics` | `_fin/260428_0.09.39-reference-4k-refusal-diagnostics` | 4K refusal/empty response 진단 경로가 구현되어 GitHub Issue #11/#12가 닫혔다 (`2b2b9d4 fix: diagnose reference 4k generation failures`). |
| `_plan/0.09.40-multimode-sequence-generation` | `_fin/260428_0.09.40-multimode-sequence-generation` | 한 프롬프트에서 1-4장 sequence 생성이 구현되어 GitHub Issue #17이 닫혔다 (`afa871b feat: add multimode sequence generation`). |
| `_plan/0.09.42-gallery-viewer-shortcuts-status` | `_fin/260428_0.09.42-gallery-viewer-shortcuts-status` | focusless gallery navigation, click-only delete, browser attention badge가 모두 구현되었다 (`786b737 feat: improve gallery viewer shortcuts`). |
| `_plan/0.23-prompt-library` | `_fin/260428_0.23-prompt-library` | prompt library panel/save popover/inserted chip이 구현되어 GitHub Issue #16이 닫혔다 (`0bb06fc feat: add prompt library`). |
| `_plan/1.1.5-windows-open-folder-fix` | `_fin/260428_1.1.5-windows-open-folder-fix` | v1.1.5 release에서 Windows `explorer.exe` 폴더 열기가 정상화되었다 (`2b32f9a fix(openDirectory)`, `41b84ca chore: release v1.1.5`). |
| `_plan/0.09.43-prompt-composer-resize` | `_fin/260428_0.09.43-prompt-composer-resize` | prompt textarea 기본 50vh + 30-70vh 사용자 리사이즈 + localStorage persist 구현. GitHub Issue #23 충족, `npm test`(353/353), `npm run ui:build` 통과. |
| `_plan/typescript-migration` | `_fin/260429_typescript-migration` | #24 기능적 TS migration이 `main`에 merge/push되었고, `npm run typecheck`, `npm test`(539/539), server/CLI/UI build, package smoke가 통과했다. strict-only cleanup은 #24 관찰 추적으로 남긴다. |
| `_plan/0.26-app-weight-reduction` | `_fin/260429_app-weight-reduction` | #36 app weight reduction 완료. sourcemap/package diet, frontend lazy split, Canvas Mode `./canvas-mode` lazy boundary, Phase C runtime safeguards, `npm test`, UI build, `prepublishOnly` 통과. |

## 다음 작업 원칙

- [ ] 완료된 안정화 폴더는 `_plan`에 다시 끌어오지 않는다. 증거 확인은 `_fin/260425_*` archive를 본다.
- [ ] `0.09.17`과 `0.09.18`은 0.10 전 관측성 품질을 높이는 active ops로 본다.
- [ ] `0.09.20-cli-backend-parity`는 `0.09.20.2`부터 이어간다. 다음 범위는 `storage status/open`, `runtime`, `oauth`, `billing` CLI command이다.
- [ ] 보안 하드닝과 컨테이너화는 `0.99_future`에서 보관한다. 원격 접속/배포 전략 확정 전에는 실행하지 않는다.
- [ ] `0.10`은 Classic 우선의 preset/compare 워크벤치로 시작한다.
- [ ] `0.12`는 backend always-on research 상태를 인정하고, 남은 일은 FE 토글/표시/사용자 경고로 좁힌다.
- [ ] 오래된 `_legacy/phase-*` 문서는 active backlog로 끌어오지 않는다. 필요한 아이디어만 `0.10`이나 별도 새 plan으로 재작성한다.
- [ ] 0.10 진입 전에는 `npm test`, package smoke, 그리고 실제 커밋 대상 기준의 `npm run ui:build`를 확인한다.

## 변경 기록

- 2026-04-23: 완료 항목을 `_fin`으로 이동하고, `_plan`을 `0.09.4 → 0.10 → 0.12` 방향으로 재정리한다.
- 2026-04-23: 0.09.4 구현+감사 완료 표시. 0.09.5, 0.09.6 queued 트랙으로 추가 및 의존 순서 명시.
- 2026-04-24: 0.09.11~0.09.14 완료/대체 항목을 `_fin/260424_*`로 이동. Active lane을 0.09.5 streaming부터 다시 정렬.
- 2026-04-24: 0.09.5 node streaming을 `_fin/260424_0.09.5-node-streaming`으로 이동. Active lane을 0.09.6 inflight reliability부터 다시 정렬.
- 2026-04-25: 0.09.4, 0.09.4.1, 0.09.6, 0.09.7.1, 0.09.8, 0.09.15, 0.09.16, 0.09.21, 0.09.23, 0.09.24를 완료/closeout archive로 정리하고 0.10 전 남은 운영 선택지를 재분류.
- 2026-04-25: `0.09.17`/`0.09.18`은 active ops로 남기고, `0.09.19`/`0.09.20`은 `0.99_future`로 연기.
- 2026-04-25: 새 active `0.09.20-cli-backend-parity` rough plan을 추가. 기존 containerization `0.09.20`은 `0.99_future`에 유지.
- 2026-04-26: `0.09.20-cli-backend-parity`를 최신 runtime fallback, storage recovery, sessions/style, node route 상태 기준으로 재작성. `0.09.20.1`~`0.09.20.5` slice로 분리.
- 2026-04-26: `0.09.20.1` safe classic CLI parity 완료. closeout은 `_fin/260426_0.09.20.1-safe-classic-cli-parity`.
- 2026-04-26: PR #3 검토 결과 upstream 4xx validation error pass-through 문제가 main에 미해결인 것을 확인하고 `0.09.33-upstream-validation-errors` queued lane을 추가.
- 2026-04-26: `0.09.33`에 Slice D(크로스플랫폼 폴더 열기) + Slice E(Windows/Linux 환경 갭) 추가. 사용자 제보 기반 — `Content generation refused` 에러 로깅 + 폴더 열기 무응답 + Windows smoke.
- 2026-04-27: `0.09.33-upstream-validation-errors` 구현/검증 완료 후 `_fin/260427_0.09.33-upstream-validation-errors`로 이동. `INVALID_REQUEST` 정규화, node SSE status 전파, 폴더 열기 feedback, 회귀 테스트를 완료했다.
- 2026-04-27: 사용자 제보 기반 `0.09.34-node-connect-regression` active lane 추가. 증상은 노드끼리 연결하려 하면 기존 노드가 연결되지 않고 새 child node만 생성되는 React Flow target handle 회귀다.
- 2026-04-27: `0.09.34` 플랜을 Context7/React Flow 공식 문서 기준으로 보강. 다중 handle은 unique id가 필요하며, 상하좌우 source/target handle과 `sourceHandle`/`targetHandle` 보존을 범위에 포함한다.
- 2026-04-27: `0.09.34` 후속 PRD `PRD-reconnect-handle-anchor.md` 추가. top/top 연결 후 disconnect, side/middle 재연결 시 이전 top anchor가 재사용되는 문제를 handle-aware edge id와 disconnect 즉시 flush로 다룬다.
- 2026-04-27: 사용자 correction 기준 `0.09.36-gallery-double-sidebar-rail` planning lane 추가. 기존 하단 compact gallery strip을 오른쪽 큰 rail이 아니라 왼쪽 sidebar 옆 두 번째 얇은 세로 rail로 옮기고, narrow viewport에서는 기존 가로 strip으로 접는 범위다.
- 2026-04-27: GitHub #9 기반 `0.09.37-generation-controls-custom-plus` planning lane 추가. OpenAI `gpt-image-2` size 제약(16px 배수, max edge 3840, ratio 3:1, pixel budget)을 반영하되 기존 오른쪽 세부 설정 패널과 preset grid는 유지하고, 하단 custom 영역만 최대 3개 슬롯 + `+` 직접입력으로 보강한다.
- 2026-04-27: GitHub #13 기반 `0.09.38-image-metadata-embed-restore` planning lane 추가. Sharp 0.34.x의 PNG/JPEG/WebP XMP 지원과 PNG/WebP 컨테이너 metadata 조사를 반영해 sidecar JSON 유지 + embedded metadata restore PRD를 작성했다.
- 2026-04-27: GitHub #11 + #12 기반 `0.09.39-reference-4k-refusal-diagnostics` planning lane 추가. reference MIME mismatch, prompt-only retry의 reference drop, 4K empty response, safety refusal 오분류를 분리하는 진단 PRD를 작성했다.
- 2026-04-28: GitHub #17 기반 `0.09.40-multimode-sequence-generation` planning lane 추가. live smoke에서 한 번의 streamed Responses 호출로 `image_generation_call` 4개 수집이 가능함을 확인했고, 직원 엣지케이스 감사를 반영해 multimode 버튼, 1-4 max stage row, partial/empty/extra-result 처리, sequence metadata 요구사항을 PRD로 작성했다.
- 2026-04-28: GitHub #14 + #21 기반 `0.09.42-gallery-viewer-shortcuts-status` planning lane 추가. #14는 focusless movement keys만 keyboard로 처리하고, delete/permanent delete는 클릭 전용으로 두며, zoom/sound/canvas mode를 분리했다. #21의 상단 active generation 빨간 불/count 표시를 같은 작은 UX slice로 묶었다.
- 2026-04-28: 코드 반영이 끝난 11개 lane을 `_fin/260428_*`로 일괄 이동했다. 0.09.31 github-pages, 0.09.34 node-connect, 0.09.35 safety-refusal, 0.09.36 gallery-rail, 0.09.37 custom-controls, 0.09.38 metadata-embed, 0.09.39 4k-diagnostics, 0.09.40 multimode-sequence, 0.09.42 viewer-shortcuts, 0.23 prompt-library, 1.1.5 windows-folder-fix. 남은 active는 `0.09.32-final-release-closeout`과 `0.09.41-censorship-bypass`(연구)뿐이다.
- 2026-04-28: GitHub #23 기반 `0.09.43-prompt-composer-resize` lane 추가/완료. prompt textarea가 기본 50vh, 사용자 30-70vh 리사이즈, localStorage persist 적용. `npm test`(353/353)와 `npm run ui:build` 통과 후 같은 날 `_fin/260428_0.09.43-prompt-composer-resize`로 이동.
- 2026-04-28: GitHub #15 기반 `0.09.44-comfyui-bridge` planning lane 추가. Oracle 감사 결과를 반영해 PR1은 `더보기 → ComfyUI로 보내기` image upload only로 제한하고, ComfyUI custom node와 workflow automation은 후속 PRD로 분리했다.
- 2026-04-28: 사용자 요청 기반 `0.23.1-prompt-library-github-import` planning lane 추가. Prompt Library `불러오기`는 Finder 직행 대신 dropzone dialog로 열고, GitHub Markdown file/path import와 curated Nano Banana prompt repositories를 포함한다.
- 2026-04-29: 사용자 clarification과 Oracle browser `gpt-5-pro` 3회 검토를 반영해 `0.25-canvas-intelligence` planning lane 추가. 기존 annotation SVG/PPTX/alpha 문맥과 분리하여 투명배경화, Illustrator식 raster vectorization, SAM3/Magic Layers식 layer extraction + PPTX reconstruction을 별도 phase 파일로 작성했다.
- 2026-04-29: GitHub #35 기반 `260429_gallery_canvas_arrow_navigation_leak` lane 보강. 기본/gallery shortcut navigation은 Gallery/HistoryStrip과 동일한 visible source domain만 순회하고, Canvas Mode 좌우 이동은 대상 source에 저장된 canvas version이 있으면 그것을 표시하되 없으면 원본으로 fallback하는 정책을 명시했다.
- 2026-04-29: 사용자 제보 기반 `0.26-app-weight-reduction` planning lane 추가. 1.1.7 이후 체감 무거움의 원인을 기능 증가 + unsplit frontend bundle + production sourcemap/package asset weight로 보고, release package diet, frontend code splitting, Canvas runtime performance 3개 phase로 분리했다.
- 2026-04-29: TypeScript migration folder를 `_fin/260429_typescript-migration`으로 이동. #24는 기능적 완료 이후 strict-only cleanup/JS runtime artifact 전략을 관찰 추적하는 이슈로 유지한다.
- 2026-04-29: 사용자 스크린샷 기반 `260429_prompt_import_search_ux` planning lane 추가. Prompt import dialog 검색 결과가 하단에 밀리고 체크박스/불러오기/후보 프리뷰가 불명확한 문제를 전용 UX 개선 slice로 분리했다.
- 2026-04-29: `0.26-app-weight-reduction`을 #36 closeout으로 `_fin/260429_app-weight-reduction`에 보관. 다음 post-TS 구현 순서는 #37 mobile settings workspace부터 시작한다.
