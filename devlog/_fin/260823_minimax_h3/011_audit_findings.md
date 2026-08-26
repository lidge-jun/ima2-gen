---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, audit]
---

# 011 — 지연 도착 감사 소견 반영 (Sartre, grok-4.6)

1차 감사자가 wp1 게이트 이후 상세 소견을 반환했다. 게이트는 2차 감사자
(Jason) pass로 통과했으나, 소견의 사실 발견은 wp2-wp4에 흡수한다:

| 발견 | 반영 |
|---|---|
| NVFP4 diffusion은 dotexec/MiniMax-H3-T2V-NVFP4 의 minimax_h3_fl2va_nvfp4_mixed.safetensors (24.4GB)만 존재. Comfy-Org는 int8_convrot(19.5GB)+fp8 계열 | wp2 다운로드 SKU를 dotexec NVFP4 + Comfy-Org 보조파일(qwen3vl nvfp4_awq 14.6GB, VAE ~6GB, 오디오 VAE, Turbo LoRA)로 확정 |
| lidge 시스템 RAM 30Gi — 가중치 합 ~45GB, mmap/offload 없으면 RAM OOM 선행 | wp3 실행 전 SDXL 상주 언로드(/free), --cache-none 검토, 저해상 프리셋(864x480 0.4MP) |
| history 출력 스키마는 SaveVideo도 images + animated:(true,) — gifs/videos 키는 존재하지 않음 | wp4 수신 경로는 images 배열 + animated 플래그 + 매직바이트(mp4/webm) 판정으로 설계 |
| 공식 H3 템플릿은 서브그래프 UUID 포함 UI JSON — /prompt에 그대로 400 | wp3는 API 포맷 그래프를 직접 구성(object_info 시그니처 기반) |
| I2V 입력은 MiniMaxH3ImageToVideo.first_frame/last_frame, LoadImage 바인딩 아님 | wp4 등록 시 bind 규칙 확장 필요성 문서화 |
| ComfyUI 롤백 핀 | 6c62ca0b (v0.27.0-15) 기록, 문제 시 git checkout 6c62ca0b |

## wp1 C 검증 실측 (2026-08-23)

    version: 0.33.3
    H3_nodes: [EmptyMiniMaxH3LatentAV, MiniMaxH3ImageToVideo, MiniMaxH3ReferenceToVideo, MiniMaxH3SigmaShift]
    SDXL smoke: submit 200 -> ima2_smoke_0333_00001_.png, SMOKE_OK, exit 0

커스텀 노드 로딩 상태는 기동 로그에서 별도 확인(치명 실패 없음 확인 후 진행).
