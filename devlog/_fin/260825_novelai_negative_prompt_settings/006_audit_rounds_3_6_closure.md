# 006 — Audit rounds 3-6: closure

Same read-only `gpt-5.6-sol` reviewer throughout (AUDIT-LOOP-01: a FAIL
re-enters the loop with the same reviewer). Six rounds, 15 blockers, all
accepted, none rebutted.

## Round ledger

| Round | Verdict | Blockers | Theme |
|---|---|---|---|
| 1 | FAIL | 8 | Unverified claims: Agent caller, nodeApi, count/multimode, i18n, persistence shape |
| 2 | FAIL | 2 + 3 | Guards placed in one location when state has several entrances |
| 3 | FAIL | 3 | Redesign summary layered on rejected pseudocode; contradictory V5 wire contract |
| 4 | FAIL | 3 | Stale summaries; undefined helper; capability path mismatch |
| 5 | FAIL | 2 | Zustand 5 selector stability; setter location + missing save |
| 6 | **PASS** | 0 | — |

## Rounds 3-6 in brief

`004` and `005` cover rounds 1-2 in full. The later rounds were narrower and
share one shape: **the fix was right, the paperwork was not.**

**Round 3.** I wrote the sparse-override redesign as a *summary section* in
`020` and left the rejected full-object pseudocode below it. Both were in the
file, both looked active, and the detailed half was the wrong one. The reviewer
caught that an implementer following the detail would rebuild the exact defect
round 2 had just removed. Resolution: `020` deleted and rewritten single-design,
`002` §D3 retitled, `030`'s pseudocode switched to the selector.

Round 3 also caught a contract I had stated three incompatible ways: omit
`qualityPresetId` for V4.5, AND send `straight_alpha: false`, AND leave the
V4.5 wire body unchanged. The adapter already sends `qualityPresetId` for every
model (`lib/naiImageAdapter.ts:128`), so omission *is* a change. Resolved by
choosing one contract — preserve the wire shape, pin the values, neutralize
user influence — and stating it once in `010` with a correction note in `005`.

**Round 4.** Three stale references surviving the rewrite: `000`/`README`
still calling wp2 a "`naiOptions` slice", `004`'s B6a resolution still showing
`shape: "json:NaiOptions"` with no supersession marker, an invented
`warnQuotaOnce` helper (the real pattern at `storePersistence.ts:193-197` is a
bare `catch {}`), and a capability snippet naming `naiDefaults`/`cfg` against a
canonical path of `defaults.nai`/`appConfig`.

**Round 5.** Two real implementation defects, both invisible without reading
the installed dependency and the actual store file:

- `selectResolvedNaiOptions` returns a fresh object per call, and Zustand 5
  (`ui/package.json:23`) passes selector output straight to
  `useSyncExternalStore` (`ui/node_modules/zustand/esm/react.mjs:5-11`). Needs
  `useShallow` — the first use of it in this codebase.
- `setPromptImpl` lives in `storeSettingsImpl.ts:565-568`, not
  `storePromptImpl.ts` as `020` claimed, and I had specified the
  `GenerationDefaults` field, loader, and hydration without ever specifying the
  **write**. The negative prompt would have silently never persisted.

**Round 6.** PASS, no blockers.

## What the six rounds were actually about

Two failure modes, each recurring until named:

1. **A guard in one place for state with several entrances** (rounds 1-2).
   Hiding a control while its behavior stays live; resetting a flag in one
   callback when three other paths set the same state. Fixed by moving guards to
   boundaries — the payload builder and the adapter — rather than to whichever
   path I happened to be reading.

2. **An amendment that adds without removing** (rounds 3-4). Appending the new
   design and leaving the old one produces a document that is *individually*
   correct in both halves and useless as instructions. Fixed by deleting and
   rewriting `020` rather than patching it again.

Neither is a NovelAI problem. Both are worth carrying into the implementation
phases, where the same instincts will produce the same defects in code.

## Cost and judgment

Six review rounds for a docs-only phase is more than typical. It was worth it:
rounds 1, 2, and 5 each found defects that would have shipped — a hidden control
with live behavior, a persistence model that silently froze operator config, and
a negative prompt that never saved. Rounds 3 and 4 were cleanup of my own
amendment debt, which is a cheaper lesson here than in code.

The reviewer never saw an implementation, was never told what to conclude, and
was explicitly invited to PASS on editorial-only findings from round 6 onward.
It PASSed when the roadmap became buildable, not when asked.

## wp0 close

Criteria c1 and c2 are met with the evidence in this folder. Implementation
begins at wp1 (`010`).

