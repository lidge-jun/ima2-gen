---
created: 2026-08-24
tags: [ima2-gen, devlog, rca, comfyui, minimax-h3, phase2]
---

# 025 — wp2 first-run preflight failure RCA

첫 wrapper 실행은 prompt 제출 전에 exit 1했다.

```text
ffprobe=                     # command absent
comfyui.service inactive
llama-server-qwen38 inactive
power.limit 600.00
prompt id absent
metrics absent
cleanup failure marker absent
```

RCA: 020 계획이 verifier를 lidge에서 실제 실행하지 않고 `ffprobe` 존재를 가정했다.
이는 PLAN-VERIFIER-REAL 위반이다. Comfy venv에는 PyAV 18.0.0이 있으므로 설치나
apt 변경 없이 Python runner가 같은 output을 열어 duration/format/stream/codec을
검증하게 바꿨다. shell preflight는 `import av`를 mutation 전에 실행한다.
