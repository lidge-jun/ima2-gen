# WP06s B — implementation checkpoints

Status: B in progress. Not a C verdict, c-18 completion, platform approval or release.
Base: ef0e80a2. Main session 01a06e88-aa93-77b2-a99a-fc10f8458eb2.
A closure: same Godel2 approved amended d170a720, both blockers closed at plan level.

## Core reader checkpoint

e711121a adds lib/agyArtifactRead.ts, fixed AGY_ARTIFACT_POLICY, its overflow error
map, lexical policy exception and emitted-pair manifest entry. Reader metadata uses
BigInt identities and a private WeakMap receipt. Root/candidate mapping is checked
before reading, after reading/close and before exact-file cleanup. Chunk coalescing
avoids retaining one whole allocation per short read; one extra byte detects growth
past the inclusive limit. Cleanup uses unlink/nonrecursive rmdir and leaves siblings.
Filesystems without a positive inode identifier fail closed rather than claiming
identity-based verification. No test-only reader helper or public size override.

Main follow-up preserves existing error precedence: lexical membership in source
or canonical approved roots is checked before candidate lstat. An outside-root
missing path remains AGY_PATH_REJECTED; a missing file inside a root remains
AGY_ARTIFACT_NOT_FOUND. Canonical containment still follows realpath, so this is
an early rejection, not a substitute for the descriptor checks.

Executed current build:server exit0. Main emitted-JS smoke reads an independently
fixed 68-byte PNG, verifies bytes and BigInt identity, rejects cleanup authority
from a copied/unissued receipt, removes only the accepted artifact and preserves
a sibling. Repeated cleanup is inert. Both missing/outside error cases pass.
Raw: session wp06s/reader-smoke.txt; executable: reader-smoke.mjs. The same smoke
owns and removes its isolated root; no provider calls, real Agy launch or user data.
error-class-coverage.test.ts: 4 pass, 0 fail, 0 skips.

These smoke results are narrow: they do not prove cancellation/identity-swap
adversaries, all caller paths, hosted 50MiB bounds, Windows or final UI behavior.
Independent test/operation/CI workers and a read-only reader reviewer are active.
Their remaining evidence must close before C/D. Existing scripts/recording/ is
untouched user work. No stack merge or release occurred.

## B reader review — primary EIO preservation

Curie2 (01a071d8-ec44-7733-a3e3-94cdae631d0f) returned GO-WITH-FIXES with one
Medium blocker: inspectCandidate/validateMapping catch-all branches replace
native EIO with AGY_PATH_REJECTED, so outer openChecked cannot preserve it.
Accepted: preserve the original EIO object at candidate/mapping boundaries;
root-discovery failures stay safe policy rejection. This follows the audited
primary-error contract and does not authorize cleanup or return on failed I/O.
Add actual initial/post-read metadata EIO checks, then request same-reviewer
closure. No other concrete reader blocker was reported by the read-only review.

Main runtime evidence: reader-smoke.mjs --eio injects the same owned EIO object
at initial and post-read candidate metadata visits. Before the correction both
reported AGY_PATH_REJECTED/sameError=false and exited1 (metadata-eio-red.txt).
After rejectPathOrIo and build:server exit0, identical invocations report
EIO/sameError=true at both points and exit0 (metadata-eio-green.txt); the ordinary
68-byte emitted smoke and cleanup checks still pass. Durable tests are being added
by the artifact-test worker; final independent C evidence remains outstanding.
