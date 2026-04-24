---
created: 2026-04-23
tags: [ima2-gen, devlog, roadmap, node-mode]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 지금부터 "앞으로 할 일"만 담는다. 이미 구현되어 코드로 확인된 항목은 `_fin`으로 보냈다. 오래된 phase 문서는 완료가 아니라 과거 방향성이므로 `_plan/_legacy`에 묶었다. 현재 작업의 중심은 `0.09.6`(inflight reliability)이며, 그 다음 검증 트랙은 `0.09.15`(integration tests)이다.

이 정리가 중요한 이유는 로드맵 번호가 여러 번 바뀌었기 때문이다. React 마이그레이션, Node mode foundation, session DB, CLI 통합, cross-platform, gallery 안정화, server decomposition, config centralization, settings workspace, node image input, observability logging, node reference attachment, packaged node-mode productization, node streaming은 이미 코드에 반영되어 있다. `_plan`에는 이제 inflight persistence, integration tests, FAQ, metrics/security/containerization, feature expansion, research mode만 남긴다.

작업을 시작할 때는 이 문서를 먼저 본다. 다음 feature track은 `0.09.6-inflight-reliability/PRD.md`이다. `0.09.15-integration-tests`는 packaged tarball/install smoke와 route packaging regression을 묶는 검증 트랙이다. `0.10-feature-expansion`은 preset/compare/export 방향이며, `0.12-research-mode`는 백엔드 경로는 있으나 프론트 토글과 제품화가 남은 별도 트랙이다.

---

## 현재 active lane

| 순서 | 경로 | 상태 | 역할 |
|---:|---|---|---|
| 1 | `0.09.6-inflight-reliability/` | queued | `lib/inflight.js` SQLite 영속화 + `reconcileInflight`의 cross-tab metadata 보존. |
| 2 | `0.09.15-integration-tests/` | queued | packaged tarball/install smoke, node-mode production gate, route packaging regression. |
| 3 | `0.09.16-docs-faq/` | queued | 커뮤니티 FAQ 정리. |
| 4 | `0.09.17`~`0.09.20` | queued | logging/metrics/security/containerization 운영 트랙. |
| 5 | `0.10-feature-expansion/` | queued | preset, compare, card-news, export bundle. |
| 6 | `0.12-research-mode/` | partial | OAuth web_search 기반 research mode 제품화. |

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

## 다음 작업 원칙

- [ ] `0.09.4-node-generation-stale` 폴더는 smoke 확인 전까지 이름, 위치, 기존 문서를 건드리지 않는다. (구현 자체는 완료)
- [ ] `0.09.4` smoke가 끝나면 완료 보고서를 `_fin/2604XX_0.09.4-node-generation-stale`로 이동한다.
- [ ] `0.09.6`은 SQLite 영속화가 핵심이다. `lib/db.js`/`sessionStore.js` 패턴을 재사용하고 기존 API 시그니처(`startJob/finishJob` 등)를 유지한다.
- [ ] `0.09.6`이 닫힐 때까지 `0.10-feature-expansion` 구현을 시작하지 않는다.
- [ ] `0.10`은 Classic 우선의 preset/compare 워크벤치로 시작하고, card-news는 export bundle 이후로 둔다.
- [ ] `0.12`는 backend always-on research 상태를 인정하고, 남은 일은 FE 토글/표시/사용자 경고로 좁힌다.
- [ ] 오래된 `_legacy/phase-*` 문서는 active backlog로 끌어오지 않는다. 필요한 아이디어만 `0.10`이나 별도 새 plan으로 재작성한다.

## 변경 기록

- 2026-04-23: 완료 항목을 `_fin`으로 이동하고, `_plan`을 `0.09.4 → 0.10 → 0.12` 방향으로 재정리한다.
- 2026-04-23: 0.09.4 구현+감사 완료 표시. 0.09.5, 0.09.6 queued 트랙으로 추가 및 의존 순서 명시.
- 2026-04-24: 0.09.11~0.09.14 완료/대체 항목을 `_fin/260424_*`로 이동. Active lane을 0.09.5 streaming부터 다시 정렬.
- 2026-04-24: 0.09.5 node streaming을 `_fin/260424_0.09.5-node-streaming`으로 이동. Active lane을 0.09.6 inflight reliability부터 다시 정렬.
