# 090 — Outcome

**Terminal outcome: DONE.**

## What shipped

Two user-visible things, and one that was invisible and load-bearing.

**An undesired-content field.** NovelAI's negative prompt now has an input, in
both composers, gated to the lane. It persists with the composer draft and is
recorded in history metadata, so a generation stays reproducible.

**A NovelAI-native settings panel.** The right panel used to render six
controls the adapter does not read — quality, format, moderation, a batch count
pinned to one upstream, a cost estimate priced for OpenAI, and GPT
compatibility copy. Those are replaced by model, size tier, sampler, noise
schedule, steps, guidance, CFG rescale, undesired and quality presets,
Variety+, transparent background, and seed.

**A lane that was wired half-way.** `/api/generate` had accepted seven NovelAI
parameters for some time and no client code sent one. Multimode and node
forwarded none of them. Three dispatch sites now share one normalizer, and the
browser finally sends what the server was already reading.

## Criteria

| id | Criterion | Evidence |
|----|-----------|----------|
| c1 | CLIsu↔ima2 gap table with citations | `001`; 18 citation groups independently confirmed in audit round 1 |
| c2 | Diff-level decade doc per phase | `010`/`020`/`030`/`040`/`050` |
| c3 | Server reflects every UI parameter | `tests/nai-options-contract.test.ts`, adapter cases |
| c4 | Options persist and ride in the payload | `tests/nai-client-options-contract.test.ts` (18 cases); reload verified live |
| c5 | Negative prompt visible and reaching the server | `evidence/nai-panel-and-negative.png`; live 832×1216 generation |
| c6 | Panel is nai-specific; four locales | `evidence/nai-v45-hides-v5-controls.png`; i18n contract 6 pass |
| c7 | No behavior change on other lanes | reviewer traced every path; the node-lane leak was found and fixed |
| c8 | Gate sweep green | typecheck, typecheck:tests, inventory, provider-types, ui build — all 0 |
| c9 | No new test failures | 2616 tests, **0 fail** (baseline 2580 / 0 fail) |
| c10 | Reviewer audit passes | wp0 round 6 PASS; wp5 final PASS, zero blockers |

## Commits

| SHA | Phase |
|---|---|
| `6768e4d7` | wp0 roadmap (13 docs) |
| `16de4118` | wp0 receipt |
| `7ef68258` | wp1 server option contract |
| `75597722` | wp2 client state and payload |
| `e76455d7` | wp2 stale check |
| `c8d64769` | wp3/wp4 UI and i18n |
| `a1146cab` | wp5 node-lane fix, seed clamp, Model group |
| `aacaaf41` | wp5 line-budget correction |

Local only. Nothing pushed, tagged, or released.

## Live proof

The environment had a NovelAI token, so c5 was proven against the real service
rather than the fixture `050` planned for:

```
POST /api/generate  provider nai, model nai-diffusion-5-full, 832x1216,
  negativePrompt "lowres, watermark, bad anatomy", sampler k_dpmpp_2m_sde,
  steps 28, varietyPlus true, cfgRescale 0.4
→ 200 in 5.7s, a real 832×1216 PNG, metadata Software: NovelAI
```

## What the reviews caught

Eight adversarial rounds across the unit; 24 blockers, all accepted, none
rebutted. The ones that changed the product rather than the prose:

| Finding | Would have shipped as |
|---|---|
| Hiding CountPicker and the multimode toggle without changing behavior | a persisted `count: 4` firing four NovelAI generations with no visible control |
| A full persisted options object | operator config silently frozen at the user's first edit |
| `setNegativePrompt` specified without its persistence write | a negative prompt that never saved |
| Zustand 5 selector without `useShallow` | render loops on the new panel |
| Node payload gated on the global lane | NAI fields leaking into another lane's request — falsifying the unit's own safety claim |

Every one was invisible to the type checker and to a passing test suite. The
node-lane leak is the sharpest: the tests asserted the *text*
`...naiPayloadFields(s)` appeared in the source, which proves a call exists,
not that it is correct. The helper was extracted specifically so the assertions
could become behavioral.

## Two recurring mistakes, recorded

1. **A guard in one place for state with several entrances.** Hiding a control
   while its behavior stays live; resetting a flag in one callback when three
   other paths set the same state; gating on global state where a per-node lane
   exists. The fix each time was to move the guard to a boundary.
2. **Recording the consequence I expected instead of the value I measured.**
   An amendment added without removing what it replaced (round 3); a line count
   asserted rather than counted (final round).

Both are worth carrying forward. Neither is specific to NovelAI.

## Deliberately not done

- Agent (`lib/agentImageVideoGen.ts`) stays default-only: no per-request option
  source exists for it. The contract test asserts its exclusion with the reason
  attached, so wiring it up is a decision rather than an accident.
- Restoring the negative prompt from a history item — recording is what makes
  restoration possible; the dialog is its own unit.
- Vibe transfer, character reference, img2img/inpaint, Anlas cost, V4/V3/V2
  model families.
- The seed dice button: the field's placeholder reads "Random" and an empty
  field is the random case.

