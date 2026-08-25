# wp0 verification receipt

Measured on dev after commit 6768e4d7 (docs-only).

| Command | Exit | Output |
|---|---|---|
| npm run typecheck | 0 | tsc --noEmit -p tsconfig.json, no diagnostics |
| npm run test:inventory | 0 | classify-tests.mjs --check --fail-js-runtime |
| node scripts/generate-provider-types.mjs --check | 0 | registry/UI catalog in sync (unchanged by this unit) |
| ls devlog/_plan/260825_novelai_negative_prompt_settings/*.md | 13 | c2: every implementation phase has a decade doc |

Baseline for later phases, measured on dev@7e504f32 before any change:
npm test -> tests 2580 / pass 2578 / fail 0 / skipped 2.

c1 evidence: 001_parity_gap_table.md carries the CLIsu-to-ima2 diff with
file:line citations on both sides, independently re-verified by the reviewer
(18 representative citation groups confirmed against the tree in round 1).

c2 evidence: 010, 020, 030, 040, 050 exist at diff level; 004, 005, 006 record
six audit rounds and 15 accepted blockers.

wp0 is docs-only, so no test or build could regress: nothing outside
devlog/_plan and .gitignore was touched.

