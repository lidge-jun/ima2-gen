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
