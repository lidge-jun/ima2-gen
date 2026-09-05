# WP02 actual reload fixture RCA

Run33946433692 at85e1cfff passed hosted preconditions and produced real screenshots/
expected generation payload captures. All scenario records showstubCalls0 and
context/child/stub teardowntrue. Most reload scenarios fail onlyunexpectedPUT;
same-origin cross-tab and J6-S1 (no reload) have unexpected[]. FirstGrok scenario
captured only its first submission because the unexpected assertion then failed.
Do not claim these scenarios completed or reuse their partial proof as final.

Hypotheses/falsifiers:
- H1 existing beforeunload empty-session initialization: version0 triggers PUT
  graph. Falsifier: actual flushGraphSaveBeacon atversion0 emits noPUT or anotherURL.
- H2 new selection code regressed graph mutation. Falsifier: unchanged graph-save
  implementation plus identical seeded state reproduces the same beforeunload.
- H3 wrong fixture session shape causes this extra write. Falsifier: a legal saved
  empty session atversion1 still emits an empty PUT on the actual consumer.

Read full source: App beforeunload calls flushGraphSaveBeacon; storeGraphSave.ts
guards empty nodes only when activeSessionGraphVersion>0. With seededwp02-session,
version0 and nodes[], it sends PUT /api/sessions/wp02-session/graph, If-Match0,
reasonbeforeunload, keepalive:true. gitdiff fromWP01 shows no change to that owner.
Each reload correlates with one rejectedPUT, including four catalog reloads.
The fixture declared graphVersion0 (never saved), not a savedempty session.

Plan: prove actual helper version0->PUT versus version1->noPUT with capturedfetch
and isolated Map storage. If proven, only change J6's synthetic session graphVersion
to1, which is a legal already-saved empty graph; selection/reload tests do not test
graph creation. Preserve all strict mutation guards. No graph/API production edit,
no new allowed mutation, no suppressed unexpected counter or skipped reload.
Broader graph persistence behavior remains unchanged and not certified by this WP.

Actual consumer proof executed:14 action testsPASS. The new test captures exactly
the PUT URL/method/If-Match0/beforeunload/keepalive/empty arrays atversion0; toggling
only graphVersion to1 emits no additional request. It loads the real unchanged
flushGraphSaveBeacon with synthetic storage/fetch; no provider or real server.
This confirms H1 and the fixture-state cause; no production graph regression was
introduced. Implemented onlygraphVersion1 and included pathname (not query/body)
in unexpected mutation diagnostics. Counters/guards/reloads remain unchanged.
