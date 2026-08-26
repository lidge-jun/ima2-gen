---
created: 2026-08-24
tags: [ima2-gen, devlog, stale-check, comfyui, catalog, ui, phase3]
---

# 031 — wp3 P stale-check

Current tree findings:

- store record has no media kind; read path is a boolean filter that casts raw JSON.
- graph inference sees only CLIPTextEncode/EmptyLatentImage/KSampler/LoadImage/SaveImage.
  The proven H3 graph therefore has no prompt/output candidates.
- `/api/models` puts every Comfy workflow in image and leaves video empty.
- CLI catalog model DTO has no model-level executable/lock fields; resolver would accept
  a locked video row whenever the lane is ready.
- UI Comfy catalog helper returns only image rows. Selector has one Comfy image group.
- workflow manager has no kind field and H3 inspection cannot satisfy `canSubmit`.
- human `ima2 models` table omits label, so exact H3 display name is invisible there.

No-code/config-only was rechecked and rejected: registering H3 with only `--label` would
put SaveVideo under the image group and dispatch it through `comfyImageAdapter`, which
rejects the MP4 bytes. The minimal honest patch is media-kind classification plus a
model-level execution lock consumed by API, CLI resolver, human table, and UI.

Baseline verifier from the current head exists and reads every planned owner:

```bash
node --experimental-strip-types --test \
  tests/comfy-workflow-store.test.ts tests/comfy-graph-bind.test.ts \
  tests/comfy-routes-contract.test.ts tests/comfy-cli-contract.test.ts \
  tests/comfy-ui-contract.test.ts tests/models-endpoint-contract.test.ts \
  tests/cli-model-resolver.test.ts
```
