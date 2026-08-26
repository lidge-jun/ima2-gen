---
created: 2026-08-24
tags: [ima2-gen, devlog, evidence, comfyui, minimax-h3, nvfp4, phase2]
---

# 021 — lidge MiniMax H3 pruned NVFP4 terminal proof

## Request

```text
prompt_id    b71f9c78-07bf-4691-9a59-a7c85f84789f
node_errors  {}
graph        14 nodes, local-weight vanilla T2V
model        minimax_h3_fl2va_pruned_nvfp4.safetensors
size         864x480
length       243 frames (17*14+5)
steps        10
sampler      res_multistep
scheduler    simple
Sage/LoRA    off / absent
power limit  500W during job
```

## Terminal receipt

```text
status_str       success
completed        true
Comfy execution  102.26 seconds
runner elapsed   105.138 seconds
output node      92 SaveVideo
history shape    outputs.92.images[0] + animated:[true]
```

Raw: `evidence/020_submit.json`, `evidence/020_history.json`,
`evidence/020_result.json`.

## Native NVFP4 receipt

Fresh log slice, captured from the current run only:

```text
Requested to load MiniMaxH3TEModel_
Native ops: mxfp8, nvfp4, asym_w4a8_int8, int8_tensorwise,
            float8_e5m2, float8_e4m3fn, convrot_w4a4
Requested to load MiniMaxH3
Requested to load MiniMaxH3AudioVAE
Requested to load MiniMaxH3VideoVAE
Prompt executed in 102.26 seconds
```

Fresh segment에서 `Emulated ops:.*nvfp4`는 0건이다.

## Runtime metrics

104 one-second samples:

```text
peak VRAM             30156 MiB
peak sampled power    508.89 W
min host MemAvailable 22020276 KiB (~21.0 GiB)
GPU utilization       reached 100%
```

사용자 제공 community figure(~26.9GB, ~175s)보다 이 host의 peak VRAM은 높고
elapsed는 짧았다. 측정값을 평균내지 않고 실제 receipt 그대로 기록한다.

## Media receipt

```text
path       evidence/020_output.mp4
bytes      695184
sha256     4807b620a6c55ff78d768d3414961b8da6ac5356bdb03d32d47ef251a4fac331
magic      000000206674797069736f6d00000200
container  mov,mp4,m4a,3gp,3g2,mj2
duration   10.125 seconds
video      h264, 864x480
audio      aac
```

PyAV duration unit bug는 `026`에서 고쳤고 기존 MP4를 다시 열어 corrected receipt를
작성했다. generation은 재실행하지 않았다.

## Visual observation

- `evidence/020_frame_120.png`: 새벽 검은 모래 해변, 파도와 흐린 하늘이 prompt와 일치.
- `evidence/020_contact_sheet.png`: frame 0/60/120/180/242에서 카메라 구도가
  안정적으로 유지되고 파도 위치가 연속적으로 변한다. 심한 형상 붕괴·텍스트·로고 없음.

## Teardown

```text
comfyui.service               inactive/dead
llama-server-qwen38.service   inactive/dead (user steering)
power limit                   600W restored
GPU memory used               139 MiB
GPU compute apps              0
cleanup failure marker        absent
```

## Repair ledger

- attempt 1: missing `ffprobe` preflight에서 prompt 전 fail; mutation/receipt 없음.
- attempt 2: generation success.
- post-success receipt fixes: PyAV duration divide, CSV comma-free timestamp.
