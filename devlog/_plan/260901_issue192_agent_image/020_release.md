# wp3 — Promotion and release (v3.12.3)

## Order of operations, forced by the real contract

`scripts/release-cut.mjs` `assertBaseline` requires `origin/main` to EQUAL the
checkout and to already contain `dev` and `preview`, so promotion had to happen
BEFORE the cut, not after. Both promotions were verified strict fast-forwards with
`git merge-base --is-ancestor` first, so no history was rewritten.

## Evidence chain

| Step | Proof |
|---|---|
| Fix on dev | `74b8dcef..21e11f06 dev -> dev` |
| Exact-head CI | run 33410486386 completed success |
| CodeQL | run 33410486562 completed success |
| Dry-run cut | run 33411343435 success; tag job correctly `skipped` |
| Promotion | main and preview fast-forwarded to `21e11f06` |
| Real cut | run 33411798501 success, `dry_run=false`, full 40-char `expected_sha` |
| Preview publish | run 33412612815 success -> `3.12.3-preview.260831.33412612815.1` |
| Stable publish | run 33413989638 success -> `latest: 3.12.3` |
| Ref convergence | `main == dev == preview == v3.12.3 == 9cd60ac1` |
| npm provenance | `gitHead = 9cd60ac1...` matches the tag |
| GitHub Release | `v3.12.3` with `release-manifest.json`, `sbom.cdx.json` |

## Installed-artifact verification

The repo containing a fix is not proof the RELEASE does. Installed
`ima2-gen@3.12.3` from the registry into a clean temp prefix and grepped the
compiled output:

- `lib/agentImageVideoGen.js` — 4 hits for the reference-forwarding call
- `lib/agentImageVideoGen.js` + `lib/agentRuntime.js` — `PROVIDER_EMPTY_IMAGE` present in both
- `lib/agentQueueStore.js` — 8 hits for `error_raw_code`

All three fixes are in the shipped bytes.

## Note on the environment gate

`npm-stable` is a protected environment requiring reviewer approval; both the
preview and stable publish runs paused there. Approved under the release
authorization given for this task. A future unattended release will pause at the
same point.
