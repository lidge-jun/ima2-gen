# 003 — A-phase audit amendments (round 1)

Independent adversarial audit of the 000-050 roadmap returned **VERDICT: FAIL**
with five High blockers. Every blocker was re-verified by the main agent against
the real code before being accepted — none are taken on the reviewer's word.
This document records the disposition; the amendments are normative and
override the original text where they conflict.

## B1 (High, ACCEPTED) — `server.ts` boot loader was missing

Verified: `server.ts:125` `loadMinimaxApiKey()`, called at `:380`, assigning
`minimaxApiKey`/`minimaxApiKeySource`/`hasMinimaxApiKey` at `:420-422`.

`010`'s file map omitted `server.ts` entirely. Consequence if unamended: a
`NOVELAI_API_KEY` env var or a `naiApiKey` in `config.json` would never reach
`ctx`; the lane would stay key-missing forever and only a live
`PUT /api/keys/nai` could authenticate it. That is a real, user-visible dead
path.

**Amendment to `010`:** add `server.ts` to the wp1 file map with three edits —
a `loadNaiApiKey()` mirroring `loadMinimaxApiKey` (env `NOVELAI_API_KEY` first,
then `config.json` `naiApiKey`), a `const loadedNaiKey = await loadNaiApiKey();`
beside `:380`, and the three `ctx` assignments beside `:420`.

## B2 (High, ACCEPTED) — `"needs-key"` is not a real status

Verified: `routes/models.ts:35`
`type ModelLaneStatus = "ready" | "locked" | "disconnected" | "key-missing"`,
and `minimaxLane` uses `status: "key-missing"`.

`030` and `050` both invented `"needs-key"`. The routing test and the c5 curl
assertion would have failed against a correct implementation — a plan-authored
false negative.

**Amendment:** every occurrence of `needs-key` in `030` and `050` becomes
`key-missing`. Goalplan criterion c5's expected evidence is updated to match.

## B3 (High, ACCEPTED) — hardcoded MiniMax oracles omitted from the change maps

Verified, each one read directly:

| Oracle | Site | Required change |
|--------|------|-----------------|
| `tests/provider-registry-contract.test.ts:17` | `assert.deepEqual(ids, [...9 ids])` | append `"nai"` in registry order |
| `tests/provider-registry-parity.test.ts:12` | `CORE_IDS` literal | append `"nai"` |
| `tests/provider-registry-parity.test.ts:~90` | `maskRejectedLanes` deepEqual | add `"nai"` (sorted) once `030` adds the mask rejection |
| `tests/provider-registry-parity.test.ts:~14` | `CLI_IMAGE_MODELS` | append the four NAI model ids |
| `tests/models-endpoint-contract.test.ts:122` | `Object.keys(body.lanes)` deepEqual | insert `"nai"` after `"minimax"`, before `"comfy"` |
| `tests/error-class-coverage.test.ts:34` | `PROVIDER_CODE_PATTERN` | add `NAI` to the alternation |
| `tests/provider-canary-parity.test.ts:~30` | `laneForVendor` | add `nai: "nai"` |
| `tests/i18n-dictionary-contract.test.ts:~81` | model label key list | add the four `settings.imageModel.nai*` keys |

`error-class-coverage` matters beyond a red test: its regex is what scans for
provider codes, so an unlisted `NAI` prefix means every `NAI_*` code is
invisible to the map-coverage and dead-code checks. The lane would ship with an
unverified error surface.

**Amendment:** `010` takes the registry/parity oracles, `030` takes
models-endpoint + error-class + canary, `040` takes i18n. Ordering matters:
the mask-list and lane-key oracles must be updated in the SAME commit as the
code change that causes them, or the tree is red between commits.

## B4 (High, ACCEPTED) — the alpha instruction was wrong for node mode

This is the blocker worth the whole audit. Verified:

- `lib/nodeGeneration.ts:261` — `let resultFormat = ...hosted set... ? "jpeg" : format`.
  This is a **JPEG-forcing** list.
- `lib/nodeGeneration.ts:373` — a *separate*, narrower conditional that
  overwrites `resultFormat` from the detected MIME.
- `lib/multimodePipeline.ts:271` — `mmFormat`, likewise **JPEG-forcing**.

`030` described "node L261/373" and "multimode L291/294" as if each pair were
one MIME-reporting conditional. An implementer following it literally would add
`nai` to `nodeGeneration:261` and `multimodePipeline:271`, forcing JPEG and
silently destroying V5 alpha — while every test still passed, because nothing
asserts on transparency.

**Amendment to `030`, normative per-site table:**

