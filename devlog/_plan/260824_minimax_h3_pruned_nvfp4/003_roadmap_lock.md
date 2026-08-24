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
020_lidge_generation_proof.md             d25f0efcf91a0fe16fece5daa1cb376afad9740cd315a28f218e9350082c3e0d
030_ima2_comfy_video_visibility.md        2167dfe26e6e90fa4648556de343cbc8decafdb37097c6f1378619b84565201d
040_integrated_verification_closeout.md   3b9cfbdb364bd425bc62f19f928df6264b7cdd0134cf0ff8c8945a310400cef4
```

다음 cycle의 P는 해당 decade 문서를 현재 tree와 다시 대조하고 stale이면 문서와
hash를 갱신한 뒤에만 B로 넘어간다. 이 lock은 계획 변경을 금지하지 않는다.
변경이 생기면 P-phase amendment와 새 checksum이 필요하다는 뜻이다.

wp1 P stale-check에서 010/020의 GPU peer unit과 power-limit restore 절차를
구체화했고, A 감사 FAIL 뒤 010에 fail-closed poll·trap·exact object_info 검사를
반영해 checksum을 다시 갱신했다. 근거는 `012`와 `013`이다.

wp1 B의 user steering으로 llama-server restore를 제거하고 010/020 checksum을
갱신했다. 근거는 `015_wp1_user_steering.md`다.

wp2 P stale-check에서 official local-weight subgraph를 14-node vanilla graph로
고정하고 020 cleanup을 single-wrapper trap 계약으로 승격했다. 근거는 `022`다.

wp3 P stale-check에서 model-level lock을 CLI resolver까지 연결하고 H3 graph
binding inference를 추가했다. baseline targeted suite는 72 pass다. 근거는 `027`이다.

이 cycle에서 production code·lidge 서비스·원격 모델 파일은 변경하지 않았다.
