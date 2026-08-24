---
created: 2026-08-24
tags: [ima2-gen, devlog, roadmap-lock, minimax-h3, nvfp4]
---

# 003 — wp0 roadmap lock

Docs-only B에서 감사 반영 후 아래 문서를 implementation SSOT로 잠갔다.

```text
000_plan.md                              2db90c441c5bcff7f1e8ecbcbf8739df7ba57feb24e5e05378547704629a8b0a
001_current_state_receipts.md            87c9a814817fd4639032c3eb7d73d600595fd3c5833550f4f53ed3407b64b113
002_audit_synthesis.md                   b2e1c65690d4b8ae9f9684fd7d996088957822d256d49e7da246ee36ea640e5a
010_lidge_pruned_artifact_native.md       8aaaea3e3e2ad6fd5f43cef44b482272558549d1964c972b67b61345454a90c8
020_lidge_generation_proof.md             78ff2a6615bacb202ee55f9bb8d144160614fa167524a8843e56ece15b138a4c
030_ima2_comfy_video_visibility.md        8c1745382844f09146bc55c151a39223afa6bbf737f01e7f4fde93fce066cdc5
040_integrated_verification_closeout.md   e33cfd354bf74794e4f02580c82ae843cd63db5c54a4450cb814c89e83b9d409
```

다음 cycle의 P는 해당 decade 문서를 현재 tree와 다시 대조하고 stale이면 문서와
hash를 갱신한 뒤에만 B로 넘어간다. 이 lock은 계획 변경을 금지하지 않는다.
변경이 생기면 P-phase amendment와 새 checksum이 필요하다는 뜻이다.

wp1 P stale-check에서 010/020의 GPU peer unit과 power-limit restore 절차를
구체화했고, A 감사 FAIL 뒤 010에 fail-closed poll·trap·exact object_info 검사를
반영해 checksum을 다시 갱신했다. 근거는 `012`와 `013`이다.

wp1 B의 user steering으로 llama-server restore를 제거하고 010/020 checksum을
갱신했다. 근거는 `015_wp1_user_steering.md`다.

이 cycle에서 production code·lidge 서비스·원격 모델 파일은 변경하지 않았다.
