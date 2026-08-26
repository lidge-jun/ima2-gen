---
created: 2026-08-24
tags: [ima2-gen, devlog, steering, lidge, llama-server, phase1]
---

# 015 — user steering: llama-server 유지 종료

사용자 지시: `/llama-server 이거는 죽여`.

```text
systemctl --user stop llama-server-qwen38.service       exit 0
systemctl --user is-active llama-server-qwen38.service  inactive
nvidia-smi compute-app list                             empty
download progress at steering                           1,478,411,126 bytes (11.80%)
```

- 010/020 cleanup은 llama peer를 재시작하지 않는다.
- 각 postcondition은 Comfy inactive + llama peer inactive다.
- 020에서 임시 500W power limit만 원래 600W로 복원한다.
- 기존 active-state receipt는 사실 기록으로 남기되 rollback 목표에서 제외한다.
