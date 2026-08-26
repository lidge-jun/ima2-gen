---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, live-proof]
---

# 030 — wp3 실기 T2V/I2V 검증 계획

## 실측 기반 그래프 설계

공식 템플릿(video_minimax_h3_t2v.json)은 서브그래프 UUID 노드를 포함한
UI 포맷이라 /prompt에 직접 못 쓴다(011 소견 확인). 서브그래프 내부 배선을
실측했고, 이를 API 포맷으로 플래튼한다:

    UNETLoader(minimax_h3_fl2va_nvfp4_mixed) -> LoraLoaderModelOnly(turbo_8step, 1.0)
    CLIPLoader(qwen3vl_32b_minimax_h3_nvfp4_awq, type=minimax)
    VAELoader(video_vae_fp16), VAELoader(audio_vae_fp32)
    MiniMaxH3ImageToVideo(clip, video_vae, prompt, W, H, length[, first_frame]) -> (positive, LATENT)
    RandomNoise + KSamplerSelect(res_multistep) + BasicScheduler(simple, 8, 1.0) + BasicGuider(model, positive)
    SamplerCustomAdvanced -> LATENT
    VAEDecode(latent, video_vae) -> IMAGE ; VAEDecodeAudio(latent, audio_vae) -> AUDIO
    CreateVideo(images, fps=24, audio) -> SaveVideo(format=auto, codec=auto)

템플릿과의 차이: diffusion 가중치를 int8_convrot 대신 NVFP4(mixed)로 교체,
스위치/수식 노드는 상수로 대체. cfg-distilled라 BasicGuider(무 negative).

## 파라미터

- 해상도 864x480 (32 배수, 0.4MP — RAM/VRAM 보수적), length 73 (17k+5 그리드, ~3s)
- turbo 8step LoRA + steps 8
- T2V: first_frame 없음. I2V: /upload/image 후 LoadImage -> first_frame.

## 검증 항목

1. /prompt 202/200 수용, /history completed:true
2. history outputs 스키마 실측 기록 (images+animated 가설 검증 — wp4 설계 입력)
3. /view로 비디오 수신, 매직바이트(mp4/webm) + 크기 + 소요시간
4. I2V: 첫 프레임 이미지가 실제 결과에 반영되는지 육안 확인
5. 산출물 로컬 evidence/에 저장

## 리스크

- RAM 30Gi vs 가중치 49GB: mmap 스트리밍 전제. OOM 시 --cache-none 재기동.
- 첫 로드는 디스크 I/O로 수 분 걸릴 수 있음 — 타임아웃 넉넉히(15분).
