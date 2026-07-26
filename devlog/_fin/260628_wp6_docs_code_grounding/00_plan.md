# WP6 — Full docs code-grounding (v2.0.4)

## Part 1 (plain)

- Korean README gets the same one-click install / updating details as English (stale-process cleanup wording).
- Add a script that refreshes `structure/01-file-function-map.md` line counts from live `lib/*`, `bin/commands/*`, `bin/lib/*`, `routes/*`, `server.ts`, `config.ts` sources.
- Add a contract test so CI fails when counts drift.
- Run the script, fix any stale structure snapshots, verify `docs/API.md` + `docs/CLI.md` still match routes/bin.

## Part 2 (diff-level)

### NEW
- `scripts/refresh-structure-line-counts.mjs` — parse table rows in `structure/01-file-function-map.md`, `wc -l` each `.ts`/`.tsx` path, update `n/a` and stale counts; `--check` for CI.
- `tests/structure-line-counts-contract.test.js` — runs script in `--check` mode.
- `devlog/_plan/260628_wp6_docs_code_grounding/00_plan.md` — this file.

### MODIFY
- `structure/01-file-function-map.md` — automated line-count refresh for all mapped `lib/*`, `bin/commands/*`, `bin/lib/*` rows; snapshot note + changelog.
- `docs/README.ko.md` — one-click install summary adds stale-process cleanup parity with English.
- `package.json` — `"docs:refresh-line-counts"` script.

### VERIFY
- `npm run docs:refresh-line-counts -- --check`
- `node --test tests/structure-line-counts-contract.test.js`
- `npm run typecheck`
