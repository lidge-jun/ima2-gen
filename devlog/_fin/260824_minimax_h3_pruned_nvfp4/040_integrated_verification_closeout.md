---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, verification, closeout, phase4]
---

# 040 — 통합 검증과 closeout

## Contract

IN: 010~030의 verified tree와 receipts를 대상으로 전체 관련 gates, live API/CLI,
rendered UI, independent review, SoT/devlog 동기화, local commits를 닫는다.

OUT: push, PR, merge, release, npm publish, 원격 H3 추가 생성, 성능 튜닝.

Resource bound: 60분. 실패 시 해당 delta만 수리하고 재검증한다. 같은 실패의
두 번째 수리 뒤에는 RCA, 세 번째에는 P로 복귀한다.

## Exact document delta

- MODIFY `structure/01-file-function-map.md`: mediaKind owner와 catalog lock 경로.
- MODIFY `structure/03-server-api.md`: `/api/comfy/inspect`, workflow create/list,
  `/api/models`의 Comfy video locked projection.
- MODIFY `structure/04-frontend-architecture.md`: Comfy image/video group와 disabled
  video workflow state.
- MODIFY `structure/07-devlog-map.md`와 `devlog/_plan/README.md`: 이 active unit을
  current lane에 추가하고 실제 terminal outcome을 기록.
- NEW `041_verification_evidence.md`: command, exit code, timestamp, screenshot,
  live JSON, reviewer verdict, commit SHA.
- NEW `090_outcome.md`: DONE/NOOP/BLOCKED/UNSAFE/NEEDS_HUMAN/BUDGET_EXHAUSTED 중
  실제 결과, 남은 비목표, 되돌리기 정보.

이 unit은 `.gitignore` 대상이므로 `041`, `042`, `043`, `090`과 새 evidence를
explicit `git add -f`한다. commit 전후 `git ls-files`로 각 경로가 tracked인지
확인한다. staged 목록 확인만으로 c-6을 충족했다고 보지 않는다.

## Static and contract gates

Run from repo root unless noted:

```bash
npm run typecheck
npm run typecheck:tests
node --experimental-strip-types --test \
  tests/comfy-workflow-store.test.ts tests/comfy-graph-bind.test.ts \
  tests/comfy-provider-contract.test.ts tests/comfy-routes-contract.test.ts \
  tests/comfy-cli-contract.test.ts tests/comfy-ui-contract.test.ts \
  tests/models-endpoint-contract.test.ts tests/cli-model-resolver.test.ts
npm run test:provider-registry
npm run test:inventory
cd ui && npm run build
```

If affected-file review finds another registered aggregate that reads these modules, run it.
Full `npm test` is required before DONE because the public models contract changed.

## Live API and CLI matrix

Start the local ima2 server with an isolated config dir/port and a stubbed or tunnel-backed
Comfy origin. Register one legacy image fixture and the H3 video fixture through public APIs.

| Scenario | Expected evidence |
|---|---|
| image legacy record | `/api/models.lanes.comfy.models.image` retains row and ready/offline status |
| H3 video record | video array contains id+exact label+`executable:false`+lockReason |
| CLI JSON | `ima2 models --lane comfy --json` preserves additive fields |
| CLI human table | label and `locked` visible |
| no tunnel | rows remain visible with offline reason |
| bad media kind | stable 400 and CLI exit 2 |

## Fresh remote terminal state

Closeout 직전에 read-only SSH receipt가 다음을 모두 assert한다:

```text
comfyui.service inactive
llama-server-qwen38.service inactive
RTX 5090 power.limit 600.00
GPU compute process list empty
pruned DiT size/SHA unchanged
```

## Render grounding

Use the existing frontend dev server and native Browser QA. Do not install a browser runner.

1. Open provider selector, choose ComfyUI.
2. Capture the image workflow group and verify existing rows are selectable.
3. Capture the video group and verify `MiniMax H3 FL2VA pruned NVFP4` is visible,
   disabled, and carries the unsupported reason.
4. Keyboard through the selector; the locked row must not become current selection.
5. Observe console/network: no `/api/video/generate` request is emitted by clicking the row.
6. Repeat at desktop and narrow mobile viewport; exact label must not clip without title access.

Evidence: screenshot paths, current selected value, network/console summary, viewport sizes.
One clean observation closes the render loop; after any fix, rerun and re-observe.

## Independent verification

Dispatch fresh Sol medium reviewers with `cxc-dev` and search/reference proof attached:

- implementation reviewer: field chain, legacy compatibility, lock bypass, tests.
- check verifier: fresh command outputs and rendered evidence, no production edits.

FAIL requires synthesis before repair. Final reviewer must be fresh or uncontaminated by build.

## Completion matrix

| Outcome | Evidence threshold |
|---|---|
| DONE | c-1..c-6 met with capturedEvidence, all gates 0, screenshot clean, local commits |
| NOOP | only if 010/020 and 030 prove existing state already met every criterion |
| BLOCKED | external host/blob/API dependency prevents a criterion; raw receipts attached |
| UNSAFE | host protection would need weakening or unknown GPU process must be killed |
| NEEDS_HUMAN | license permission or an intent choice outside recorded scope |
| BUDGET_EXHAUSTED | stated 6h/phase wall bound reached; best-so-far is not DONE |

## Commit discipline

Local commits only, excluding user-owned dirty paths:

1. `docs(minimax-h3): lock pruned NVFP4 lidge and ima2 roadmap`
2. `ops(minimax-h3): record lidge pruned NVFP4 generation proof`
3. `feat(comfy): expose locked video workflows in model catalog`
4. `test(comfy): verify video workflow visibility and closeout`

Before each commit, inspect `git diff --cached --name-only`. Never stage
`docs/grok-video-i2v-research.md` unless it becomes explicitly in scope. No push.
After the final commit, `git ls-files` must print every 041/042/043/090 and evidence
path named by the closeout.
