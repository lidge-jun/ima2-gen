# 011 — wp1 stale check

Date: 2026-08-27. Production code unchanged in P.

## Branch and ancestry

`git fetch origin dev` confirms the same split recorded in 000:

- merge base: `76a8b7e9b860d99b754aca9c1e28bcb6b475316f`;
- local line: `755fc1c2` plus roadmap commits `01566f2c`, `7c111bcb`;
- remote line: `d18e56ca` (`v3.11.0` package version commit).

WP1 B begins with `git merge --no-edit origin/dev`. The merge must preserve both
`755fc1c2` and `d18e56ca` as ancestors. If conflicts occur, stop and inspect exact
files; the known changes are expected to be disjoint (`devlog` evidence vs
`package.json` / `package-lock.json`).

## Path and signature revalidation

- `./config.ts:369-381` owns `naiProvider`; the existing boolean helper is `pickBool`,
  so 010 was corrected from the nonexistent `envBool` name.
- `lib/capabilities.ts:95-100` owns the UI display defaults projection.
- `lib/naiOptions.ts:29-41,80-118` owns request-boundary normalization.
- `lib/naiImageAdapter.ts:42-61,116-175` owns options and final request parameters.
- `tests/nai-provider-contract.test.ts:30-68` provides a fetch recorder and runtime
  context suitable for activation proof.
- `tests/nai-client-options-contract.test.ts:46-69` already checks emitted/read field
  parity; it will be expanded to cover the two new booleans. The final upstream body
  activation can remain in the adapter test if importing adapter fixtures across test
  modules would create test-only exports. Acceptance is the combined behavioral chain,
  not a forced test-file location.
- `tests/capabilities-lane-contract.test.ts:37-55` pins the exact NAI default keys.

## Threat model

- Asset: existing NovelAI token and generation allowance.
- Entry points: env/file config, browser/CLI request JSON, upstream fetch.
- Trust boundary: request body -> `readNaiOptions`; config -> runtime context; adapter
  -> NovelAI host.
- Attacker/error capability: wrong types, stale client values, or a false boolean that
  must override a true operator default.
- Controls: strict boolean parsing; sparse fields; no token logging; fetch recorder tests;
  no live generation in wp1.

No credential, validation URL, auth header, or response logging code changes in wp1.

## RED/GREEN order

1. Merge remote release commit and prove ancestry/clean tree.
2. Add failing tests for config/default projection, request normalization, explicit
   true/false override, and captured wire fields.
3. Run focused suite and record the expected RED failures.
4. Implement only the two-field chain.
5. Re-run focused suite, typechecks, and diff checks.
