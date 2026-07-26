# WP6 Phase 2 — structure snapshots + API/CLI verification

## Scope
1. `structure/01` — agent lib cluster, UI stale counts, Refactor Signals refresh
2. `tests/api-docs-contract.test.js` — route paths in `docs/API.md`
3. Run `cli-feature-parity-contract` + structure contracts
4. Commit + push dev

## MODIFY
- `structure/01-file-function-map.md`
- `tests/api-docs-contract.test.js` (NEW)

## VERIFY
- `npm run docs:refresh-line-counts -- --check`
- `node --test tests/structure-line-counts-contract.test.js tests/api-docs-contract.test.js tests/cli-feature-parity-contract.test.js`