| File | Line | Group | Add `nai`? |
|------|------|-------|------------|
| `lib/generatePipeline.ts` | 383 | JPEG-forcing | **NO** |
| `lib/generatePipeline.ts` | 573 | MIME-reporting | YES |
| `lib/multimodePipeline.ts` | 271 | JPEG-forcing (`mmFormat`) | **NO** |
| `lib/multimodePipeline.ts` | 291, 294 | MIME-reporting | YES |
| `lib/nodeGeneration.ts` | 261 | JPEG-forcing initializer | **NO** |
| `lib/nodeGeneration.ts` | 373 | MIME overwrite | YES |
| `lib/agentImageVideoGen.ts` | 155 | MIME-from-bytes | YES |
| `routes/edit.ts` | 351, 354 | MIME-reporting | YES |

The `030` "alpha guard" test is also insufficient as specified: it described
one set pair, but there are **five** sites. It becomes a source-regex test
asserting the full table above — `nai` absent from all four JPEG-forcing
conditionals and present in all five MIME-reporting ones. `provider-registry-parity`
already reads route source with regexes, so this pattern is established.

## B5 (High, ACCEPTED with correction) — the baseline claim was wrong

The reviewer reports `npm test` = 2502 pass / **2** fail, both in
`tests/cli-models-command-contract.test.ts` (a header regex and a JSON shape
that now includes `executable`), and states `structure-line-counts` passes.

My P-phase attestation said "3 fail including structure-line-counts". Both are
right about different moments: structure-line-counts WAS failing when I measured
the baseline, and I fixed it mechanically in `13bc101c` before the reviewer ran.
Re-verified after that commit: `node --test tests/structure-line-counts-contract.test.js`
is green. **The accurate current statement is 2 pre-existing failures, both
`cli-models-command-contract`, neither caused by this unit.**

This matters because `000`/`050` demanded `npm test` exit 0 as a gate, which
the repo cannot satisfy at HEAD regardless of NAI work.

**Amendment to `000` and `050`:** the c8 gate is redefined honestly as
*"no NEW failures versus the recorded pre-existing set, and every NAI test
passing"*. The two `cli-models-command-contract` failures are named explicitly
as the carve-out with their cause. Fixing them is a separate concern and is not
silently folded into this unit.

## Medium/Low findings

**M1 `stream: "msgpack"` (ACCEPTED as risk, not as change).** The V5 reference
client sends `parameters.stream = "msgpack"`. `020` omits it and assumes a ZIP
body. This cannot be settled without a real credentialed 200 response, which
this unit is forbidden from making. **Amendment:** `020` adds a content-negotiation
guard — if the response is not a ZIP, the adapter raises
`NAI_RESPONSE_NOT_ZIP` naming the received Content-Type, instead of failing
opaquely. The open question is recorded in `050`'s handoff so the user's first
real generation resolves it immediately and legibly.

**M2 test inventory + i18n files (ACCEPTED).** `npm run test:inventory` runs
`scripts/classify-tests.mjs --check`, which regenerates
`docs/migration/runtime-test-inventory.md`. New `tests/nai-*.test.ts` files
make it stale. **Amendment to `050`:** run `node scripts/classify-tests.mjs`
(no `--check`) after adding tests and commit the regenerated inventory.

**L1 `configKeys.ts` (ACCEPTED).** The reviewer is right that `minimaxApiKey`
is not registered there. **Amendment to `010`:** drop the `configKeys.ts` edit;
existing redaction already matches `/apikey/i`. Adding an entry MiniMax never
had would be inventing a convention.

**L2 `003` reference (ACCEPTED).** `000` said "001-003" when only 001-002
existed. This document is now `003`, so the reference resolves.

**L3 V4 curated id (ACCEPTED).** `001` claimed both clients agree on
`nai-diffusion-4-curated-preview`; they do not (novelai-sdk uses
`nai-diffusion-4-curated`). V4 is not in the ship list, so this is
documentation accuracy only.

**L4 doctor branch (ACCEPTED).** `040`'s `keyVocabulary === "nai"` special case
is unnecessary — the generic `credential.validateUrl` path already covers a
plain bearer provider. MiniMax needs a branch only for its region rewrite.
**Amendment:** `040` verifies the generic path renders a NAI row and adds a
branch only if it does not.

**REBUTTED — none.** Every finding was reproduced against the real code.

## Residual risk after amendment

`stream: "msgpack"` (M1) is the one item that cannot be closed without a
credentialed call. It is contained by an explicit error code rather than left
as an assumption, and named in the handoff.

## Disposition

All five High blockers folded into the roadmap as concrete amendments; five
Medium/Low likewise. Re-audit follows with the same reviewer per AUDIT-LOOP-01.
