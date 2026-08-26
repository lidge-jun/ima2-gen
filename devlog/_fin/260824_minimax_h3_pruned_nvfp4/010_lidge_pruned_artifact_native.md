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

User steering (2026-08-24): `llama-server-qwen38.service`는 즉시 stop됐고 이
goal이 끝날 때까지 재시작하지 않는다. cleanup postcondition은 peer inactive다.

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
  systemctl show comfyui.service -p ActiveState -p SubState -p FragmentPath -p User -p Group -p WorkingDirectory -p ExecStart -p MemoryHigh -p MemoryMax -p OOMScoreAdjust >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,power.limit --format=csv,noheader,nounits >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  free -b >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && df -B1 /home >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt && \
  stat -c "%s %n" /home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_nvfp4_mixed.safetensors \
    /home/lidgeai/ComfyUI/models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors \
    /home/lidgeai/ComfyUI/models/vae/minimax_h3_video_vae_fp16.safetensors \
    /home/lidgeai/ComfyUI/models/vae/minimax_h3_audio_vae_fp32.safetensors \
    /home/lidgeai/ComfyUI/models/loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors \
    >> /home/lidgeai/tmp/ima2-h3-pruned/010_preflight.txt'
```

2. P stale-check resolved PID 3100 through `/proc/3100/cgroup` to the user unit
   `llama-server-qwen38.service`; it was active. User steering then stopped that unit
   and `nvidia-smi` showed no compute process. Keep it inactive. If it reappears, verify
   the same cgroup ownership before stopping the unit again; never raw-kill a process.

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

5. After download verification, execute one remote script for the complete GPU/service
   segment. Start, poll, object-info validation, teardown, restoration, post-run stats,
   and final-state assertions remain in the same SSH process.

```bash
ssh lidge 'bash -s' <<'REMOTE'
set -Eeuo pipefail
tmp=/home/lidgeai/tmp/ima2-h3-pruned
peer=llama-server-qwen38.service

record_post() {
  systemctl show comfyui.service -p ActiveState -p SubState -p FragmentPath -p User -p Group -p WorkingDirectory -p MemoryHigh -p MemoryMax -p OOMScoreAdjust > "$tmp/010_post_state.txt" 2>&1 || return 1
  systemctl --user show "$peer" -p ActiveState -p SubState >> "$tmp/010_post_state.txt" 2>&1 || return 1
  stat -c "%s %n" \
    /home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_pruned_nvfp4.safetensors \
    /home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_nvfp4_mixed.safetensors \
    /home/lidgeai/ComfyUI/models/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors \
    /home/lidgeai/ComfyUI/models/vae/minimax_h3_video_vae_fp16.safetensors \
    /home/lidgeai/ComfyUI/models/vae/minimax_h3_audio_vae_fp32.safetensors \
    /home/lidgeai/ComfyUI/models/loras/minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors \
    >> "$tmp/010_post_state.txt" 2>&1 || return 1
}

cleanup() {
  local rc=0
  sudo systemctl stop comfyui.service || rc=1
  systemctl --user stop "$peer" || rc=1
  if systemctl is-active --quiet comfyui.service; then rc=1; fi
  if systemctl --user is-active --quiet "$peer"; then rc=1; fi
  record_post || rc=1
  return "$rc"
}

on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if ! cleanup; then
    echo "cleanup or final-state assertion failed" >> "$tmp/010_cleanup_failure.txt"
    rc=72
  fi
  exit "$rc"
}
trap on_exit EXIT INT TERM

if systemctl --user is-active --quiet "$peer"; then
  peer_pid=$(systemctl --user show "$peer" -p MainPID --value)
  test "$peer_pid" -gt 0
  cg=$(cat "/proc/$peer_pid/cgroup")
  case "$cg" in *app.slice/llama-server-qwen38.service) ;; *) echo "unexpected GPU peer: $cg" >&2; exit 70;; esac
  systemctl --user stop "$peer"
fi
sudo systemctl start comfyui.service

ready=0
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8188/system_stats > "$tmp/010_system_stats.json"; then ready=1; break; fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  systemctl status comfyui.service --no-pager > "$tmp/010_start_failure.txt" 2>&1 || true
  journalctl -u comfyui.service -n 200 --no-pager >> "$tmp/010_start_failure.txt" 2>&1 || true
  exit 71
fi

curl -fsS http://127.0.0.1:8188/object_info > "$tmp/010_object_info.json"
/home/lidgeai/ComfyUI/venv/bin/python - <<'PY'
import json
p="/home/lidgeai/tmp/ima2-h3-pruned/010_object_info.json"
d=json.load(open(p))
for k in ["UNETLoader","CLIPLoader","VAELoader","LoraLoaderModelOnly","MiniMaxH3ImageToVideo","MiniMaxH3SigmaShift","SamplerCustomAdvanced","SaveVideo"]:
    assert k in d, k
def options(node, key):
    return d[node]["input"]["required"][key][0]
assert "minimax_h3_fl2va_pruned_nvfp4.safetensors" in options("UNETLoader", "unet_name")
assert "minimax" in options("CLIPLoader", "type")
assert "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors" in options("CLIPLoader", "clip_name")
vaes=options("VAELoader", "vae_name")
assert "minimax_h3_video_vae_fp16.safetensors" in vaes
assert "minimax_h3_audio_vae_fp32.safetensors" in vaes
assert "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors" in options("LoraLoaderModelOnly", "lora_name")
print("OBJECT_INFO_TARGETS_OK")
PY
REMOTE
```

6. The trap runs on success and every failure path. Success requires exit 0 plus
   `010_post_state.txt` proving Comfy inactive and the user-stopped peer still inactive,
   all six artifact sizes recorded, and the protected unit fields unchanged. 020 will
   keep the peer inactive under its own trap.

## Activation scenarios

| Branch | Trigger | Observable proof | Disposition |
|---|---|---|---|
| already downloaded | final file has exact bytes+sha | no network transfer; receipt says NOOP | continue |
| partial download | `.part` exists | wget resumes and final hash matches | continue |
| wrong hash/size | either differs | no atomic rename; `.part` retained; phase BLOCKED | stop |
| GPU peer changed | cgroup no longer ends in `llama-server-qwen38.service` | no stop issued | UNSAFE |
| Comfy start failure | 8188 absent after 120s | systemd status+journal captured | BLOCKED |
| node/model missing | object_info lacks required entry | exact missing keys captured | BLOCKED |
| cleanup failure | Comfy or user-stopped peer active | final state receipt differs | BLOCKED |

## Verifiers and target coverage

- `stat`/`sha256sum` directly read the new blob.
- `/system_stats` reads the real 8188 runtime.
- `/object_info` directly reads the node/model catalog needed by 020.
- `systemctl show` reads the protected unit and RAM bounds.
- This phase does not claim Native pruned model load; that branch is triggered by 020's
  actual model request.

## Rollback

The trap stops ComfyUI and keeps the user-stopped peer inactive on every exit. Keep the
verified pruned file unless it is corrupt. Because workflow selection has not changed,
the old mixed file remains the rollback target. Final state is asserted, not assumed.
