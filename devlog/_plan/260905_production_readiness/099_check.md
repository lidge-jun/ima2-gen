# WP09 C — scoped release-facing verification

Authority:098_scope_lock.md. No further test-infrastructure expansion.
Source candidate:897026500bac07a790aa7710856fdbdc9b5cc0ed; PR211 remains draft.
Actual B→C transition recorded for session01a06e88-aa93-77b2-a99a-fc10f8458eb2.

Verified: single-job startup diagnostic34001495156,5 passed in32.5s. The two
platform paths stay unreadable, write attempts remain unexpected, and all three
primary-config variants plus normal emitted startup/model discovery pass.
Evidence:session/wp09/89702650-startup. This is not whole-WP or release success.

In progress on that exact source: fullCI34001638768 and CodeQL34001640426.
Next: inspect actual UI results and directly open the original NAI sidebar/bottom/
mobile screenshots plus core transition/readiness/recovery frames. Repair only
observed product defects or demonstrably incorrect test assumptions. Required
final-head checks, scoped review/receipt and D closure remain pending.

Verification: pending. Stack merges: not performed. Release: not performed.
Frontend SoT updated to describe implemented ownership without claiming a visual pass.

FullCI34001638768: both Node/package legs pass; CodeQL comparison93→93 with no
new IDs/severity changes. UI was cancelled at the20-minute job bound, so there is
NO full native pass. Dot reporter emitted240 outcomes with10 failures before
cancellation; mapping to the exact --list identifies J4, both bottom-short themes,
six mobile navigation locale/width cases and T6. Remaining cases lack terminal
outcomes. Screenshots/metrics were uploaded and retained.

Main directly opened original NAI sidebar/bottom/mobile short captures. They show
the paired-pane/toolbar layout, not an unexplained extra footer gap; bottom/mobile
captures reflect their measured scroll state, so do not mistake them for initial
unscrolled frames. Additional short-height and navigation failures remain open.
T6 evidence specifically records POST/api/metadata/read unexpected-mutation while
all mirror metrics/screenshots and teardown were produced; that fixture must model
the synthetic attachment's metadata read without admitting arbitrary mutations.

Next single diagnostic job runs only the four distinct observed failure families
(J4, bottom-short dark, mobile320en, T6) plus the unchanged isolation dependency.
Built-in line reporter retains immediate error details; bounded test-step time
leaves upload time. No fullCI rerun or blanket timeout/allowlist relaxation.

Observed product repair, not a new test gate: at1440x600 the bottom dock is312px,
composer292px, but the editing scrollport is only51px. Both textarea floors are
already86px or greater (rejects a textarea-floor hypothesis); scrolling works
(rejects a broken-scroll hypothesis). The empty disabled reference tray consumes
48px plus layout gap even though NAI cannot attach references. Hide ONLY that empty
tray in the short-height NAI bottom composer. Keep retained references, other
providers/surfaces, the52vh/420px cap and86–148px input bounds unchanged. Existing
short-height contrast/control tests must verify the repair; no assertions relaxed.

Focused run34002750849 at58ccaab5:26pass/2fail. T6 metadata fixture correction
passes; J4 passes unchanged in this run (not a claimed fix for its earlier outcome).
Short dock fails flat-background sampling because its51px scrollport clips the
input. Mobile320en fails when focused Asset Gen is only0.518 visible. Labels and
focus itself pass, rejecting missing-target/label-size hypotheses; active-item
reveal runs only on mode/settings changes, not keyboard focus. Reuse that same
nav-local reveal on focus capture. No document scrolling, target shrink, assertion
relaxation or new test case. Next run is the same focused diagnostic against fixes.

The truncated full-run dot stream did not identify each failure by name; its
position-to-list mapping is diagnostic inference, not proof of a J4 failure or
flake. The named focused result is authoritative. Next single job checks only
the two remaining named failures, keeping the original isolation dependency.
After these grouped fixes pass, full CI checks the retained suite including core
cases lacking terminal outcomes. No unrelated diagnostic matrix or new test.

Product-fix checkpointc7e027f01eeb41328d5955f14fc23f5868184fd5:
focused run34003201468 SUCCESS. Both named UI failures now pass alongside the
unchanged isolation dependency. Main will directly read the new frames and then
run final fullCI/CodeQL. Full CI uses the built-in line reporter so a cancelled
run cannot erase test names behind buffered dots; no case, threshold, timeout or
isolation rule is changed by that logging choice.

Main directly opened c7e027f0 short-dock and320px navigation PNGs after the26-pass
run. The short dock now exposes prompt text and enabled toolbar actions without
the unsupported empty tray. Navigation's final Home state remains horizontally
scrollable; focused-item completeness is proven by the unchanged0.99 viewport
assertions throughout keyboard traversal, not by pretending all seven items fit
simultaneously in320px. Final full-suite success remains pending.

Full candidate0b898e0a/run34003607293: Node22/24 andCodeQL pass; named UI output
confirms only J3's expected upstream prompt mismatch before cancellation at case253.
The actual request retains the typed prompt and appends the existing1024x1024
size constraint. lib/sizeNudge.ts is unchanged from the parent; direct mode does
not remove this policy. Correct the two independent literal expectations including
that exact suffix, keep full equality and distinct first/retry prompts. No product
generation behavior, token/key policy or assertion strength is relaxed.

The serial retained suite reached253/258 at20 minutes; normal late cases were
progressing at roughly5–8s each. Increase only the aggregate E2E job budget to25
minutes so remaining cases and uploads finish. Individual test/expect limits,
all cases, isolation dependencies and assertions remain unchanged. This does not
fix or excuse J3. Diagnose J3 alone (+required isolation) before another full run.

J3 correction at56308093/run34004614504 passes its single diagnostic job. The
remaining unfinished tail from the cancelled full run is the existing Node fit,
composition-interruption and reference-control cases. The Node390 capture was
not yet written at cancellation, so do not infer its appearance or outcome. Run
only that retained tail plus isolation before the final25-minute aggregate job;
no new tests, scenario permutations or runtime guards are being added.
