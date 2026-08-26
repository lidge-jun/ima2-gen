#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd "$(dirname "$0")/../../../.." && pwd -P)"
cd "$repo_root"

npm run typecheck
npm run typecheck:tests
node --experimental-strip-types --test \
  tests/comfy-workflow-store.test.ts tests/comfy-graph-bind.test.ts \
  tests/comfy-routes-contract.test.ts tests/comfy-cli-contract.test.ts \
  tests/comfy-ui-contract.test.ts tests/models-endpoint-contract.test.ts \
  tests/cli-model-resolver.test.ts tests/provider-adapter-v1-contract.test.ts

node --input-type=module - <<'NODE'
const base = "http://127.0.0.1:3334";
const models = await (await fetch(`${base}/api/models`)).json();
const comfy = models.lanes.comfy;
if (Object.keys(comfy.defaults).length !== 0 || comfy.models.image.length !== 0) throw new Error("Comfy image/default drift");
if (comfy.models.video.length !== 1) throw new Error("expected one Comfy video workflow");
const h3 = comfy.models.video[0];
if (h3.id !== "minimax-h3-fl2va-pruned-nvfp4") throw new Error("wrong H3 id");
if (h3.label !== "MiniMax H3 FL2VA pruned NVFP4") throw new Error("wrong H3 label");
if (h3.executable !== false || !h3.lockReason?.includes("not supported")) throw new Error("H3 lock missing");
const direct = await fetch(`${base}/api/generate`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "must not run", provider: "comfy", model: h3.id, n: 1 }),
});
const directBody = await direct.json();
if (direct.status !== 400 || directBody.code !== "COMFY_VIDEO_EXECUTION_LOCKED") throw new Error("direct lock failed");
console.log("LIVE_API_H3_LOCK_OK");
NODE

workflow_json="$(ima2 comfy workflow ls --server http://127.0.0.1:3334 --json)"
WORKFLOW_JSON="$workflow_json" node -e '
const rows=JSON.parse(process.env.WORKFLOW_JSON).workflows;
if(rows.length!==1||rows[0].id!=="minimax-h3-fl2va-pruned-nvfp4"||rows[0].mediaKind!=="video")throw Error("store");
console.log("LIVE_STORE_H3_OK")'

set +e
locked_json="$(ima2 video "must not run" --server http://127.0.0.1:3334 --model comfy/minimax-h3-fl2va-pruned-nvfp4 --json)"
locked_rc=$?
set -e
test "$locked_rc" -eq 2
LOCKED_JSON="$locked_json" node -e '
const x=JSON.parse(process.env.LOCKED_JSON);if(x.code!=="MODEL_LOCKED")throw Error("cli lock");console.log("LIVE_CLI_H3_LOCK_OK")'

file devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/030_ui_h3_locked_final.png \
     devlog/_plan/260824_minimax_h3_pruned_nvfp4/evidence/030_ui_h3_locked_mobile.png
