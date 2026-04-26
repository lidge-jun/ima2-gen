---
created: 2026-04-23
tags: [ima2-gen, devlog, roadmap, node-mode]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 지금부터 "앞으로 할 일"만 담는다. 이미 구현되어 코드로 확인된 항목은 `_fin`으로 보냈다. 오래된 phase 문서는 완료가 아니라 과거 방향성이므로 `_plan/_legacy`에 묶었다. 현재 0.09 안정화 트랙의 핵심 구현은 대부분 닫혔고, 남은 것은 운영 관측성(`0.09.17`~`0.09.18`), CLI/backend parity(`0.09.20`), 0.10 기능 확장, research mode 제품화, card-news dev-only WIP이다. 보안/컨테이너화는 원격 하드유저 영향과 배포 전략을 더 봐야 해서 `0.99_future`로 미뤘다.

이 정리가 중요한 이유는 로드맵 번호가 여러 번 바뀌었기 때문이다. React 마이그레이션, Node mode foundation, session DB, CLI 통합, cross-platform, gallery 안정화, server decomposition, config centralization, settings workspace, node image input, observability logging, node reference attachment, packaged node-mode productization, node streaming은 이미 코드에 반영되어 있다. `_plan`에는 이제 inflight persistence, integration tests, FAQ, metrics/security/containerization, feature expansion, research mode만 남긴다.

작업을 시작할 때는 이 문서를 먼저 본다. 다음 안정화 track은 `0.09.17-structured-logging`과 `0.09.18-metrics-observability`이다. 그 다음 CLI parity track은 `0.09.20-cli-backend-parity`이고, feature track은 `0.10-feature-expansion`이다. `0.20-card-news`는 dev-only/WIP이므로 배포 blocker가 아니라, 해당 변경을 커밋/푸시할 때만 build 포함 여부를 따로 확인한다. `0.12-research-mode`는 백엔드 경로는 있으나 프론트 토글과 제품화가 남은 별도 트랙이다.

---

## 현재 active lane

| 순서 | 경로 | 상태 | 역할 |
|---:|---|---|---|
| 1 | `0.09.17-structured-logging/` | queued | request 추적/지원 대응을 위한 구조화 로그 트랙. |
| 2 | `0.09.18-metrics-observability/` | queued | self-host/운영 진단을 위한 metrics 트랙. |
| 3 | `0.09.20-cli-backend-parity/` | active slices | 프런트/서버 기능 대비 낡은 CLI surface 갱신. `0.09.20.1`은 완료, 다음 권장 slice는 `0.09.20.2` storage/runtime/OAuth commands. |
| 4 | `0.10-feature-expansion/` | queued | preset, compare, card-news, export bundle. |
| 5 | `0.12-research-mode/` | partial | OAuth web_search 기반 research mode 제품화. |
| 6 | `0.20-card-news/` | WIP/dev-only | 님이 병렬로 작업 중인 card-news lane. npm 배포 기본 기능이 아니라 dev 사용자를 위한 WIP. |
| 7 | `0.09.32-final-release-closeout/` | active | npm/GitHub Pages 최종 배포 전 release gate, package smoke, docs blocker를 닫는 마감 lane. |
| 8 | `0.09.34-node-connect-regression/` | active/reopened | edge disconnect 이후 기존 노드끼리 연결되지 않고 새 노드만 생기는 React Flow target handle 회귀 수정. 상하좌우 4방향 연결점 포함. 후속 PRD는 disconnect 후 같은 노드쌍을 다른 handle로 재연결할 때 이전 anchor가 재사용되는 문제. |
| 9 | `0.09.36-gallery-double-sidebar-rail/` | planning | 하단 compact gallery strip을 왼쪽 sidebar 옆 세로 보조 rail로 이동하고, 좁은 화면에서는 기존 가로 strip으로 접히게 하는 UX 개선. |
| 10 | `0.99_future/` | deferred | security hardening, containerization 등 원격/배포 전략 확정 후 처리. |

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
