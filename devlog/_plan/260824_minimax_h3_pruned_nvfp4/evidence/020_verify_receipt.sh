#!/usr/bin/env bash
set -Eeuo pipefail

evidence_dir="$(cd "$(dirname "$0")" && pwd -P)"

EVIDENCE_DIR="$evidence_dir" node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const b = `${process.env.EVIDENCE_DIR}/`;
const submit = JSON.parse(fs.readFileSync(b + "020_submit.json"));
if (!submit.prompt_id || Object.keys(submit.node_errors || {}).length) throw new Error("submit");
const history = JSON.parse(fs.readFileSync(b + "020_history.json"));
const entry = history[submit.prompt_id];
if (entry?.status?.completed !== true || entry?.status?.status_str !== "success") throw new Error("history");
const result = JSON.parse(fs.readFileSync(b + "020_result.json"));
if (result.elapsedSeconds !== 105.138 || result.probe.durationSeconds !== 10.125) throw new Error("result");
if (!result.probe.streams.some((x) => x.type === "video" && x.codec === "h264" && x.width === 864 && x.height === 480)) throw new Error("video");
if (!result.probe.streams.some((x) => x.type === "audio" && x.codec === "aac")) throw new Error("audio");
const mp4 = fs.readFileSync(b + "020_output.mp4");
if (mp4.length !== 695184) throw new Error("bytes");
if (crypto.createHash("sha256").update(mp4).digest("hex") !== "4807b620a6c55ff78d768d3414961b8da6ac5356bdb03d32d47ef251a4fac331") throw new Error("sha");
const rows = fs.readFileSync(b + "020_metrics.csv", "utf8").trim().split("\n").slice(1).map((x) => x.split(",")).filter((x) => x.length === 7);
if (rows.length !== 104 || Math.max(...rows.map((x) => Number(x[2]))) !== 30156) throw new Error("metrics");
console.log("LOCAL_H3_EVIDENCE_OK");
NODE

ssh -o BatchMode=yes lidge 'bash -s' <<'REMOTE'
set -eu
target=/home/lidgeai/ComfyUI/models/diffusion_models/minimax_h3_fl2va_pruned_nvfp4.safetensors
test "$(stat -c %s "$target")" = 12528636800
test "$(sha256sum "$target" | awk '{print $1}')" = 72fa9269ce551fb63ff42a32d9b46d0c122e84b4b2c511e22fa698287b088f70
test "$(systemctl is-active comfyui.service || true)" = inactive
test "$(systemctl --user is-active llama-server-qwen38.service || true)" = inactive
test "$(nvidia-smi --query-gpu=power.limit --format=csv,noheader,nounits | awk 'NR==1 {print $1}')" = 600.00
test -z "$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits | tr -d '[:space:]')"
echo REMOTE_H3_TEARDOWN_OK
REMOTE
