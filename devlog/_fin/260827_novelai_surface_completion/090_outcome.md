# 090 — NovelAI surface completion outcome

Terminal outcome candidate: DONE, pending final C receipt and remote CI/CodeQL proof.

## Delivered surfaces

### Server/provider contract

- Auto SMEA and Decrisper are config defaults, capability defaults, request-normalized
  sparse booleans, and adapter wire fields.
- Explicit false overrides true operator defaults through `??` semantics.
- Existing four-model V5/V4.5, auth, ZIP-to-PNG, error, alpha, negative prompt,
  sampler/schedule, guidance/CFG, seed, presets and Variety+ contracts remain intact.

Evidence: `ff16f0cf`, `14990601`; RED 5 -> GREEN source 50 + built runtime 2;
full suite 2617 pass / 0 fail / 2 skip at wp1 C.

### Browser UI and node payload

- Auto SMEA and Decrisper render through existing accessible checkbox/help grammar.
- Four locales are complete.
- V4.5 retains both controls while V5-only Alpha/Quality stay hidden.
- Effective node provider/model wins over global state; non-NAI lanes receive no NAI
  fields.

Evidence: `de6069dc`; RED 1 -> GREEN 28; desktop/V4.5/500px screenshots and DOM
interaction in `023_wp2_render_evidence.md`; full suite 2618 pass / 0 fail / 2 skip.

### CLI and generated runtime

- `gen`, `multimode`, and `node generate` share 17 NAI flags and one typed parser.
- Exact registry model IDs, explicit/persisted target policy, V5 gates, enum/range/
  boolean validation, JSON/text exit 2 and pre-network failure are enforced.
- Built recorder captures identical 13-field payloads from all three commands without a
  NovelAI token.

Evidence: `1adf34eb`, `cd9922f1`; focused built/helper/docs suite 20 pass; full suite
2630 pass / 0 fail / 2 skip.

### Packaged and installed skill plus SoT

- The core skill names models, token handling, native controls, CLI examples, V5
  prompting, official sources, cost guards and explicit ima2 boundaries.
- README, API, CLI and structure docs match runtime; stale `pst-` claims removed.
- Core-only installed skill is byte-identical; front/uiux were untouched.

Evidence: `d6283c93`, `5d6d3e15`; docs 24/24, projection 2/2,
`quick_validate` pass; full suite 2633 pass / 0 fail / 2 skip.

## Deliberate unsupported boundary

NovelAI the product supports more than the ima2 lane. This unit does not fake generic
support for img2img/reference, masks/inpainting, Character Positioning, Director
Reference, Vibe Transfer, or Max Enhance. The current provider contract cannot encode
their provider-native roles safely, and current official/public request detail is not
sufficient for a correct implementation. References/edit/masks stay fail-closed through
`NAI_REF_UNSUPPORTED`, `NAI_EDIT_UNSUPPORTED`, and `NAI_MASK_UNSUPPORTED`.

## Dead hypotheses and repairs

- “Existing NAI tests mean the UI is complete” died: a new RED panel/i18n assertion
  failed while the old 27 tests passed.
- “TypeScript tests prove runtime” died: generated JS required its own import/fetch
  recorder test.
- “Any nai-diffusion-* prefix is a NAI target” died: target classification now derives
  four exact registry IDs.
- “A reviewer green report is enough” died twice: independent current-HEAD full tests
  caught stale structure line counts.
- Native browser/Chrome/Computer Use were unavailable due a stale plugin runtime/native
  pipe; the documented ladder reached `agbrowse`, which completed inspect-act-reinspect,
  screenshot readback, console/network checks, and server teardown.

## Final C and delivery evidence pending

- Archive commit SHA.
- Session-bound final receipt whose `sourceIdentity.commitSha` equals archive HEAD.
- Fresh final reviewer verdict for that exact archive HEAD.
- Non-force `origin/dev` push and `HEAD == origin/dev` proof.
- Exact-head `CI` and `CodeQL` run IDs, URLs, and success conclusions.

These external/delivery facts are recorded in the goalplan and orchestration ledger so
the reviewed archive commit remains immutable.
