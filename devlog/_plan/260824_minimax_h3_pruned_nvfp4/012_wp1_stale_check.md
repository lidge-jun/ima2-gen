---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, stale-check, phase1]
---

# 012 — wp1 P stale-check

2026-08-24 21:25 KST, read-only 재확인:

```text
comfyui.service  inactive/dead
MemoryHigh       17179869184
MemoryMax        21474836480
GPU              RTX 5090, used 28485 MiB, free 3603 MiB
power.limit      600 W
GPU process      PID 3100 llama-server, 28338 MiB
cgroup           .../app.slice/llama-server-qwen38.service
target final     absent
target .part     absent
```

`systemctl --user --type=service --state=running`에서도
`llama-server-qwen38.service`가 active/running으로 확인됐다. 이후 사용자가 이
unit을 죽이라고 지시해 B에서 정상 stop했고 GPU compute process가 0건이 됐다.
015 steering 이후에는 peer를 복원하지 않고 inactive를 유지한다. 600W power
limit만 020 teardown에서 복원한다.

감사 전 stale-check는 경로와 크기·SHA를 확인했지만, 초기 010은 8188 poll의
false-pass와 failure-safe teardown이 부족했다. 해당 주장은 `013` 감사와 수정된
010으로 대체한다.
