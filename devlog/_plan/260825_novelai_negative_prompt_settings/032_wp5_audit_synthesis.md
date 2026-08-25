# 032 — wp5 final audit synthesis

Fresh read-only `gpt-5.6-sol` reviewer, given the implementation diff
(`16de4118..HEAD`) rather than the plan. Verdict: **FAIL**, one blocking issue
plus three medium findings. All accepted.

## What the audit confirmed

Worth recording, because these are the unit's load-bearing claims:

- classic and multimode non-NAI paths retain prior behavior; `/api/capabilities`
  only gains an additive member;
- every UI-settable option has a server reader and an adapter consumer, and
  every server-read option has a UI route;
- the adapter's V5 guard is sufficient across REST, classic, multimode, node,
  persisted state, and Agent;
- sparse overrides behave: untouched fields stay absent, explicit values
  persist, reset clears only overrides, capability hydration is display-only;
- no unreachable production code.

## B1 (blocking) — node mode gated on the global lane

**Claim.** `storeNodeGenImpl.ts:137` deliberately prefers the node's own
`provider`/`model` over global state (higgsfield 120), but the payload called
`naiPayloadFields(s)`, which read `s.provider` and `s.imageModel`. Three real
failures:

| Situation | Consequence |
|---|---|
| Global GPT + NAI node | the node's options and negative prompt never ride |
| Global NAI + non-NAI node | NAI fields leak into another lane's request |
| Global V5 + V4.5 node | V5 fields enter the payload; the adapter still neutralizes them |

**Verified.** `nodeProvider` and `nodeModel` were already computed at
`:139` and `:150`, and the payload ignored both.

The second row is the one that stings: this unit's headline safety claim is
that other lanes are byte-identical, and node mode falsified it.

**Resolution.** `naiPayloadFields` takes an optional effective lane:

```ts
naiPayloadFields(s, lane: { provider?, imageModel? } = {})
```

Classic and multimode fall through to global state; node passes
`{ provider: nodeProvider, imageModel: nodeModel }`.

The reviewer's sharper point was that the tests could not have caught this —
they asserted the *text* `...naiPayloadFields(s)` was present. Source-shape
assertions verify that a call exists, not that it is correct. So the helper
moved to `ui/src/lib/naiPayload.ts` (importable without the UI bundle) and the
regex cases became **behavioral** ones, including all three rows above.

## B2 — an out-of-range seed vanished silently

Typing a seed above 2^32-1 displayed for the session, was omitted by the
server, and disappeared on reload. Now clamped at the input to
`NAI_MAX_SEED`, so what is displayed is what will be used.

## B3 — promised details missing from wp3

The reviewer diffed `003`/`030` against the implementation:

- **Model group absent.** `003` §Group 1 specified it; the panel began at
  Size. Added, reusing `NAI_IMAGE_MODEL_OPTIONS` rather than a hand-written
  list.
- **Model-change reset absent.** `030` note 2 specified it as the coherence
  half of the V5 story. Added to the model `onChange`.
- **Seed dice button absent.** Not restored: the placeholder already reads
  "Random" and an empty field is the random case. Recorded here as a
  deliberate drop rather than an oversight.

Adding the model group immediately failed `i18n-dictionary-contract` on a
missing `nai.panel.modelTitle` — the gate doing exactly its job.

## B4 — quality limits

`NaiControlsPanel` is one ~200-line component. It is JSX for ten controls with
no branching beyond two V5 gates, so splitting it would trade one readable file
for three indirections; the 50-line convention targets logic density. Recorded
as a knowing exception.

`storeNodeGenImpl.ts` crossed 500 lines and came back under when the helper
moved out — the extraction paid for itself twice.

## Verification after the fixes

| Command | Result |
|---|---|
| `npm run typecheck` / `typecheck:tests` | 0 |
| `npm run test:inventory` | 0 |
| `node scripts/generate-provider-types.mjs --check` | 0 |
| `cd ui && npm run build` | 0 |
| `npm test` | 2616 tests, 2614 pass, **0 fail**, 2 skip |

Re-verified in the browser after reload: the Model combobox is present, and the
negative prompt survived the reload — persistence proven live rather than only
in a test.

