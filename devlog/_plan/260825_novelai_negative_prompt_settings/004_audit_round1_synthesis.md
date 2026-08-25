# 004 — Audit round 1: synthesis and plan amendments

Reviewer: read-only `gpt-5.6-sol` (medium), fresh context, no implementation
exposure. Verdict: **FAIL**, 8 blockers.

Every blocker was independently re-verified against the tree before being
accepted. All 8 are accepted — none were rebutted. This document records the
resolution; the decade docs are amended in place.

## B1 — Agent is a fourth direct `generateViaNai` caller (ACCEPTED)

**Claim.** `lib/agentImageVideoGen.ts:130-139` calls `generateViaNai`
directly. The plan's "three pipelines" framing is incomplete and `010`'s
three-source parity test would pass while Agent stayed asymmetric.

**Verified.** `rg -l generateViaNai lib/ bin/` returns five files:
`naiImageAdapter.ts` (definition), `generatePipeline.ts`,
`multimodePipeline.ts`, `nodeGeneration.ts`, and `agentImageVideoGen.ts`.
The Agent call site forwards only model, size, requestId, and signal.

**Resolution — classify, do not extend.** Agent is a *conversational* surface:
it has no settings panel, and its provider options come from
`lib/agentSettings.ts`, not from a browser store this unit touches. Wiring
`readNaiOptions` into it would mean inventing an agent-side option source that
no user can set.

Agent is therefore **explicitly default-only and out of scope**, recorded as
such rather than left as an unstated hole. Two consequences for `010`:

- the parity test asserts `readNaiOptions` in the **three request-driven**
  dispatch sites and asserts Agent is **absent** from that set, with a comment
  naming why. A test that silently ignores a call site is how the next person
  re-creates this defect;
- `002` §D1 is reworded from "all three pipelines" to "all three
  request-driven pipelines", with Agent named.

## B2 — `ui/src/lib/nodeApi.ts` has its own request type (ACCEPTED)

**Claim.** Node payloads use `NodeGenerateRequest`
(`ui/src/lib/nodeApi.ts:7-32`), not `GenerateRequest`. `020` said they
"share the shape".

**Verified.** `NodeGenerateRequest` is an independent type declaring its own
`parentNodeId`, `contextMode`, `elementRevisions` etc. `020`'s claim was
wrong.

**Resolution.** `ui/src/lib/nodeApi.ts` joins the wp2 file map;
`NodeGenerateRequest` gains the same optional NAI fields, and
`storeNodeGenImpl.ts` gains the `naiPayloadFields` spread. The wp2 contract
test asserts all **three** client payload builders (classic, multimode, node)
carry the fields.

## B3 — Client defaults would override env-configured server defaults (ACCEPTED)

**Claim.** `020`'s helper sends every field unconditionally, so
`IMA2_NAI_DEFAULT_STEPS=28` is defeated by a hardcoded client `23`. The plan
claimed server config stays authoritative (`001` §F) while specifying the
opposite.

**Verified.** `lib/naiImageAdapter.ts:122-124` uses `options.steps ?? cfg.defaultSteps` —
a sent value always wins. The contradiction is real.

**Resolution — the server publishes its defaults; the client stops re-sending
them.** `GET /api/capabilities` gains a `defaults.nai` block echoing
`config.naiProvider`, so the panel can display what the operator configured.

> **Refined by `005` §R2-B1 and round 3.** This round said "the client seeds
> `DEFAULT_NAI_OPTIONS` from it on first load", which round 2 showed cannot
> preserve per-field operator ownership past the first edit. The shipped design
> persists sparse overrides and sends **only** them, so an untouched field is
> absent from the request and the server resolves it from config regardless of
> whether capabilities have loaded. `defaults.nai` ends up display-only.
> Canonical: `020`.

Either way the point stands: the env vars become authoritative instead of being
silently overwritten by a compiled-in client constant.

