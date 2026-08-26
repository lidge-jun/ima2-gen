---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, evidence]
---

# 021 — wp2 다운로드 실측 기록

wget -c 순차 실행, ~90-100MB/s, 총 ~25분. ALL_DOWNLOADS_DONE 마커 확인.

| 파일 | 기대 바이트 (HF HEAD) | 실측 바이트 (du -sb) | 일치 |
|---|---|---|---|
| minimax_h3_fl2va_nvfp4_mixed | 25543362094 | 25543362094 | O |
| qwen3vl_32b_minimax_h3_nvfp4_awq | 15687142551 | 15687142551 | O |
| minimax_h3_video_vae_fp16 | 5207808496 | 5207808496 | O |
| minimax_h3_audio_vae_fp32 | 605254808 | 605254808 | O |
| minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16 | 1956193000 | 1956193000 | O |

합계 49.0GB. HF가 이 저장소들에 게시한 체크섬(xet 해시)은 HEAD 노출이
제한적이라 바이트 단위 완전 일치를 1차 검증으로 채택 (감사자 Darwin도
"exact-byte check acceptable, SHA256 nicer not required" 판정).
