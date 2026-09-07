# 010 wp1 — hygiene residuals (C2)

Consumes 000 baseline. Branch `codex/p314-wp1-hygiene` from origin/dev (36aa6fce).

## IN
1. CHANGELOG.md: rename `## [Unreleased]` (line 29) to `## [3.14.0] - 2026-09-06` and
   insert a new empty `## [Unreleased]` above it with the two sections this round will
   fill in later WPs (`### Added` NAI quota lane, `### Changed` adapter contract,
   `### Fixed` no-op rethrow cleanup). Keep-a-Changelog order: Unreleased first.
2. `git mv devlog/_plan/260905_production_readiness devlog/_fin/260905_production_readiness`
   and append `!devlog/_fin/260905_production_readiness/` + `/**` to .gitignore (the
   `devlog/_fin/*` rule at .gitignore:14 ignores the destination; git mv keeps indexed
   files but later receipts would be silently ignored).
   Repoint tracked references:
   - DESIGN.md:173 `260905_production_readiness/084*` -> `_fin/260905_production_readiness/084*`
   - structure/07-devlog-map.md:125 row: move from "Active units" to the archived
     table (status: "WP00-WP13 complete; v3.14.0 released 2026-09-06 (#219, 36aa6fce)").
   - devlog/_plan/README.md:27 row: delete from Active Lane; add a line under an
     archive record "2026-09-08 아카이브: 260905_production_readiness (v3.14.0 출시로 완료)".
   - .release/required-units.json is unaffected (SHA-based).
   - tests/scripts: `rg -n '260905_production_readiness' tests scripts` = 0 hits at P;
     tests/nai-dual-prompt-contract.test.ts:102 mentions "(260905)" as prose only. No change.
3. Remove the no-op `catch (error) { throw error; }` wrapper. Rule applied per site:
   - `try { X } catch (error) { throw error; }` -> `X` (drop try; keep body indentation).
   - `try { X } catch (error) { throw error; } finally { Y }` -> `try { X } finally { Y }`.
   - A trailing comment such as "// Caller owns lifecycle" moves above the statement
     it described or is dropped when it only justified the wrapper.
   Files (19 files / 51 sites at P): lib/providers/adapters/grokExecution.ts (9),
   lib/spriteRecipeStore.ts (8), lib/providers/adapters/openaiExecution.ts (5),
   lib/providers/adapters/googleExecution.ts (5), ui/src/lib/lanSession.ts (4),
   lib/providers/execution/legacyClassic.ts (3), lib/spriteRowPipeline.ts (2),
   lib/spriteAnchor.ts (2), lib/providers/execution/index.ts (2), lib/pinnedHttpGet.ts (2),
   ui/src/lib/api-core.ts (1), lib/spriteCurationStore.ts (1), lib/spriteAtlasExport.ts (1),
   lib/providers/execution/legacyNode.ts (1), legacyMultimode.ts (1), legacyEdit.ts (1),
   lib/mcp/downloadMediaResult.ts (1), lib/assetLifecycle.ts (1), lib/agyArtifactRead.ts (1).
   Tests under tests/ that carry the same pattern (agy-execution-process.test.ts etc.)
   are left alone: they are fixtures, not the convention's target, and touching them
   adds churn without behavior change.
4. AGENTS.md:99 replace
   `- try/catch mandatory for all async operations` with
   `- Wrap async work in try/catch only where the error is transformed, logged, or
   surfaced at a boundary (route handler, job runner, CLI entry). A catch that only
   rethrows is noise; let the error propagate.`
   Same wording lands in structure/00-structure-hub.md if it restates the convention
   (verify with `rg -n 'try/catch' structure`; 0 hits at P -> N/A).

## OUT
500-line splits; test fixture rethrows; any behavior change.

## Verifiers (all observe the target; exit codes recorded at A round 1 / B)
- `rg -c 'catch \(error\) \{ throw error; \}' lib ui/src bin routes` -> exit 1 with no output after B (exit 0, 19 files at P). Reads targets directly.
- `npm run typecheck` (tsconfig.json includes lib, routes, bin, server, config) exit 0.
- `npx --prefix ui tsc --noEmit -p ui/tsconfig.app.json` (ui/tsconfig.json has files: [] and only references; the app config includes ui/src) exit 0; `npm --prefix ui run build` exit 0.
- `npm run build:server && npm run build:cli && npm --prefix ui run build` first (source-tree tests read emitted lib/*.js, e.g. tests/prompt-studio-ui-contract.test.js:136), then `npm test` exit 0.
- `node scripts/refresh-structure-line-counts.mjs` then `--check` exit 0.
- `rg -n '260905_production_readiness' DESIGN.md structure/07-devlog-map.md devlog/_plan/README.md .gitignore` -> every hit carries the _fin/ prefix (explicit files: a glob excluding devlog/ would skip README.md and hidden .gitignore).
- `git ls-files devlog/_fin/260905_production_readiness | wc -l` == 159 (tracked count before the move).
- CHANGELOG: human review row; no gate reads it.

## Accept
- c-2 evidence: rg count 0; PR #<n> to dev with PR Fast Gate + CodeQL green on exact head; merged.


## wp1 P revalidation (2026-09-08, tree f7c73a9f)
Quoting wp0 D: baseline green (3470 pass), roadmap locked; direction unchanged.
Re-checked: CHANGELOG.md:29 still `## [Unreleased]`; AGENTS.md:99 wording unchanged;
rethrow count 19 files / 51 sites; .gitignore has no _fin/260905 entry; references at
DESIGN.md:173, structure/07-devlog-map.md:125, devlog/_plan/README.md:27 as documented.
The dev branch equals main (36aa6fce), so the wp1 branch cuts from origin/dev.
C2 micro-audit: independent reviewer verifies the rethrow removal is behavior-neutral
(diff shows only wrapper removal, finally blocks retained) and the archive move keeps 159 files.

