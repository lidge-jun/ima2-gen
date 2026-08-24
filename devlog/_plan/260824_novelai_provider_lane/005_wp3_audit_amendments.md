# 005 — wp3 A-phase audit amendments

Independent review of the wp3 routing plan against HEAD `279ac2a3` returned
**FAIL** with two High blockers. Both reproduced against the real code before
acceptance. Nothing rebutted.

## W3-H1 (ACCEPTED) — references would be silently dropped

`030` §6 said the edit route should dispatch "through `generateViaNai` with
the reference image attached". **`generateViaNai` has no `references`
parameter** — it is text-to-image only (`NaiGenerateOptions`,
`lib/naiImageAdapter.ts`). Copying the MiniMax branch literally would either
fail typecheck on the excess property or, behind a cast, accept the user's
image and generate something unrelated from the prompt alone. The user would
believe they edited an image.

The registry compounds it: `referenceLimits {image:1, edit:1}` and
`supports: EDIT` advertise a capability the adapter does not have. That was a
wp1 leftover — `EDIT` was chosen to satisfy the mask oracle, not because
img2img exists.

**Amendment.** wp3 does not implement img2img (`000` already scoped it as a
follow-on). Instead the lane refuses reference input loudly:

- Registry: `referenceLimits` becomes `{}` and `supports` becomes
  `{edit:false, mask:false, streaming:false}`, so the manifest stops claiming
  edit support. The mask-rejection guard stays (a mask is still invalid).
- `generatePipeline`: any reference for `nai` returns `400 NAI_REF_UNSUPPORTED`.
- `routes/edit.ts`: `nai` returns `400 NAI_EDIT_UNSUPPORTED` rather than
  dispatching.
- `nodeGeneration`: a parent image for `nai` returns the same refusal.
- `generateViaNai` gains **no** `references` option this phase.

A loud 400 is the honest behavior. Silently discarding the input is the one
outcome that must not ship.

## W3-H2 (ACCEPTED) — the plan still carried the dead account host

`030` was written before the live probe and still specified
`CANARY_ENDPOINTS.nai = "https://api.novelai.net/user/data"`. That host now
400s every `/user/*` call (`004`). The shipped code already uses
`image.novelai.net`, so the plan and the code disagreed, and
`provider-canary-parity` compares the canary table against `routes/keys.ts` —
following `030` would either break parity or push the dead host back into
`keys.ts`.

**Amendment:** `030` now says `https://image.novelai.net/user/data`, matching
the registry, `routes/keys.ts`, and the probe.

## W3-M1 (ACCEPTED) — doctor lane count already red

`tests/doctor-provider-contract.test.ts:25` asserts `lanes.length === 9`. The
list itself is registry-derived so it stays honest, but the hardcoded count
went red the moment wp1 added the tenth lane. Confirmed failing at HEAD.
`040` had mapped it; that is too late, since it has been red since wp1.
**Amendment:** fix in wp3, and treat it as a reminder that a "predicted" test
failure still has to be fixed in the phase that causes it.

## W3-M2 (ACCEPTED) — stale line numbers in 030 §6

§6 prose still cited `L273` for the MiniMax dispatch (now `276`) and
`L351/L354` for the edit MIME lines (now `354/357`). The normative table was
already corrected; the prose was not. **Amendment:** prose defers to the table.

## Confirmed by the reviewer, no change needed

Alpha survives to disk when the table is followed:
`resultFormat` → `embedImageMetadataBestEffort` →
`sharp(buffer).toFormat("png")` preserves RGBA, and `.thumb.jpg` is a separate
display artifact, not the asset.

Independently proven by the main agent against the real NAI output:

| Path | Transparent pixels |
|------|--------------------|
| source from NovelAI | 42.1% |
| persisted via `embedImageMetadata(…, "png")` | **42.1%** |
| persisted via `embedImageMetadata(…, "jpeg")` | **0.0%** |

That is the entire alpha thesis reduced to one measurement: the format argument
decides whether the feature exists.

## Node-mode trap restated

`nodeGeneration` initializes `resultFormat` to jpeg at `261` for hosted lanes
and only overwrites it inside the `if` at `373`. Adding `nai` to the dispatch
without adding it to that `if` leaves the jpeg initializer in force. Since
wp3 refuses node parent images for `nai` anyway, the safest wiring is: no
`nai` at `261`, `nai` present at `373`.

## Disposition

Two High + two Medium folded. Re-audit follows with the same reviewer.
