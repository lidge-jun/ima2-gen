---
created: 2026-08-23
tags: [ima2-gen, devlog, comfyui, minimax-h3, video, plan]
---

# 000 — MiniMax H3 NVFP4 on lidge: 계획

목표: lidge(RTX 5090)에 H3 NVFP4를 설치하고 T2V + I2V를 실기 검증한 뒤,
ima2 comfy 레인에 비디오 수신 경로를 연결하거나 정직한 블로커 문서를 남긴다.

## 프리플라이트 실측 (2026-08-23)

| 항목 | 값 |
|---|---|
| ComfyUI | v0.27.0-15-g6c62ca0b (master, origin=comfyanonymous) |
| torch | 2.11.0+cu128 (python 3.12) |
| driver | 580.173.02 — CUDA 13 지원 세대 |
| GPU | RTX 5090 32GB, 사용중 7.3GB (ComfyUI 상주) |
| disk | 1.4T free |
| llama.cpp | 내려가 있음 (프로세스 0) |

## 단계

- 010 (wp1): ComfyUI git pull → >=0.30, requirements 갱신,
  torch cu128→cu130 결정. 드라이버가 받쳐주므로 cu130 업그레이드 시도,
  실패 시 cu128 유지 + 성능 캐비앗 기록. 재시작 후 /system_stats 버전과
  object_info의 H3 노드 존재 확인.
- 020 (wp2): 모델 다운로드 — FL2VA NVFP4 체크포인트(dotexec 또는 Comfy-Org),
  H3 VAE, 오디오 VAE, qwen3vl 텍스트 인코더(nvfp4 awq), Turbo LoRA.
  nohup 백그라운드 + 진행 폴링. 게시된 크기/샤섬 대조.
- 030 (wp3): T2V — 공식 템플릿 그래프 API 포맷으로 /prompt 제출(터널
  127.0.0.1:18188), /history 폴링, /view 수신, 매직바이트/크기/시간 기록.
  I2V — /upload/image로 첫 프레임 업로드, 같은 그래프에 이미지 바인딩.
  FL2VA는 이미지 0/1/2장으로 T2V/I2V/FLF2V 분기하므로 워크플로는 하나.
- 040 (wp4): ima2 등록 — 검증된 그래프를 comfy workflow store에 등록.
  현 어댑터는 SaveImage/PNG 수신 기준이므로 비디오 출력(SaveVideo,
  history의 gifs/videos 필드, mp4/webm 매직바이트) 수신 경로를 최소
  구현 + 테스트, 규모가 크면 블로커/로드맵 문서로 대체. 게이트 전체
  그린 후 로컬 dev 커밋.

## 리스크

- H3 노드명/템플릿 구조는 020에서 object_info 실측으로 확정 (문서 추정 금지).
- 체크포인트 수십 GB — 다운로드가 지배 비용. 백그라운드 + 폴링.
- 32GB VRAM에서 2K/15s는 무리일 수 있음 — 짧은 저해상 프리셋으로 검증.
- ComfyUI 업데이트가 기존 SDXL 레인을 깨면 안 됨 — 업데이트 후 기존
  comfy 레인 스모크 1회.
