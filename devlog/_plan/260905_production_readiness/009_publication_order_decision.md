# WP11/13 publication ordering amendment (A round1 R1-10)
Status: design amendment, not an executed Pages or registry mutation.
This 009-range document records the delivery decision and ownership; executable
workflow/script details belong in WP11 110 and operational sequence in WP13 130.

## Decision and rejected alternatives
Keep the currently published site/installer until its compatible stable package
has been verified. Remove automatic main-push Pages deployment for this release
contract; Pages becomes explicit, revision-bound workflow_dispatch. Main dispatches
it only after canonical stable release and installed-package smoke.
Reject falling back from new offline installation doctor to old standard doctor:
that reads auth and is not equivalent verification. Reject a hardcoded guessed
version threshold, trusting a "ready" marker, or silently publishing preview as latest.
Reject relying on "release usually finishes quickly": two approval gates can keep
the mismatch open indefinitely.

WP11 owns .github/workflows/pages.yml and a small published-site compatibility guard
plus negative tests. WP12 consumes that workflow integrity as a prerequisite;
WP13 dispatches and verifies deployed page/script revision after package proof.
All previous "no workflow edits" statements exclude canonical release.yml/publish.yml,
NOT this explicitly admitted Pages coordination. No changes to GitHub repo settings.
No automatic reconfiguration of Pages environment/protection or account credentials.

## Required externally observable order
Old Pages remains live -> merge code into main -> canonical release candidate,
preview proof and stable publication -> verify published stable artifact/install
mode -> explicit Pages workflow on exact published commit -> artifact/site smoke.
A Pages guard/build/deploy failure leaves the old site and goal incomplete; it is
not proof package release failed, nor permission to bypass compatibility checks.
An old package with new installer or mismatching gitHead must stop before uploading
a Pages artifact. Site-only later changes require a separately designed compatibility
path; this task does not invent one.

## Proof classes and limits
Source unit tests validate ordering/guard inputs, not actual Pages deployment.
WP13 needs workflow success plus HTTP readback of installer bytes at the deployed
site matching the verified release source. CDN propagation is checked with bounded
polls; unchanged state is not reported as done. Keep previous-site artifact/ref as
diagnostic evidence. After npm latest moves, old-version Pages redispatch is not
permitted by this gate: recover forward with a corrected verified release.
Never delete hosted content as cleanup or imply that installed CLI rollback also
rolls back the hosted site.

No user media/credentials are needed. No paid provider generation. Node/npm are the
existing pinned release toolchain; keep site framework/dependencies/lock unchanged
except using npm ci instead of npm install for deterministic build.
