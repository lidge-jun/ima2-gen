---
created: 2026-08-31
tags: [ima2-gen, devlog, dependencies, ci]
---

# Dependabot backlog + open-issue triage

## Frozen scope (2026-08-31)

Snapshot taken at entry; later arrivals are out of scope unless the user expands it.

| Item | State at entry | Disposition |
|---|---|---|
| #175 `@tanstack/react-virtual` 3.14.9 -> 3.14.10 (ui prod) | CI green, base `main` | merge |
| #176 `@types/react-dom` 19.2.4 -> 19.2.5 (ui dev) | CI green, base `main` | merge |
| #177 `@openai/codex` 0.147.0 -> 0.149.1 (root prod) | CI green, base `main` | merge |
| #178 github-actions group: codeql-action v4.37.7 -> v4.37.8 | **PR fast gate FAILED** | fix our test first, then merge |
| #150 Provider Adapter v1 RFC | open, p1 | **keep open** — verified unfinished |

## Root cause: #178 is our bug, not a bad bump

The failing step is `Run tests`, and the failing case is
`tests/governance-files-contract.test.ts` -> "pins CodeQL and nix actions to
immutable SHAs":

```
not ok 5 - pins CodeQL and nix actions to immutable SHAs
  The input did not match the regular expression
  /github\/codeql-action\/init@ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd/
```

The assertion hardcodes one CodeQL commit, so any correctly-pinned bump fails it.
The nix half of the SAME test already got this right, with a comment naming the
prior incident:

```ts
// The rule is "pinned to an immutable commit", not "pinned to one specific
// commit forever": hardcoding the SHA made every Dependabot bump fail this
// gate even when the bump was correctly pinned (#162).
assert.match(nix, /cachix\/install-nix-action@[0-9a-f]{40}\b/);
```

So #162 fixed this class of bug for nix and left the two CodeQL lines behind.
This is a recurrence, not a new failure. The intent of the gate is "pinned to an
immutable 40-hex commit, never a floating tag" — the SHA identity is Dependabot's
business.

## Audit round 1 (explorer, VERDICT: fail) - plan amended

The first plan copied the nix assertion's shape, and the auditor showed that
shape is itself too loose. Amendments:

1. **A trailing `\b` is not a pin check (High).** `\b` matches between the 40th
   hex character and punctuation, so `@<40hex>-evil`, `@<40hex>/evil`, and
   `@<40hex>.evil` - all mutable refs - pass. Anchor the whole YAML token
   instead: line start, `uses:`, the ref, an optional trailing comment, line end.
2. **`@vN`-only negation leaves branch pins open (Medium).** The gate rejects
   `@v4` but accepts `actions/checkout@main`. The repository's own Actions
   setting reports `sha_pinning_required: false`, so there is no platform
   backstop. Assert the property positively over EVERY external `uses:` in the
   covered workflows rather than blacklisting one bad shape.
3. **A second literal will recreate this bug (Medium).** `tests/release-pipeline-contract.test.ts:330`
   freezes `actions/attest-build-provenance@4d10147...`, so its next bump fails the
   same way. Criterion c2 requires fixing it in this unit, not later.

Also recorded from the audit: the tree itself is currently clean - all 51
`uses:` refs across 11 workflow files are exact lowercase 40-hex. So this change
tightens the gate without needing any workflow edit.

## Work phases

- **wp1 - governance/release gate fix.** Replace every literal action SHA
  assertion with an anchored full-token check, and add a positive
  all-external-`uses:`-are-40-hex assertion so branch and tag pins fail too.
  Covers both `tests/governance-files-contract.test.ts` and
  `tests/release-pipeline-contract.test.ts`. Land on `dev`.
- **wp2 — dependabot merges.** Merge #175, #176, #177 (already green). Then
  re-run #178 against the fixed gate and merge it.
- **wp3 — issue triage.** Verify #150 against the tree rather than closing it on
  age. Evidence gathered at entry: no `packages/` directory exists, and UI
  provider switches remain across `ui/src/store/*`, `ui/src/lib/imageModels.ts`,
  `ui/src/components/CostEstimate.tsx`. Two of the six acceptance boxes are
  provably unmet, so the RFC stays open.

## Criteria

- c1: the governance gate accepts any correctly pinned 40-hex ref and rejects
  `@vN`, `@main`, short hex, and SHA-prefixed mutable refs such as
  `@<40hex>-evil`, `@<40hex>/evil`, `@<40hex>.evil`.
- c2: no test file in the repo freezes a literal action SHA, including
  `tests/release-pipeline-contract.test.ts`.
- c3: all four dependabot PRs are merged or explicitly closed with a reason.
- c4: #150 disposition is backed by tree evidence, not by age.
- c5: the new assertions are exercised against adversarial refs, not only the
  happy path, so a future loosening is caught by the suite itself.
