---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, nvfp4, lidge, phase1]
---

# 010 — lidge pruned DiT 설치와 Native runtime 준비

## Contract

IN: 목표 blob 다운로드·검증, 기존 mixed 파일 보존, GPU peer의 unit-aware stop,
보호된 Comfy unit 기동, current `/system_stats`·`/object_info`·로그 baseline.

OUT: H3 `/prompt` 제출, 모델 성능 판정, R2V 파일, Sage/Sol-Attn 설치,
systemd unit 변경, 기존 model 삭제.

Resource bound: 60분. 다운로드는 13GB 이하, 임시·완성본 합 26GB 이하.
`/home/lidgeai/ComfyUI/models/diffusion_models/` 밖의 모델 트리는 쓰지 않는다.

## Exact remote delta

| Path | Action | Before | After |
|---|---|---|---|
| `/home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_pruned_nvfp4.safetensors` | NEW | 없음 | 12,528,636,800-byte verified blob |
| `/home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_nvfp4_mixed.safetensors` | KEEP | 25,543,362,094-byte blob | byte-identical rollback artifact |
| `/home/lidgeai/tmp/ima2-h3-pruned/010_*.txt` | NEW | 없음 | preflight, download, sha, service, API receipts |
| `devlog/_plan/260824_minimax_h3_pruned_nvfp4/011_lidge_artifact_evidence.md` | NEW at D | 없음 | command/output summary and exact timestamps |

No code or service-unit file changes occur in this phase.

## Procedure

1. Re-run read-only preflight and write output under the task temp directory:

```bash
ssh lidge 'mkdir -p /home/lidgeai/tmp/ima2-h3-pruned && \
  date -Ins > /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  systemctl show comfyui.service -p ActiveState -p SubState -p ExecStart -p MemoryHigh -p MemoryMax >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,power.limit --format=csv,noheader,nounits >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  free -b >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && df -B1 /home >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt'
```

2. Resolve PID 3100's owning unit with `systemctl status 3100` and record whether it
   was active. Stop only that resolved unit. If no unit owns it, return UNSAFE rather
   than raw-killing an unknown user process.

3. Download to an explicit `.part` path with resume. Do not follow an unverified
   alternate filename and do not rename the existing mixed file.

```bash
ssh lidge 'cd /home/lidgeai/ComfyUI/models/diffusion_models && \
  wget -c -O minimax_h3_fl2va_pruned_nvfp4.safetensors.part \
  https://huggingface.co/lilcheaty/MiniMax-H3-NVFP4/resolve/main/minimax_h3_fl2va_pruned_nvfp4.safetensors'
```

4. Verify exact bytes and SHA before atomic rename:

```bash
ssh lidge 'cd /home/lidgeai/ComfyUI/models/diffusion_models && \
  stat -c "%s %n" minimax_h3_fl2va_pruned_nvfp4.safetensors.part && \
  sha256sum minimax_h3_fl2va_pruned_nvfp4.safetensors.part'
```

Expected: `12528636800` and
`72fa9269ce551fb63ff42a32d9b46d0c122e84b4b2c511e22fa698287b088f70`.
Only then `mv` `.part` to the final name.

5. Start `comfyui.service`; poll actual 8188, never mock 8189. Capture current
   `/system_stats` and only the required `object_info` nodes/inputs into files.

```bash
ssh lidge 'sudo systemctl start comfyui.service && \
  for i in $(seq 1 60); do curl -fsS http://127.0.0.1:8188/system_stats && break; sleep 2; done'
```

6. Verify source and live API expose target model and required nodes:

```bash
ssh lidge 'curl -fsS http://127.0.0.1:8188/object_info > /home/lidgeai/tmp/ima2-h3-pruned/010_object_info.json && \
  /home/lidgeai/ComfyUI/venv/bin/python - <<"PY"
import json
p="/home/lidgeai/tmp/ima2-h3-pruned/010_object_info.json"
d=json.load(open(p))
for k in ["UNETLoader","CLIPLoader","VAELoader","LoraLoaderModelOnly","MiniMaxH3ImageToVideo","MiniMaxH3SigmaShift","SamplerCustomAdvanced","SaveVideo"]:
    print(k, "OK" if k in d else "MISSING")
PY'
```

7. Stop ComfyUI after receipts. Restore no peer unit in this phase; GPU remains clear
   for 020 unless the cycle terminates early, in which case restore the original peer.

## Activation scenarios

| Branch | Trigger | Observable proof | Disposition |
|---|---|---|---|
| already downloaded | final file has exact bytes+sha | no network transfer; receipt says NOOP | continue |
| partial download | `.part` exists | wget resumes and final hash matches | continue |
| wrong hash/size | either differs | no atomic rename; `.part` retained; phase BLOCKED | stop |
| GPU peer unresolved | PID has no service ownership | no kill issued | UNSAFE |
| Comfy start failure | 8188 absent after 120s | systemd status+journal captured | BLOCKED |
| node/model missing | object_info lacks required entry | exact missing keys captured | BLOCKED |

## Verifiers and target coverage

- `stat`/`sha256sum` directly read the new blob.
- `/system_stats` reads the real 8188 runtime.
- `/object_info` directly reads the node/model catalog needed by 020.
- `systemctl show` reads the protected unit and RAM bounds.
- This phase does not claim Native pruned model load; that branch is triggered by 020's
  actual model request.

## Rollback

Stop ComfyUI. Keep the verified pruned file unless it is corrupt. Because workflow
selection has not changed yet, the old mixed file remains the active rollback target.
Restore the GPU peer only if preflight proved it was active.
