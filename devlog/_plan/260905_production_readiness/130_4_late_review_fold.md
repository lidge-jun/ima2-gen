# WP13 — late premerge review fold

The stack-wide unresolved-thread read found three concrete product allegations
before merging. This stays within release readiness: source-confirm and minimally
repair actual defects; do not add frameworks, abstractions, broad guards or new
acceptance categories. Existing unrelated/style findings receive an evidence-backed
disposition, not an opportunistic refactor. Native-stack authority remains pending.

## PR204: sparse Grok sequence metadata

Current candidate: bfbcb16f676608b808600d619c300866331b3e2a.
Comment3940236958 points at lib/multimodePipeline.ts:397.

- H1: the callback mistakes an attempt index for a successful-output count.
  Falsifier: a first successful callback at index1 persists count1/partial for a
  request of2, without changing its sequenceIndex2.
- H2: the producer emits the wrong original index or a dense final remapping.
  Falsifier: grokMultimodeOperations records the actual loop index alongside each
  success, and the final sweep uses that aligned originalIndexes entry.
- H3: duplicate writes/events create the count discrepancy.
  Falsifier: the existing sparse route scenarios observe one saved file/event per
  successful original index, while count/status are still wrong.

Source trace confirms the producer's original-index mapping and the route's
persisted-index deduplication are intentional. The callback computes
Math.max(index + 1, images.length + 1), so failure0/success1 yields2/complete even
though only one image was saved. The final sweep correctly avoids a second write
but consequently cannot repair that earlier metadata. Preserve per-callback
progress metadata (already asserted for dense Responses); count successful persisted
images rather than attempts. No re-embedding/rewrite or new metadata lifecycle.

Next proof: bounded in-memory execution of the exact callback with sparse inputs,
then extend the existing G05-7 route assertions for event/sidecar count/status.
Real native route execution remains on a clean remote/CI host; a callback probe
does not establish filesystem/HTTP integration. Full final-head CI follows the
coherent repair batch, not a broad diagnostic rerun.

Observed bounded probe (Node, exact callback source, no module imports/app start):
two repeated index1/request2 runs both yielded `{index:1,total:2,status:complete}`
instead of `{index:1,total:1,status:partial}`. Index1+2/request3 yielded counts2,3
instead of1,2. In-memory replacement of only the count expression passed both;
restoring the original expression restored both failures. Dense0+1/request2
control retained1/partial,2/complete. The one-line production repair now uses
images.length+1; existing G05-7 scenarios gain four count/status assertions across
image events and sidecars. Native integration proof remains pending.

## PR208 / PR210

Independent Astra/high source triage confirmed both; main read the cited owners
before accepting the minimum repair maps. Existing mocks/pure source tests are
the focused proof; hosted UI/whole CI remain final-candidate gates.

- PR208: captureInflightSnapshot restores expired stored jobs, but
  getInflightQueryScopes omits their node sessions/classic lane when not viewed.
  Both merge and pruning preserve unqueried IDs. Extend the existing scope loop
  to query known local jobs, while preserving server-only discovery in the viewed
  node/classic context. Do not delete eligibility/revision/auth/failed-fetch guards
  or blindly expire unqueried jobs. Existing regression incorrectly expects the
  expired other-session job to remain; correct it with realistic session filtering
  and explicit active/terminal/absent outcomes, not a new reconciliation framework.
- PR210: laneCatalog retains rows on loading/error; selector row props only check
  per-model availability, although the click handler already rejects not-ready
  snapshots/lanes. Add those same readiness conditions to both image/video rows.
  Keep labels, retained choices, and the fresh click guard. Existing SSR fixture
  can observe the actual Select props; no new UI abstraction is necessary.

## Small documentation drift and structural exceptions

- PR198: add the active roadmap to the plan hub and refresh its stale WP06s map
  entry. No archive until actual delivery completes.
- PR203: replace the remaining old four-surface responsesImageAdapter ownership
  paragraph with current openaiExecution/openaiOperations/responsesTransport;
  keep the historical chronology and real agent/sprite compatibility export.
- PR202 legacyClassic is now72 lines, with the old163-line body removed by later
  provider extraction; legacyNode execute awaits the helper and propagates errors
  to the existing route retry/normalization boundary. No extra catch/rethrow.
- PR206 runLastFrameI2v intentionally preserves the original ordered operation
  in its62-line function; body reader finally releases/cancels and its awaited caller
  maps errors. No new split solely for a style metric.
- PR207/212 config.ts is531 lines on this candidate. Record the existing central
  config/style exception rather than split config late in a product-first release.
  PR198's long prewritten journey document is also retained as one audited record.
- PR209 inspectPanes awaits throw through the owning Playwright test; failure must
  fail that test, not be swallowed. No catch/rethrow-only helper expansion.
- PR211's old combined15-minute job no longer exists: backend and frontend run
  separately, with the frontend's own25-minute budget. No new timing relaxation.
- PR205 alert95 remains covered by124_8 source-origin analysis, with its explicit
  redirect limitation. No additional security alert dismissal is authorized here.

Windows supplemental probe: SSH desktop-c795oh4, actual Node24.19.0, corrected
callback arithmetic3/3 PASS (sparse1of2, sparse2of3, dense2of2). No app, file
persistence, external provider or native-route coverage claimed by this probe.

## Focused proof before freezing the new candidate

- PR208 worker: existing `inflight-reload-reconcile-contract.test.ts`, RED15/23
  passed and8 failed before production changes (retained absent/terminal IDs);
  GREEN23/23 after. Adjacent reconciliation-behavior/reload-race50/50 passed.
  Main independently ran the reload contract23/23,0fail0skip on the working diff.
- PR210 worker: existing selector SSR test RED4/5 passed,1failed at
  `loading/ready/eligible: cedar`, false!=true; GREEN5/5. Main independently ran
  selector/comfy-display/lane-catalog19/19,0fail0skip. This proves generated row
  props and mocked callbacks, not browser rendering.
- Main source/test typechecks and structure line-count check exit0. No new
  framework, timeout, skip or production test branch. Only the expired retained
  job assertion changes its expectation, based on the observed product defect;
  malformed cross-session terminal coverage remains explicit and stronger than
  the absence grace, rather than filtered away by the realistic response fixture.
- Independent late-source micro-audit and exact new-head hosted CI pending.

The previous bfb candidate completed fullCI34048928508 (all6),
PRFast34048798967 (all3), AgY34048798985 (all4), CodeQL34048930050 and installed
candidate UI34048797010 successfully. These are baseline/control evidence only;
none is reused as verification of the late repair candidate.
