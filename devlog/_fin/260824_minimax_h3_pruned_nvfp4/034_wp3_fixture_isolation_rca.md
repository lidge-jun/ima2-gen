---
created: 2026-08-24
tags: [ima2-gen, devlog, rca, test-isolation, comfyui, phase3]
---

# 034 — models test가 실제 workflow store를 건드린 RCA

초기 `/api/models` test가 TS `config` singleton을 scratch로 바꿨지만
`comfyWorkflowStore.ts`는 generated `config.js` singleton을 읽었다. 결과적으로
dummy `h3`가 실제 `~/.ima2/comfy/workflows.json`에 기록됐다.

복구:

- dummy `h3`를 public CLI로 삭제.
- 검증된 `minimax-h3-fl2va-pruned-nvfp4`만 public CLI로 등록.

영구 수정:

- `ModelsRouteDeps`에 read-only `listComfyWorkflows`와 `probeComfyOrigins` injection을
  추가했다.
- models contract test는 디스크/config singleton을 전혀 쓰지 않고 workflow/health
  fixture를 직접 주입한다.
- rerun 뒤 실제 store에는 검증된 H3 id 하나만 남는다.
