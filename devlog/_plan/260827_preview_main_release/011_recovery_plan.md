# Recovery implementation plan

## File change map

### `scripts/package-global-update-smoke.mjs` — MODIFY

- Export the exact prepacked CI execution sequence as label values already owned by `DEADLINES`.
- Export a pure function that sums those child deadlines and returns the minimum whole-minute workflow envelope with a cleanup margin.
- Do not change any child deadline, retry behavior, install command, or smoke assertion.

### `tests/package-global-update-smoke-contract.test.ts` — MODIFY

- Read `.github/workflows/publish.yml` as a non-prose configuration source.
- Read `.github/workflows/release.yml`, `scripts/wait-ci-gate.mjs`, and `scripts/wait-publish-run.mjs` as the outer configuration sources.
- Extract the Windows smoke step timeout, package source-verification timeout, explicit preview wait, candidate verification timeout, candidate-CI wait, and cut-job timeout.
- Assert the Windows timeout is at least the computed prepacked minimum; preview wait envelopes package + Windows + finalize allowance; cut timeout envelopes candidate verification + candidate CI + preview wait + setup allowance.
- RED: current 15/60/90-minute chain must fail the computed relationships.
- GREEN: the 40/100/240-minute chain makes the same test pass without changing child deadlines.

### `.github/workflows/publish.yml` — MODIFY

- Increase only the preview Windows consumer smoke step's outer timeout from 15 to 40 minutes.
- Add a concise comment explaining that child deadlines remain the failure oracle and the outer budget must not preempt them.
- Do not modify stable gates, OIDC permissions, matrices, or publish commands.

### `.github/workflows/release.yml` — MODIFY

- Pass an explicit 100-minute timeout to `wait-publish-run.mjs` for the preview publish; it envelopes the 25-minute package source gate, 40-minute Windows consumer, and finalize margin.
- Pass the existing 45-minute candidate-CI timeout explicitly to `wait-ci-gate.mjs` instead of relying on its hidden default.
- Increase the `cut` job timeout from 90 to 240 minutes so candidate verification (45), candidate CI wait (45), preview wait (100), and setup margin cannot be preempted by the job wrapper.
- Keep the stable tag job and its existing 80-minute stable publish wait unchanged.

### Release evidence docs — MODIFY/NEW

- Record RED/GREEN commands, audit verdict, exact-head CI, failed-attempt state, recovery release IDs, approvals, and final registry/install proof.

## Activation and verification

- RED activation: run `node --test tests/package-global-update-smoke-contract.test.ts` after adding the new assertions but before changing workflow timeouts; observe the 15-minute Windows and 90-minute cut envelopes violate the computed relationships.
- GREEN: rerun the same test after both workflow edits.
- Focused: `node --test tests/package-global-update-smoke-contract.test.ts tests/subprocess-deadline-contract.test.ts tests/release-pipeline-contract.test.ts`.
- Static/full: `npm run typecheck:tests`, `npm run test:inventory`, `npm test`, `npm run typecheck`, and `git diff --check`.
- Runtime: exact-head CI/CodeQL after non-force dev/main push.
- Original symptom: a new preview publish must show both Windows consumers successful and `publish-preview` successful; no rerun of failed run 33073607259 counts.

## Forward-only ref plan

1. Run `git fetch origin dev main preview --tags`, prove live main/preview are candidate `3d111149`, then fast-forward local dev from bootstrap `85ab1a42` to the fetched origin/main candidate.
2. Commit the timeout contract and recovery evidence.
3. Non-force push the recovery head to dev, then main. Preview may remain at `3d111149`; main contains it, so preflight passes.
4. Wait exact recovery-head main CI/CodeQL.
5. Dispatch `release.yml` with `bump=patch`, `dry_run=false`, and `expected_sha=<recovery-head>`.
6. The workflow creates v3.12.1, proves preview, then atomically aligns dev/main/tag and publishes stable.

## Bypass and risk fields

- Tier: E7 procedural + repository contract test; no branch protection exists.
- Executing surface: GitHub Actions publish Windows consumer and release workflow.
- Known bypass: a direct manual workflow edit/push could lower the timeout and skip local tests; exact-head CI and the release candidate gate detect it before publish.
- Residual risk: the outer release wrappers permit a longer wall clock, but child tree deadlines remain 1-7 minutes and preserve earlier labeled failure; nested budget assertions prevent the wrappers from silently becoming smaller than the operations they supervise.
- Wording downgrade: this is a contract guard, not unbypassable enforcement.
- Final enforcement layer: `publish.yml` job success is required by `publish-preview`, and release tagging requires preview proof.
