---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, downloads]
---

# 020 — wp2 모델 다운로드 계획

HF API 실측으로 SKU 확정 (011 감사 소견 반영: NVFP4 diffusion은 dotexec에만 존재).

| 파일 | 저장소 | 크기 | 대상 디렉토리 |
|---|---|---|---|
| minimax_h3_fl2va_nvfp4_mixed.safetensors | dotexec/MiniMax-H3-T2V-NVFP4 | 25.5GB | models/diffusion_models/ |
| qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors | Comfy-Org/MiniMax-H3 | 15.7GB | models/text_encoders/ |
| minimax_h3_video_vae_fp16.safetensors | Comfy-Org/MiniMax-H3 | 5.2GB | models/vae/ |
| minimax_h3_audio_vae_fp32.safetensors | Comfy-Org/MiniMax-H3 | 0.6GB | models/vae/ |
| minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors | Comfy-Org/MiniMax-H3 | 2.0GB | models/loras/ |

합계 ~49GB, 디스크 1.4T 여유로 문제없음. 텍스트 인코더는 dotexec의
"ultra_uncensored_heretic" 변형 대신 Comfy-Org 공식 nvfp4_awq를 쓴다.

방법: lidge에서 nohup wget -c (이어받기 가능) 순차 실행, 진행률은
파일 크기 폴링. 완료 후 기대 크기와 바이트 단위 대조.

RAM 30Gi 제약: 가중치 합 49GB > RAM이지만 ComfyUI는 mmap 로드 +
가중치 스트리밍(dynamic VRAM loading이 wp1 smoke 로그에서 확인됨)으로
동작. wp3에서 OOM 발생 시 --cache-none / --lowvram 재기동으로 대응.
