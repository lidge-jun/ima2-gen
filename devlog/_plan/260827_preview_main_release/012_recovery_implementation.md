# Recovery implementation evidence

## RED

Command:

```text
node --test tests/package-global-update-smoke-contract.test.ts
```

Result: exit 1, 5 pass / 2 fail.

- `Windows outer timeout 15m must envelope 35m of child deadlines`.
- `wait-ci-gate.mjs wait must receive an explicit timeout`.

This proves the regression test detects both the immediate Windows mismatch and the hidden nested wait value before workflow edits.

## GREEN

Changed:

- `scripts/package-global-update-smoke.mjs`: explicit prepacked child sequence plus a pure computed minimum outer budget.
- `scripts/package-global-update-smoke.mjs`: the same sequence is consumed as a runtime deadline trace around the actual prepacked execution path.
- `tests/package-global-update-smoke-contract.test.ts`: exact workflow job/step/run-command extraction, nested-envelope assertions, and activation of complete/incomplete runtime traces.
- `.github/workflows/publish.yml`: Windows consumer outer timeout 15 -> 40 minutes; child deadlines unchanged.
- `.github/workflows/release.yml`: candidate CI wait made explicit at 45 minutes, preview publish wait made explicit at 100 minutes, cut wrapper 90 -> 240 minutes.

Focused command:

```text
node --test tests/package-global-update-smoke-contract.test.ts tests/subprocess-deadline-contract.test.ts tests/release-pipeline-contract.test.ts
```

Initial result: exit 0, 37 pass / 0 fail. After the independent implementation-review repairs, the same focused suite passed 38 / 0.

Additional gates:

- `npm run typecheck:tests`: exit 0.
- `npm run test:inventory`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test`: final post-review run exited 0, 2641 tests / 2639 pass / 0 fail / 2 skip.
- `git diff --check`: exit 0 before the full gate.

## Patch-integrity classification

- Required test change: adds a regression oracle for numeric workflow budgets and deadline sequence.
- Required workflow change: gives existing child failure oracles enough outer time; no test, matrix, assertion, security permission, publish command, or provenance gate is removed.
- No suspicious changes: no retry, skip, quarantine, lowered threshold, removed assertion, or coverage exclusion.

## Original-symptom verifier

Local tests prove the static contract only. The bug is closed only when a fresh preview publish shows Windows Node 22/npm 11 and Node 24/npm 12 consumers both successful and reaches OIDC `publish-preview` successfully on the recovery release SHA.
