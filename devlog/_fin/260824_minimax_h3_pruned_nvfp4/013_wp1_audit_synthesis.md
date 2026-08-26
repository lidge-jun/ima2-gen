---
created: 2026-08-24
tags: [ima2-gen, devlog, audit, lidge, minimax-h3, phase1]
---

# 013 — wp1 audit FAIL synthesis

Rawls A audit verdict: FAIL. 네 건 모두 수용했다.

| Finding | RCA | Disposition |
|---|---|---|
| 8188 poll false-pass | loop 마지막 `sleep` exit가 성공이 될 수 있음 | `ready` flag, failure status+journal, exit 71 |
| teardown/peer restore prose-only | phase 사이에 peer downtime을 넘기려 했고 trap이 없었음 | download와 GPU segment 분리, EXIT trap, 매 phase peer 복원 |
| object_info가 node만 검사 | model/type/auxiliary option 목록을 보지 않음 | UNET/CLIP/VAE/LoRA exact option assertions |
| unit/preservation receipt 부족 | FragmentPath/User/WorkingDirectory/OOM/mixed stat 누락 | pre/post unit fields와 five-file stat 추가 |

`llama-server-qwen38.service`는 010 끝에 항상 원상 복구한다. 020은 독립 trap으로
다시 stop/start한다. 이 변경은 불필요한 28GB reload보다 phase 독립성과 host
복구 가능성을 우선한다.

VERDICT: FAIL — re-audit required
