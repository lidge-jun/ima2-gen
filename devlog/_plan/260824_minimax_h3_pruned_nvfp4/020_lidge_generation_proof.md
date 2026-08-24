---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, nvfp4, lidge, phase2]
---

# 020 — pruned NVFP4 H3 terminal generation proof

## Contract

IN: 010의 verified artifact와 live object_info를 소비해 API-format T2V graph를
만들고, 5090 권장 vanilla smoke 한 건을 보호 unit에서 실행한다.

OUT: I2V·R2V, Turbo/Sage/Sol-Attn 최적화, cgroup 완화, 기존 mixed 비교 벤치,
ima2 코드 변경.

Resource bound: 120분. 단일 생성만 제출한다. 해상도 864x480, length 243,
steps 10, Sage off, LoRA 미적용, sampler `res_multistep`, scheduler `simple`.
MemoryMax=20G와 `--disable-pinned-memory --cache-none`는 유지한다.

## Artifact delta

| Path | Action | Content |
|---|---|---|
| `devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/020_t2v_api.json` | NEW | current object_info에 맞춘 flat `/prompt` graph |
| `.../evidence/020_submit.json` | NEW | prompt_id/node_errors receipt |
| `.../evidence/020_history.json` | NEW | terminal history |
| `.../evidence/020_metrics.csv` | NEW | timestamp, GPU memory/power/utilization, host available RAM |
| `.../evidence/020_output.*` | NEW | downloaded MP4/WebM output |
| `021_lidge_generation_evidence.md` | NEW at D | elapsed, peak, native/emulated lines, output stat/magic |

Remote transient copies live only under `/home/lidgeai/tmp/ima2-h3-pruned/`.

## Graph diff from prior mixed plan

The graph in `260823_minimax_h3/030_wp3_live_proof.md` is the starting topology.
Apply these exact semantic changes:

```diff
- UNETLoader(minimax_h3_fl2va_nvfp4_mixed.safetensors)
- LoraLoaderModelOnly(turbo_8step, 1.0)
+ UNETLoader(minimax_h3_fl2va_pruned_nvfp4.safetensors)
+ no LoRA node in the vanilla proof

  CLIPLoader(qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors, type=minimax)
  VAELoader(minimax_h3_video_vae_fp16.safetensors)
  VAELoader(minimax_h3_audio_vae_fp32.safetensors)
- MiniMaxH3ImageToVideo(..., width=864, height=480, length=73)
+ MiniMaxH3ImageToVideo(..., width=864, height=480, length=243)
  MiniMaxH3SigmaShift(shift_video=12, shift_audio=3)
  KSamplerSelect(res_multistep)
- BasicScheduler(simple, steps=8, denoise=1.0)
+ BasicScheduler(simple, steps=10, denoise=1.0)
  SamplerCustomAdvanced -> VAEDecode + VAEDecodeAudio -> CreateVideo(fps=24) -> SaveVideo
```

No custom Sage node appears in the graph. Node IDs are deterministic strings in the
checked-in fixture, but every class/input is validated against 010's current
`object_info` before submission.

## Procedure

1. Confirm no GPU peer and start only `comfyui.service`.
2. Record a log cursor (`journalctl -u comfyui.service -n 0 --show-cursor`) and start
   one-second GPU/RAM sampling to `020_metrics.csv`.
3. POST the flat graph to actual 8188. Reject any non-empty `node_errors`.
4. Poll `/history/{prompt_id}` and `/queue` every 3s. Terminal success requires
   `status.completed:true`; history existence alone is insufficient.
5. At first `Requested to load MiniMaxH3`, capture the new log segment. The segment
   must include `nvfp4` in Native ops and not in Emulated ops.
6. On success, locate the bound `SaveVideo` output. Comfy 0.33.3 may expose video
   files under an `images` array with `animated:true`; preserve the raw JSON rather
   than normalizing it before the 030 implementation.
7. Fetch `/view` from filename/subfolder/type. Verify with `file`, first 16 bytes,
   and `ffprobe` duration/streams. Copy receipts back into the local evidence folder.
8. Stop ComfyUI, stop sampling, restore the peer unit only if it was active at 010
   entry.

## Success evidence

```text
prompt submit: HTTP 200/202, prompt_id, node_errors={}
history: status_str=success, completed=true
runtime: fresh Native ops contains nvfp4; fresh Emulated ops does not
output: file identifies MP4/WebM; ffprobe sees video stream and expected duration range
metrics: peak VRAM < physical total; host and service remain reachable
elapsed: monotonic start/end timestamps
teardown: comfy service stopped; original GPU peer restored
```

Expected duration is near 10s for 243 frames at 24fps. The user-provided community
figure of ~175s and ~26.9GB VRAM is a comparison target, not a pass condition.

## Activation scenarios

| Branch | Trigger | Observable effect | Result |
|---|---|---|---|
| native | fresh model-load log has Native `nvfp4`, no Emulated `nvfp4` | continue | eligible for DONE |
| emulated | Emulated contains `nvfp4` or Native lacks it | cancel/stop and capture | BLOCKED, no speed claim |
| cgroup OOM | systemd Result/oom log or MemoryMax kill | host stays reachable; no retry with weaker guard | BLOCKED |
| CUDA OOM | terminal history error with allocator trace | one failure only; no higher size retry | BLOCKED |
| schema drift | `/prompt` node_errors non-empty | no GPU job starts | return to P/repair graph |
| terminal error | completed false/status error | capture raw history and logs | BLOCKED after RCA |
| success | completed true + valid media | copy evidence, teardown | continue to 030 |

## Verifiers and target coverage

- JSON schema script checks every node id and linked slot in `020_t2v_api.json`.
- `/prompt`, `/queue`, `/history`, `/view` directly exercise the real graph.
- `journalctl` from the saved cursor proves the current request's model-load branch.
- `nvidia-smi`/`free` sampling observes the requested 5090/RAM behavior.
- `file` and `ffprobe` read the actual output artifact.

## Rollback

`POST /queue {delete:[prompt_id]}` and `POST /interrupt {prompt_id}` are both issued on
cancel. Stop the protected unit. Preserve output/error receipts. Restore the original
GPU peer. Do not delete either DiT.
