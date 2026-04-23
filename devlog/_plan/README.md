---
created: 2026-04-23
tags: [ima2-gen, devlog, roadmap, node-mode]
aliases: [ima2 active plan, image_gen current roadmap, ima2 개발계획]
---

# ima2-gen 현재 계획 허브

`_plan`은 지금부터 "앞으로 할 일"만 담는다. 이미 구현되어 코드로 확인된 항목은 `_fin`으로 보냈다. 오래된 phase 문서는 완료가 아니라 과거 방향성이므로 `_plan/_legacy`에 묶었다. 현재 작업의 중심은 `0.09.4-node-generation-stale`이다.

이 정리가 중요한 이유는 로드맵 번호가 여러 번 바뀌었기 때문이다. React 마이그레이션, Node mode foundation, session DB, CLI 통합, cross-platform, gallery 안정화는 이미 코드에 반영되어 있다. 반면 `0.09.4`는 지금도 진행 중인 버그픽스이다. 그래서 다음 기능 확장은 `0.09.4`가 끝난 뒤에만 자연스럽게 이어진다.

작업을 시작할 때는 이 문서를 먼저 본다. 현재 hotfix는 `0.09.4-node-generation-stale/PRD.md`만 수정 대상으로 삼는다. `0.10-feature-expansion`은 그 다음 기능 확장 방향이다. `0.12-research-mode`는 백엔드 구현은 들어와 있지만 프론트 토글과 제품화가 남은 별도 트랙이다. `backend-node-mode.md`와 `frontend-node-mode.md`는 과거 상세 설계 참고 자료로만 쓴다.

---

## 현재 active lane

| 순서 | 경로 | 상태 | 역할 |
|---:|---|---|---|
| 1 | `0.09.4-node-generation-stale/` | **active** | Node mode 생성 결과가 stale로 남는 문제를 해결한다. 이 폴더는 진행 중이므로 이동하지 않는다. |
| 2 | `0.10-feature-expansion/` | queued | preset, compare, card-news, export bundle 방향을 `0.09.4` 이후 기능 확장으로 정리한다. |
| 3 | `0.12-research-mode/` | partial | OAuth web_search 기반 research mode의 제품화 트랙이다. 백엔드 경로는 구현되어 있고 FE 토글이 남았다. |
| 4 | `backend-node-mode.md` | reference | Node mode와 backend cleanup의 원문 설계 참고 자료이다. |
| 5 | `frontend-node-mode.md` | reference | Node UI와 layout 설계의 원문 참고 자료이다. |
| 6 | `_legacy/` | legacy | 오래된 phase 계획이다. active backlog로 보지 않는다. |

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

## 다음 작업 원칙

- [ ] `0.09.4-node-generation-stale` 폴더는 현재 진행 중이므로 이름, 위치, 기존 문서를 건드리지 않는다.
- [ ] `0.09.4`가 끝나면 완료 보고서를 `_fin/260423_0.09.4-node-generation-stale` 또는 다음 날짜 prefix로 이동한다.
- [ ] `0.09.4` 완료 전에는 `0.10-feature-expansion` 구현을 시작하지 않는다.
- [ ] `0.10`은 Classic 우선의 preset/compare 워크벤치로 시작하고, card-news는 export bundle 이후로 둔다.
- [ ] `0.12`는 backend always-on research 상태를 인정하고, 남은 일은 FE 토글/표시/사용자 경고로 좁힌다.
- [ ] 오래된 `_legacy/phase-*` 문서는 active backlog로 끌어오지 않는다. 필요한 아이디어만 `0.10`이나 별도 새 plan으로 재작성한다.

## 변경 기록

- 2026-04-23: 완료 항목을 `_fin`으로 이동하고, `_plan`을 `0.09.4 → 0.10 → 0.12` 방향으로 재정리한다.
