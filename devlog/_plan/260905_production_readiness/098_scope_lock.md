# WP09 delivery scope lock — owner steering, 2026-09-06

This document supersedes expansion requirements in090–097. The owner explicitly
stopped test-infrastructure expansion while retaining the production roadmap,
at least10 implementation PRs, ordered merges and the canonical release. Keep
existing commits and working changes; do not restart or discard them. FSM remains B.

## Classify the current changes

| Class | Existing changes | Disposition |
| --- | --- | --- |
| Product | NavRail/mobile spacing; MCP readiness projection/popup, observation GETs, four locales | Ship after actual user-flow and visual verification. Original NAI geometry is inherited from WP08 and must remain correct. |
| Required verification | Existing isolated app/owned home, egress/file/process denial, emitted build/receipt binding, one-time seed, stub; original regression suite and focused NAI/MCP/recovery journeys | Finish the observed startup defect, use the existing machinery, verify final candidate. No replacement framework. |
| Auxiliary test infrastructure | Extra cache/receipt mutation combinations, Tailwind stress expansion, exhaustive viewport/locale matrices, generic lifecycle/guard hardening | Preserve already-written work and tests. Freeze further additions. They do not independently create new WP09 completion gates or justification for another redesign. |

## Minimum completion conditions

1. Resolve the three observed libc probe refusals without reading outside the
   fixture or admitting writes. Exact evidence:34000963925, openSync on
   /proc/self/exe and/usr/bin/ldd, readFileSync on/usr/bin/ldd. Keep user/account
   paths and external services protected. Readonly attempts remain denied and
   separately observed; r+/w/truncation and every other path remain unexpected.
2. In the actual rendered app, verify original NovelAI negative-pane spacing on
   sidebar, bottom composer and mobile; both drafts/actions must remain usable.
   Verify provider/mode round trips and reload, mobile navigation, MCP selected
   provider/model/kind, error recovery and same-home restart with owned stubs.
   Existing Home/Node/IME cases are sufficient to inspect their reported risks;
   do not expand their permutations. Open the screenshots directly and repair
   demonstrated product defects, not hypothetical test-framework deficiencies.
3. Final candidate SHA passes the required full CI, existing regressions,
   isolation dependency gate, type/build/inventory checks and CodeQL comparison.
   Retain source-bound evidence and clean teardown; no skips, widened allowlists,
   lowered assertions or source/HEAD mismatch to get green. Existing inherited
   SAST release disposition remains assigned to WP12, not silently waived.
4. Record verification and visual findings, update the frontend SoT, obtain the
   scoped final review/test receipt, close WP09 through C/D and make PR211 ready.
   Then continue remaining WPs in dependency order. Final stack merge/release
   verification remains mandatory and is reported separately from WP completion.

## Exclusions and immediate execution

No new guard classes, generic abstractions, new proof schema, lease protocol,
runner or additional exhaustive matrix. Record unrelated findings in this unit
for later triage; do not turn them into new current tasks. No new subagent unless
an independent, bounded task needs it; omit model/effort on every dispatch.

Next run: one `WP09 startup diagnostic` job reusing the existing build and
Playwright commands, separate from the release-gating `CI` workflow,
matching the readonly platform probe, three primary-config startup cases and
normal emitted server/model discovery. It is NOT a full candidate pass. Once
relevant repairs are grouped, run normal full CI and directly view UI screenshots.
The separate workflow has no unrelated root/package jobs or downstream-image
requirements and cannot masquerade as the release-gating CI workflow. Normal CI
defaults and final acceptance commands remain unchanged. This narrow execution
entrypoint implements the owner's single-job instruction, not a new test framework.
It runs only for the WP09 branch's startup-fixture changes (or explicit dispatch),
so pushing the grouped startup fix runs one diagnostic job without root matrices.

Report three independent states: verification complete/pending, merges complete/
pending, release complete/pending. At this lock: WP09 native/UI verification is
pending, PR211 is draft, no stack merge or release has been completed.
