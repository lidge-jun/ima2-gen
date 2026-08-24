#!/usr/bin/env bash
set -Eeuo pipefail

task_tmp=/home/lidgeai/tmp/ima2-h3-pruned
peer=llama-server-qwen38.service
graph="$task_tmp/020_t2v_api.json"
runner="$task_tmp/020_run_t2v.py"
prompt_file="$task_tmp/020_prompt_id.txt"
metrics_pid=""
original_power="$(nvidia-smi --query-gpu=power.limit --format=csv,noheader,nounits | awk 'NR==1 {print $1}')"

record_post() {
  {
    date -Ins
    systemctl show comfyui.service -p ActiveState -p SubState -p Result -p MemoryCurrent -p MemoryPeak
    systemctl --user show "$peer" -p ActiveState -p SubState
    nvidia-smi --query-gpu=power.limit,memory.used,memory.free --format=csv,noheader,nounits
    nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits
  } > "$task_tmp/020_post_state.txt" 2>&1 || return 1
}

cleanup() {
  local rc=0 prompt_id=""
  if [[ -s "$prompt_file" ]]; then prompt_id="$(tr -d '[:space:]' < "$prompt_file")"; fi
  if [[ -n "$prompt_id" ]]; then
    curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"delete\":[\"$prompt_id\"]}" http://127.0.0.1:8188/queue >/dev/null 2>&1 || true
    curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"prompt_id\":\"$prompt_id\"}" http://127.0.0.1:8188/interrupt >/dev/null 2>&1 || true
  fi
  if [[ -n "$metrics_pid" ]]; then kill "$metrics_pid" >/dev/null 2>&1 || true; wait "$metrics_pid" 2>/dev/null || true; fi
  sudo systemctl stop comfyui.service || rc=1
  sudo nvidia-smi -pl "$original_power" >/dev/null || rc=1
  systemctl --user stop "$peer" || rc=1
  if systemctl is-active --quiet comfyui.service; then rc=1; fi
  if systemctl --user is-active --quiet "$peer"; then rc=1; fi
  current_power="$(nvidia-smi --query-gpu=power.limit --format=csv,noheader,nounits | awk 'NR==1 {print $1}')"
  if [[ "$current_power" != "$original_power" ]]; then rc=1; fi
  record_post || rc=1
  return "$rc"
}

on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if ! cleanup; then
    echo "cleanup or final-state assertion failed" >> "$task_tmp/020_cleanup_failure.txt"
    rc=72
  fi
  exit "$rc"
}
trap on_exit EXIT INT TERM

test "$original_power" = "600.00"
test "$(systemctl --user is-active "$peer" || true)" = "inactive"
test -z "$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits | tr -d '[:space:]')"
rm -f "$prompt_file" "$task_tmp/020_cleanup_failure.txt"

start_iso="$(date -Ins)"
log=/home/lidgeai/logs/comfyui.log
log_size_before=0
if [[ -f "$log" ]]; then log_size_before="$(stat -c %s "$log")"; fi
printf '%s\n' "$start_iso" > "$task_tmp/020_started_at.txt"
sudo nvidia-smi -pl 500 >/dev/null
sudo systemctl start comfyui.service

ready=0
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8188/system_stats > "$task_tmp/020_system_stats.json"; then ready=1; break; fi
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  systemctl status comfyui.service --no-pager > "$task_tmp/020_start_failure.txt" 2>&1 || true
  journalctl -u comfyui.service -n 200 --no-pager >> "$task_tmp/020_start_failure.txt" 2>&1 || true
  exit 71
fi

(
  echo "timestamp,gpu_memory_used_mib,gpu_memory_free_mib,gpu_util_pct,power_w,host_mem_available_kib"
  while true; do
    gpu="$(nvidia-smi --query-gpu=memory.used,memory.free,utilization.gpu,power.draw --format=csv,noheader,nounits | head -1 | tr -d ' ')"
    mem="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
    printf '%s,%s,%s\n' "$(date -Ins)" "$gpu" "$mem"
    sleep 1
  done
) > "$task_tmp/020_metrics.csv" &
metrics_pid=$!

/home/lidgeai/ComfyUI/venv/bin/python "$runner" --graph "$graph" --output-dir "$task_tmp" --timeout 6600

journalctl -u comfyui.service --since "$start_iso" --no-pager > "$task_tmp/020_journal.log" 2>&1 || true
if [[ -f "$log" ]]; then
  log_size_after="$(stat -c %s "$log")"
  if [[ "$log_size_after" -ge "$log_size_before" ]]; then
    tail -c "+$((log_size_before + 1))" "$log" > "$task_tmp/020_comfy_tail.log"
  else
    cp "$log" "$task_tmp/020_comfy_tail.log"
  fi
fi
cat "$task_tmp/020_journal.log" "$task_tmp/020_comfy_tail.log" 2>/dev/null > "$task_tmp/020_combined.log" || true
grep -E 'Native ops:.*nvfp4' "$task_tmp/020_combined.log" >/dev/null
if grep -E 'Emulated ops:.*nvfp4' "$task_tmp/020_combined.log" >/dev/null; then exit 73; fi

output="$(/home/lidgeai/ComfyUI/venv/bin/python -c 'import json; print(json.load(open("/home/lidgeai/tmp/ima2-h3-pruned/020_result.json"))["output"])')"
file "$output" | tee "$task_tmp/020_file.txt"
xxd -l 16 -p "$output" | tee "$task_tmp/020_magic.txt"
ffprobe -v error -show_entries format=duration,size -show_streams -of json "$output" > "$task_tmp/020_ffprobe.json"