## B4 — Hiding CountPicker and multimode does not disable them (ACCEPTED, most severe)

**Claim.** `n_samples: 1` limits one upstream call; the app-level `count`
still drives `count` separate adapter calls (`lib/generatePipeline.ts:571`),
and hiding the multimode toggle leaves persisted `multimode: true` steering
submission at `storeGenerateEntryImpl.ts:13-22`.

**Verified.** `Promise.allSettled(Array.from({ length: count }, generateOne))`
at `:571` confirms the count fan-out. `generateImpl` reads
`s.uiMode === "classic" && s.multimode` before choosing a path — a hidden
toggle changes nothing.

This was the worst blocker: the plan would have shipped a UI where a user with
`multimode` left on from a GPT session silently routes NAI through the
multimode pipeline with an invisible control.

**Resolution.** Two changes, both in wp3, both behavioral rather than cosmetic:

1. `generateImpl` gains `s.provider !== "nai"` in the `useMultimode`
   condition. Persisted preference is preserved for other lanes; NAI simply
   never takes that path.
2. The count is **forced to 1 in the payload** for NAI
   (`n: s.provider === "nai" ? 1 : s.count`), not merely hidden. Persisted
   `count` is untouched, so switching back to GPT restores the user's choice.

Hiding a control is now the *consequence* of the behavior being fixed, not a
substitute for it. The wp3 contract test asserts both gates in source.

## B5 — i18n instructions were wrong twice (ACCEPTED)

**Claim.** `LEGACY_DOTTED_ROOTS` is at `tests/i18n-dictionary-contract.test.ts:29`
and contains keys that *literally contain dots* — adding `nai` would break the
assertion at `:374-378`. And template keys are auto-handled by
`templateNamespace` (`:296-323`), so they must not be registered in
`DYNAMIC_T_IDENTIFIERS`.

**Verified.** `LEGACY_DOTTED_ROOTS = ["assets.clearAll", "assets.clearConfirm"]`,
and the test asserts dotted root keys are *exactly* that set. Registering
`nai` there would have failed the gate immediately.
`resolveTranslationExpression` routes `ts.isTemplateExpression` through
`templateNamespace` before ever consulting the registry.

