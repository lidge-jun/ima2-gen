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
MemoryMax=20G와 `--disable-pinned-memory --cache-none`는 유지한다. GPU power limit은
실측 600W에서 사용자 지정 500W로 생성 직전에 낮추고 teardown에서 600W로 복원한다.

## Artifact delta

| Path | Action | Content |
|---|---|---|
| `devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/020_t2v_api.json` | NEW | current object_info에 맞춘 flat `/prompt` graph |
| `.../evidence/020_run_t2v.py` | NEW | submit, queue/history poll, raw JSON, `/view` download and PyAV probe |
| `.../evidence/020_run_t2v.sh` | NEW | 500W/service/metrics/cancel/teardown trap owner |
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
  KSamplerSelect(res_multistep)
- BasicScheduler(simple, steps=8, denoise=1.0)
+ BasicScheduler(simple, steps=10, denoise=1.0)
  SamplerCustomAdvanced -> VAEDecode + VAEDecodeAudio -> CreateVideo(fps=24) -> SaveVideo
```

No custom Sage or SigmaShift node appears in the graph. Current official local-weight
template `video_minimax_h3_t2v.json` (workflow package 2026-08-24) contains neither;
its subgraph wires BasicScheduler directly to the selected UNET. Node IDs are
deterministic strings in the checked-in fixture, and every class/input is validated
against 010's current `object_info` before submission.

## Procedure

1. Build the three evidence files and run local static checks before SSH:

```bash
bash -n evidence/020_run_t2v.sh
python3 -m py_compile evidence/020_run_t2v.py
node -e 'JSON.parse(require("fs").readFileSync("evidence/020_t2v_api.json"))'
```

2. `020_run_t2v.sh` owns one remote lifecycle and installs EXIT/INT/TERM cleanup
   before any mutation. It records original power (`600.00` in stale-check), confirms
   llama peer inactive/GPU apps empty, applies 500W, starts only `comfyui.service`,
   fail-closed polls real 8188, starts one-second GPU/RAM metrics, then runs Python.
3. `020_run_t2v.py` POSTs the graph, rejects non-empty `node_errors`, writes prompt id
   immediately, polls `/history/{id}` plus `/queue` every 3s, and requires
   `status.completed:true`. History existence alone is insufficient.
4. On success Python preserves raw history, locates the bound SaveVideo output even
   when represented under `images` with `animated:true`, and downloads `/view` to the
   remote evidence dir.
5. The shell captures the current journal segment. It requires `nvfp4` in Native ops
   and absent from Emulated ops for the fresh MiniMaxH3 load.
6. The cleanup trap, on success or any failure, best-effort calls both cancel endpoints
   when a prompt id exists, stops metrics, stops Comfy, restores the recorded 600W,
   keeps llama inactive, and then asserts all postconditions. Cleanup/assert failure
   overrides the original return with exit 72.
7. Copy raw receipts to the local evidence folder. Verify output with `file`, first
   16 bytes, and Comfy venv PyAV duration/streams. lidge has no `ffprobe`; PyAV 18.0.0
   is the verified existing media parser and adds no dependency.

## Success evidence

```text
prompt submit: HTTP 200/202, prompt_id, node_errors={}
history: status_str=success, completed=true
runtime: fresh Native ops contains nvfp4; fresh Emulated ops does not
output: file identifies MP4/WebM; PyAV sees video stream and expected duration range
metrics: peak VRAM < physical total; host and service remain reachable
elapsed: monotonic start/end timestamps
teardown: comfy service stopped; user-stopped llama peer remains inactive
power: 500W during job; original 600W restored
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
- `file` and PyAV read the actual output artifact.

## Rollback

`POST /queue {delete:[prompt_id]}` and `POST /interrupt {prompt_id}` are both issued on
cancel from the wrapper trap. The same trap stops the protected unit, stops metrics,
restores 600W, keeps llama inactive, and verifies those states. Preserve output/error
receipts. Do not delete either DiT.
