# NovelAI surface gap matrix

Research only. No implementation diffs.

## Evidence precedence

The official V5 launch dated 2026-08-21 wins over the still-stale model page that
calls V4.5 “latest.” CLIsu is implementation evidence, not a normative API spec.
The prior ima2 live probe is first-party runtime evidence for the request body and
ZIP response but is rechecked where behavior changes.

## Current parity

| Surface | Current ima2 | CLIsu / official signal | Decision |
|---|---|---|---|
| V5 Full/Curated | Registered and live-probed | Officially available now | Keep |
| V4.5 Full/Curated | Registered | CLIsu default is V4.5 Full | Keep compatibility |
| Negative prompt | Composer + `negative_prompt` + v4 caption | CLIsu sends both shapes; official “Undesired Content” | Keep |
| Sampler/noise/steps/scale | UI + server sparse override | CLIsu exposes; official sampling/guidance docs | Keep |
| CFG rescale | UI + server | CLIsu exposes; official Guidance Rescale | Keep |
| Variety+ | UI + coefficient | CLIsu coefficient 0.05766 for V4.5/V5 | Keep |
| Seed | UI + server | CLIsu randomizes; official seed docs | Keep |
| Quality preset | V5 UI/server | Official V5 light/standard/none quality tags | Keep |
| V5 alpha | UI/server and RGBA output | Official V5 native alpha | Keep |
| Auto SMEA | hardcoded `false` | Official Auto SMEA; CLIsu stores `autoSmea` | Gap: implement |
| Decrisper | hardcoded `dynamic_thresholding:false` | Official Decrisper; CLIsu stores `decrisp` | Gap: implement |
| Size choices | three normal presets in UI; arbitrary CLI string | Official UI has tiered sizes; CLIsu has width/height | Keep safe three in UI; document CLI size and cost risk |
| CLI native tuning | absent | CLI provider/model only | Gap: implement all supported request fields |
| Packaged skill | no NAI section | User requested agent-facing workflow | Gap: implement |
| Img2img/inpaint/reference | explicit refusal | CLIsu has img2img and refs; V5 Full has inpainting | Explicitly unsupported until role/mask contracts exist |
| Character Positioning | absent | V5 official, provider-native structured prompts | Explicitly unsupported; prompt-only composition remains available |
| Vibe/Precise Reference | absent | Official V5 launch says still in progress | No false support claim |
| Max Enhance | absent | Official V5 feature, separate operation | Out of current core generation contract |

## Reachability and activation cases

- Auto SMEA: CLI/UI boolean true -> request body `parameters.autoSmea === true`.
- Decrisper: CLI/UI boolean true -> `parameters.dynamic_thresholding === true`.
- V4.5 persisted V5 flags: switch from V5 to V4.5 -> alpha/quality fields absent or
  pinned; no hidden stale state reaches upstream.
- Non-NAI node: global provider NAI but node provider GPT -> no NAI fields.
- NAI node: global provider GPT but node provider NAI -> NAI fields reach node body.
- CLI invalid sampler/range/dual toggle -> exit 2 before request.

## Field chain

For `autoSmea` and `decrisper`:

1. Creation: config env/default + UI checkbox + CLI flag.
2. Serialization: sparse UI `naiPayloadFields` and CLI request helper.
3. Deserialization: `readNaiOptions` boolean allowlist.
4. Consumer: `generateViaNai` writes `parameters.autoSmea` and
   `parameters.dynamic_thresholding`.
5. Persistence: sparse UI overrides; CLI is request-only; config is operator default.

No new enum value is planned. Existing sampler/preset alphabets stay centralized and
contract-tested.
