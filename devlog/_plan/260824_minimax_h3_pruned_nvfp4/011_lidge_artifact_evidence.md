---
created: 2026-08-24
tags: [ima2-gen, devlog, evidence, lidge, minimax-h3, nvfp4, phase1]
---

# 011 — lidge pruned NVFP4 artifact와 8188 catalog evidence

## Download receipt

```text
source  lilcheaty/MiniMax-H3-NVFP4/main/minimax_h3_fl2va_pruned_nvfp4.safetensors
bytes   12528636800
sha256  72fa9269ce551fb63ff42a32d9b46d0c122e84b4b2c511e22fa698287b088f70
mode    wget -c to .part -> exact size/hash -> atomic mv
```

기존 mixed 파일은 25,543,362,094 bytes 그대로 보존됐다.

## Protected runtime receipt

실제 8188을 `comfyui.service`로 기동했다. 초기 네 번의 connection refused 뒤
`/system_stats`가 응답했고 false-pass 없이 계속 진행했다.

```text
comfyui_version  0.33.3
python_version   3.12.3
device           cuda:0 NVIDIA GeForce RTX 5090 : cudaMallocAsync cuda
vram_total       33645199360
object nodes     1792
```

`/object_info` exact assertions:

```text
UNETLoader target pruned NVFP4    true
CLIPLoader type minimax           true
Qwen3VL NVFP4-AWQ                 true
video VAE                         true
audio VAE                         true
Turbo 8-step LoRA                 true
MiniMaxH3ImageToVideo             true
MiniMaxH3SigmaShift               true
SamplerCustomAdvanced             true
SaveVideo                         true
```

## Final artifact stat

```text
12528636800 minimax_h3_fl2va_pruned_nvfp4.safetensors
25543362094 minimax_h3_fl2va_nvfp4_mixed.safetensors
15687142551 qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors
5207808496  minimax_h3_video_vae_fp16.safetensors
605254808   minimax_h3_audio_vae_fp32.safetensors
1956193000  minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors
```

## Teardown receipt

```text
comfyui.service                  inactive/dead
llama-server-qwen38.service      inactive/dead (user steering)
GPU compute apps                 0
010_cleanup_failure.txt          absent
unit path                        /etc/systemd/system/comfyui.service
MemoryHigh                       17179869184
MemoryMax                        21474836480
OOMScoreAdjust                   800
```

이 phase는 model catalog까지 검증했다. fresh Native/Emulated model-load 로그는
실제 H3 job을 제출하는 020 criterion이다.
