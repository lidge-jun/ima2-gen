# 041 — wp5 check evidence (docs, skills, site)

Commits: 2976ed0a (skills), 33a25105 (README), 007196c6 (site en+ko), b6eab816
(structure SoT 00-07), 19d6bc56 (docs/CLI.md + docs/PROMPT_STUDIO.md + regenerated
test inventory — the two manual files and the inventory were outside the worker's write
set and were finished by main).

Verifiers at 19d6bc56: `npm test` pass 2774 / fail 0; typecheck, typecheck:tests,
test:inventory, ui build, `cd site && npm run build` (20 pages) exit 0;
`node scripts/generate-contract-docs.mjs --check` up to date; static site link crawl
20 files OK; `node bin/ima2.js skill ls` and `skill ima2` load after `build:cli`.
`cd site && npm run check` reports 7 pre-existing `@neplex/vectorizer` export
diagnostics from `lib/vectorizeImage.ts`, none from site pages.

New docs contracts: `tests/studio-surface-docs-contract.test.ts` extracts labels,
routes, config keys, and the auto order from landed code and asserts the docs match;
`tests/cli-skill-command-contract.test.js` extended for the skill text.

Drift from 040 resolved toward landed code: UI label is "Undesired content"
(ko "제외할 요소"), not "Negative prompt"; CLI form includes `--backend`; canvas
trace stages a hidden flattened PNG before opening the shared panel; provider tables
gained the nai and comfy lanes.

## Render grounding (site/dist served under the GitHub Pages base `/ima2-gen/`)

| Screenshot | Observed |
|---|---|
| `evidence/040-site-en-modes-1280x720.png` | Canvas Mode section: "Export 'SVG (embedded raster)' ... or choose 'Trace to SVG (vector)' to flatten the composition and open the shared path-tracing panel." |
| `evidence/040-site-ko-modes-1280x720.png` | Classic 섹션: "NovelAI를 고르면 '포지티브 프롬프트'와 '제외할 요소' 입력창이 나란히 열리고, 컴포저 너비가 719px 이하이면 위아래로 쌓입니다." |