**Resolution.** `040` §"Contract test updates" is rewritten: **no**
`LEGACY_DOTTED_ROOTS` edit, **no** `DYNAMIC_T_IDENTIFIERS` edit. The only
requirement is that all four locales carry identical `nai.*` leaves, which
`:367-371` already enforces. The template form
\`nai.ucPreset.${id}\` is handled automatically.

Ironic and instructive: the amendment makes wp4 *smaller*. The original
instruction would have manufactured two failures.

## B6 — Persistence registry shape wrong; provenance claim unbacked (ACCEPTED)

**Claim (a).** The registry is `Record<PersistedKey, { domain, shape, resetSafe }>`
(`ui/src/store/persistenceRegistry.ts:56-83`), not `{ key, scope, description }`.

**Verified.** Confirmed, and worse: constants are exported by **index**
(`PERSISTED_KEYS[14]`, `[15]`…). Appending is safe; inserting would silently
repoint `LOCALE_STORAGE_KEY` at another key.

**Resolution.** `020` specifies: append to the end of `PERSISTED_KEYS`, export
the new constant by its own index, add the registry row. A wp2 test asserts the
pre-existing index constants still resolve to their original key strings.

> **Superseded in part by `005` §R2-B1.** This round's resolution stored a
> full `NaiOptions` object (`shape: "json:NaiOptions"`). Round 2 showed that
> shape cannot express which fields the user touched. The shipped shape is
> `json:NaiOptionOverrides` — a sparse `Partial<NaiOptions>`. The append-only
> and index-stability requirements above still stand; `020` is canonical.

**Claim (b).** `002` §D4 justified composer-state placement partly on history
reproducibility, but nothing records the negative prompt into history metadata
(`lib/generatePipeline.ts:351-352, 684-685`).

**Verified.** History metadata carries `composerPrompt` and
`composerInsertedPrompts` only.

**Resolution — implement it, don't retract it.** Reproducibility is the correct
instinct: an image whose undesired-content prompt is unrecoverable cannot be
regenerated. The negative prompt joins the generation-defaults draft (so it
survives reload like `prompt`) and is recorded in history metadata alongside
`composerPrompt`. Added to `010` (server metadata) and `020` (draft
persistence). Restoring it into the composer from a history item is **out of
scope** and noted as a follow-on — recording is what makes restoration possible
later; conflating the two would grow this unit into the metadata-restore
dialog.

**Claim (c).** `020:141-143` overstated persistence: `saveReasoningEffort`
swallows quota failures and state updates anyway.

**Verified and accepted.** The wording "state is only updated from what
actually landed on disk" is corrected to describe the real semantics —
best-effort write, state updated regardless, quota failure logged once.

## B7 — V5-only presets and unbounded custom size (ACCEPTED, partially)

**Claim (a).** `qualityPresetId` is documented V5-only
(`lib/naiImageAdapter.ts:36-37`) but `003` applies it to all four models.

**Verified.** The comment says "V5-only". Since no live V4.5 call can be made
here to test tolerance, the safe reading is the documented one.

**Resolution.** The quality preset control is gated to V5 alongside transparent
background, and `readNaiOptions`' output is unchanged (the adapter keeps its
`?? "standard"` fallback, which is what V4.5 gets today). Same reset-on-model-
switch treatment as `straightAlpha`.

**Claim (b).** Custom sizes are unbounded: the adapter accepts any `WxH`
(`:78-84`) and `storeHelpers.ts:341-348` excludes NAI from custom-size
normalization.

**Verified.** `getCustomSizeConfirmation` returns `null` for `nai` with a
comment asserting NAI sizes are fixed presets — which is exactly why offering a
free-form Custom option in `003` was contradictory.

**Resolution.** The Custom option is **dropped** from the NAI size group. The
panel offers Portrait / Landscape / Square only. This aligns the UI with the
assumption `storeHelpers.ts` already encodes, and NovelAI charges per
resolution tier, so an arbitrary size is a billing surprise as well as a
correctness one.

## B8 — False verification claims (ACCEPTED)

**Claims.** `050` says three new test files (the roadmap defines two);
`050:74-77` says both structure docs are line-count checked (only
`structure/01-file-function-map.md` is, against `lib/*` and
`bin/commands/*` — `tests/structure-line-counts-contract.test.js:5-17`); and
the three-pipeline assertion misses Agent.

**Verified.** All three correct.

**Resolution.** `050` is corrected: two new test files; only
`structure/01-file-function-map.md` is gate-checked, and
`structure/04-frontend-architecture.md` is updated because it should be
accurate, not because a test demands it; and the parity assertion is the
three-plus-Agent-exclusion form from B1.

## Minor: stale citation

`003:13` cited `lib/naiImageAdapter.ts:219-226` for "always PNG"; the MIME
detection is at `:226-244`. Claim true, range incomplete. Corrected.

## Net effect on the roadmap

| Doc | Change |
|---|---|
| `002` | D1 reworded: three *request-driven* pipelines, Agent named as default-only |
| `003` | Custom size dropped; quality preset gated to V5; PNG citation fixed |
| `010` | `/api/capabilities` `defaults.nai`; history metadata; Agent-exclusion parity test |
| `020` | `nodeApi.ts` added; registry shape corrected; capabilities hydration; draft persistence; persistence wording fixed |
| `030` | multimode bypass + forced `n: 1` as behavior, not just hiding |
| `040` | Both contract-test edits removed — the mechanism already handles it |
| `050` | Test count, structure-doc scope, and parity assertion corrected |

The audit made the plan smaller in two places (B5, B7b) and more honest in the
rest. That is the round working as intended.
