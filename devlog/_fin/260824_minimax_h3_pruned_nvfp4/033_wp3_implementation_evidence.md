---
created: 2026-08-24
tags: [ima2-gen, devlog, implementation, comfyui, catalog, ui, phase3]
---

# 033 — ima2 H3 locked video workflow implementation evidence

## Contract delta

- `ComfyWorkflowRecord.mediaKind`: legacy missing value -> image; valid image/video;
  invalid value dropped/rejected; replace without kind preserves existing.
- H3 graph inference: prompt/width/height from `MiniMaxH3ImageToVideo`, seed from
  `RandomNoise`, output from `SaveVideo`; mixed SaveImage+SaveVideo stays ambiguous.
- `/api/models`: image/video split, no image default when only H3 exists, H3 carries
  `executable:false` and lock reason.
- direct classic image route: `COMFY_VIDEO_EXECUTION_LOCKED` before image adapter.
- provider adapter: video workflow excluded from image auth/model projection.
- CLI resolver: `MODEL_LOCKED`; human table prints exact label and model-status.
- UI: separate Comfy video group, H3 visible but disabled with reason.
- workflow manager: media kind select and 4-locale copy.

## Actual user-store registration

```text
id         minimax-h3-fl2va-pruned-nvfp4
label      MiniMax H3 FL2VA pruned NVFP4
kind       video
origin     http://127.0.0.1:18188
graph      proven 14-node evidence/020_t2v_api.json
bindings   prompt 131.prompt; width/height 131; seed 129; output 92
```

## Live patched server receipts (port 3334)

`/api/models`:

```text
comfy.status        disconnected (origin offline)
defaults            {}
models.image        []
models.video[0].id  minimax-h3-fl2va-pruned-nvfp4
label               MiniMax H3 FL2VA pruned NVFP4
executable          false
lockReason          ComfyUI video execution is not supported yet
```

Direct classic image request:

```text
HTTP 400
code COMFY_VIDEO_EXECUTION_LOCKED
```

CLI video resolution:

```text
code MODEL_LOCKED
reason ComfyUI video execution is not supported yet
```

## Focused gates

```text
npm run build:server       exit 0
npm run build:cli          exit 0
npm run typecheck          exit 0
npm run typecheck:tests    exit 0
targeted node:test         94 pass / 0 fail
```
