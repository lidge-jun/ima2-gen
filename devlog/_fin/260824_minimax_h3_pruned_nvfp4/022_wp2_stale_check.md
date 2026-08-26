---
created: 2026-08-24
tags: [ima2-gen, devlog, stale-check, comfyui, minimax-h3, phase2]
---

# 022 — wp2 P stale-check: official local-weight template

Current lidge workflow package contains:

```text
video_minimax_h3_t2v.json   local-weight UI workflow with one subgraph
api_minimax_h3_t2v.json     hosted MinimaxHailuo03TextToVideoNode workflow
```

The `api_*` file is a hosted MiniMax API node and is not used. The local-weight
subgraph has 21 inner nodes. For vanilla mode the switches collapse to this 14-node
flat graph:

```text
UNETLoader(pruned NVFP4) -> BasicScheduler(simple, 10) + BasicGuider
CLIPLoader(Qwen3VL, minimax) -> MiniMaxH3ImageToVideo(864,480,243)
RandomNoise(42) + KSamplerSelect(res_multistep)
VAELoader(video) + VAELoader(audio)
SamplerCustomAdvanced -> VAEDecode(video) + VAEDecodeAudio(audio)
CreateVideo(fps=24, bit_depth=8) -> SaveVideo(auto, auto)
```

Removed from the old plan:

- `LoraLoaderModelOnly`: vanilla proof has no Turbo LoRA.
- `ComfySwitchNode` and Primitive nodes: resolved to constants.
- `ComfyMathExpression`: length is fixed at valid `17k+5` value 243.
- `MiniMaxH3SigmaShift`: absent from the current official local-weight template.

Live `object_info` confirmed exact required inputs and outputs for all 14 retained
nodes, `res_multistep`, `simple`, target model and auxiliaries.

Copernicus found the old 020 teardown prose-only. The amended plan requires one shell
wrapper to own power, service, metrics, cancel and postcondition checks on every exit.
