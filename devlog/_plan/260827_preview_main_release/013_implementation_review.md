# Recovery implementation review

## Round 1

The independent reviewer returned FAIL with two medium blockers:

- The timeout sequence was imported from the implementation but not consumed by runtime, so it could drift from actual call order.
- Workflow extraction used nearby lexical text rather than exact job/step/run-command boundaries.

Both were accepted.

## Repair

- The prepacked sequence is now a runtime deadline trace around the real prepacked main path. Any label mismatch or incomplete sequence fails, and tests activate both success and incomplete-trace paths.
- Workflow extraction now resolves exact two-space job blocks, six-space step blocks, the step's own timeout field, and the step's reconstructed run command. Wait tests require the expected script prefix and numeric timeout as the final argument.

## Final verdict

> No actionable blockers remain.
>
> The runtime trace covers the actual prepacked call order, detects incomplete/mismatched sequences, and the workflow checks now bind to exact job/step blocks and final wait arguments. The targeted contract suite passes 8/8. Release, OIDC, Windows, and provenance gates remain intact.
>
> VERDICT: PASS
