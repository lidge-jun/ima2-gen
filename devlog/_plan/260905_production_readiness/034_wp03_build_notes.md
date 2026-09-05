# WP03 B — implementation ledger

FSM B entered after both A reviewers passed (033). Parent source baseline a34205f7.
No WP03 PR, merge or release yet. Full exact-head verification remains pending.

## Disjoint workers

All six spawns explicitly requested gpt-6-astra/high. No service-tier parameter
was set or independently verified. Exclusive files and test contracts are in032.

| Slice | Agent |
| --- | --- |
| Classic | Banach 01a07078-1219-7632-aa55-d79ee69a514a |
| Node | Kepler 01a07078-12b1-7fa2-ad22-ee5622096f42 |
| Edit / sequence | Carver 01a07078-1363-7420-9e16-49c2c671545a |
| Isolated fixture / boundary | Raman 01a07078-13f2-75b3-ad03-a328287f2851 |
| Contract migration / AST | Meitner 01a07078-148a-7490-9313-2ad6cb1e0225 |
| Error UI / visual scenarios | James 01a07078-1539-7d11-9285-06cc951eaf19 |

Main owns shared production types/admission/index/dispatcher, providerOptions
literal narrowing, server error passthrough/map, integration and evidence. Workers
may not change FSM/goal/refs, commit, launch full suites or contact paid providers.

## Main foundation

- Created the audited full execution contract with nullable single providerUrl.
- Created public guarded prepare/execute and internal four-surface dispatcher;
  leaf implementations are concurrently assigned, so not yet a build-green claim.
- Added pure pre-admission checks and execution-time current-key assertion.
- Added generation error passthrough/401 mapping and AUTH_INVALID classification.
- Narrowed only providerOptions' closed api/oauth final branch return.

Pure admission smoke executed under env-i with no keys, config access, process
launch or network. 35 literal assertions passed: four surfaces × missing/empty/
blank key refusal, proxy/direct positive cases, NAI sequence refs vs no refs and
mutable-key removal. Scope is the helper alone, not actual route/legacy execution.
`git diff --check` exit0 at this checkpoint. No full local suite run.

## Intermediate integration diagnostics

Initial server typecheck after leaf relocation exposed an over-narrow seam:
providerOptions' normalized reasoningEffort is inferred string-or-undefined.
ExecutionOptions now preserves that native optional value rather than introducing
a new default or casting caller input. Responses already accepts undefined effort.
Other diagnostics were incomplete edit/sequence imports and exact-optional Gemini
requestId / Responses mask and callback options; assigned original owners to omit
absent optional fields without changing wire behavior. This was not a green build.

After those type corrections and all four caller import/admission replacements,
`npm run typecheck` and `npm run build:server` each exited0. Runtime twins were
regenerated and remain ignored. This checkpoint establishes compilation, not the
pending route/boundary/visual/hosted full-suite assertions. Error-card geometry
scope was re-planned and independently approved in035, then the same six workers
resumed with preserved partial changes.
