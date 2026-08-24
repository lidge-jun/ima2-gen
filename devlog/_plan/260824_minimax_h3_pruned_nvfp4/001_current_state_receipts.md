---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, nvfp4, evidence]
---

# 001 — docs-only current-state 영수증

이 문서는 원격·업스트림·로컬을 변경하지 않은 P-phase 조사 결과다.

## lidge read-only receipt

```text
ComfyUI root     /home/lidgeai/ComfyUI
ComfyUI version  0.33.3 @ 4da9e2dbead52fc1e68beae33fe3d7ad63b63241
python           /home/lidgeai/ComfyUI/venv/bin/python
torch            2.13.0+cu130
GPU              RTX 5090; memory.total=33645199360 bytes
service          comfyui.service inactive/dead, disabled
unit args         --listen 127.0.0.1 --port 8188 --disable-pinned-memory --cache-none
cgroup            MemoryHigh=16G MemoryMax=20G OOMScoreAdjust=800
GPU peer          llama-server PID 3100, 28338 MiB
disk free         about 1.3 TiB
RAM               30 GiB total, about 26 GiB available
swap              about 55 GiB
```

8189의 `comfyui_hooking_server`는 mock `/system_stats`·`/object_info`를 내므로
실기 증거로 쓰지 않는다. 실제 ComfyUI 8188은 조사 시점에 내려가 있었고 외부
터널은 502였다.

## Artifact receipt

| 위치 | 파일 | bytes |
|---|---|---:|
| diffusion_models | `minimax_h3_fl2va_nvfp4_mixed.safetensors` | 25,543,362,094 |
| text_encoders | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | 15,687,142,551 |
| vae | `minimax_h3_video_vae_fp16.safetensors` | 5,207,808,496 |
| vae | `minimax_h3_audio_vae_fp32.safetensors` | 605,254,808 |
| loras | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | 1,956,193,000 |

보조 파일 네 개는 2026-08-24의 Comfy-Org blob metadata와 byte-for-byte 일치한다.

## Native ops receipt

과거 실제 H3 model-load 로그에서 다음을 확인했다.

```text
Native ops: float8_e4m3fn, nvfp4, float8_e5m2, convrot_w4a4, ...
Requested to load MiniMaxH3
Model MiniMaxH3 prepared for dynamic VRAM loading. 24359MB Staged.
```

카운트:

```text
comfyui_8188.prev.log   native_nvfp4=1 emulated_nvfp4=0
comfyui_8188.prev2.log  native_nvfp4=1 emulated_nvfp4=0
comfyui.log             native_nvfp4=4 emulated_nvfp4=0
```

이는 runtime capability 증거지만 목표 pruned 파일의 fresh load 증거는 아니다.
020에서 새 로그 구간을 따로 캡처한다.

## Upstream proof

- lilcheaty model API commit: `8c5abfed...`, modified 2026-08-05.
- target blob: 12,528,636,800 bytes,
  SHA-256 `72fa9269ce551fb63ff42a32d9b46d0c122e84b4b2c511e22fa698287b088f70`.
- Comfy-Org API commit: `d6cfb4e5...`, modified 2026-08-23.
- source URLs:
  - `https://huggingface.co/api/models/lilcheaty/MiniMax-H3-NVFP4?blobs=true`
  - `https://huggingface.co/lilcheaty/MiniMax-H3-NVFP4/raw/main/README.md`
  - `https://huggingface.co/api/models/Comfy-Org/MiniMax-H3?blobs=true`
  - `https://huggingface.co/Comfy-Org/MiniMax-H3/raw/main/README.md`

라이선스 metadata는 `other`이며 MiniMax H3 community license의 지역 조건은
기술 검증과 별개다. 이 작업은 허가를 판정하지 않는다.

## Local baseline

작업 시작 시 사용자 소유 변경은 그대로 보존했다.

```text
 M docs/grok-video-i2v-research.md
?? devlog/_plan/260823_minimax_h3/030_wp3_live_proof.md
```

탐색기가 실행한 현재-tree verifier:

```text
node --experimental-strip-types --test tests/comfy-workflow-store.test.ts \
  tests/comfy-graph-bind.test.ts tests/comfy-provider-contract.test.ts \
  tests/comfy-routes-contract.test.ts tests/comfy-cli-contract.test.ts \
  tests/comfy-ui-contract.test.ts
# 59 pass, exit 0

npm run typecheck                 # exit 0
npm run typecheck:tests           # exit 0
npm run ui:build                  # exit 0
npm run test:provider-registry    # exit 0
node --experimental-strip-types --test \
  tests/videoArtifactPersistence.test.ts tests/videoRoute.test.ts
# exit 0
```
