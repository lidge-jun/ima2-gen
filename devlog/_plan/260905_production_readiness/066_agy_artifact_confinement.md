# WP06s — confined, bounded Agy artifact ingestion

Status: new docs-first corrective unit, registered during WP06 P. No implementation
in WP06 B. One full PABCD and one implementation PR, after065/wp06m and before070.
Semantic input: WP06's extracted agyArtifact/agyOperations and lifetime barriers.
Branch codex/prod-wp06s-agy-artifacts; base the verified wp06m tip. c-18 and WP13's
agy-artifact-gate prevent merge/release until this outcome is verified.

## Grounding and scope

At54543ee0, an actual findRecentAgyArtifact invocation with explicit owned roots
selected ima2_generated_link.png, a file symlink to a sentinel outside its search
root. Reading the selected path yielded the sentinel's SHA256. The separate
directory-symlink test already passed: it does not cover file symlinks. Evidence:
session wp06/symlink-baseline.json and unchanged adapter SHA25644c62099…ea31f.
No sensitive file, auth store, real Agy process or public network was accessed.

Threat: provider output controls RESULT/SAVED_PATH/fallback candidate path strings;
do not turn these into arbitrary file reads or cleanup outside approved artifact
roots. Reject static symlink/junction escape and detected file replacement. Bound
artifact allocation and preserve explicit cancellation. Do not claim isolation
from a malicious process already running with this user's filesystem privileges,
hardlink provenance proof, or a portable atomic openat filesystem sandbox.
Concurrent path changes detected by before/after identity checks fail closed;
residual adversarial same-user races must be recorded, not called impossible.

Resource/authority: existing repository/CI, temporary fixture roots, zero paid
provider calls. No auth/config migration, real home scan, external files deletion,
native addon/dependency or user-server restart. Local tests use tiny images and
fault hooks; actual50MiB boundaries run only in exact-head hosted CI. Reassess at
4hours/WP and72hours/goal. Main owns goal/FSM/stack; workers have disjoint scopes.

## Exact change manifest

| Action | Path | Required diff |
| --- | --- | --- |
| NEW | lib/agyArtifactRead.ts | canonical-root/regular-file checks, descriptor-owned bounded read, identity receipt |
| MODIFY | lib/agyArtifact.ts | skip symlink and nonregular scanner candidates before stat; retain parse/time/depth/order behavior |
| MODIFY | lib/providers/adapters/agyOperations.ts | replace lexical stat/read sequence with trusted read; receipt-bound exact cleanup |
| MODIFY | config.ts | export AGY_ARTIFACT_POLICY maxBytes=52428800, chunkBytes=65536 |
| NEW | tests/agy-artifact-confinement.test.ts | real owned symlink/junction/root/identity/cancel/cleanup negatives |
| NEW | tests/agy-artifact-read-bounds.test.ts | small allocation guards plus explicitly hosted-only real byte-boundary cases |
| MODIFY | tests/agy-artifact-fallback.test.ts | retain directory tests, add matching-file-symlink exclusion |
| MODIFY | tests/agy-execution-process.test.ts | real operation consumes only accepted artifact and preserves499 cleanup |
| MODIFY | tests/error-class-coverage.test.ts | only required named-policy/error contract updates |
| MODIFY | docs/API.md | rejection/resource error vocabulary and allowed artifact boundary |
| MODIFY | docs/migration/runtime-test-inventory.md | new tests |
| MODIFY | structure/01-file-function-map.md, structure/03-server-api.md, structure/07-devlog-map.md | source owners and boundary/evidence |

No files deleted, no public request/persistence fields added. Existing adapter
facades remain unchanged. Emitted JS is rebuilt, not hand-edited/committed.

## Trusted read contract

New `readAgyArtifact(path:string,signal?:AbortSignal):Promise<AgyArtifactRead>`:
return `{buffer:Buffer, canonicalPath:string, identity:{dev:number,ino:number},
approvedRoots:readonly string[]}`. Internal data only; never serialize receipt or
roots into API/SSE/history. Export a cleanup helper from the same owner or consume
the receipt in agyOperations; do not split validation and use across raw paths.

1. Pre-abort499; require an absolute path. Canonicalize existing approved roots
   from homedir/.gemini, homedir/.cache and tmpdir; missing roots do not broaden
   policy. Preserve intentionally relocated root symlinks by canonicalizing roots.
2. lstat the candidate and reject a leaf symlink/nonregular file. Resolve its
   canonical path; path.relative against canonical roots must denote containment,
   not prefix resemblance. Parent-directory escape, sibling prefix and traversal
   outside every root reject before opening or reading bytes.
3. Open canonical path read-only with no-follow/nonblocking flags where the current
   platform supports them. fstat must be regular and dev/ino must match the checked
   path. Re-resolve/lstat after open and compare root containment and identity.
   Do not silently skip unsupported-platform verification; revalidate flag behavior
   on Windows/macOS/Linux at P and state the actual supported guarantee.
4. Reject stat size over maxBytes before reading. Read with handle.read using
   explicit offsets, chunks<=chunkBytes and at most maxBytes+1 total; reject overflow
   even if size grew after fstat. Abort checks between reads and before return.
   Buffer.concat only after a successful bounded EOF. Always close descriptor in
   finally, including overflow/abort/malformed file/read error.
5. Before returning, revalidate the canonical path/identity and original candidate
   mapping; changed/unlinked/replaced objects fail closed. No untrusted buffer is
   returned before all checks. Do not label this portable atomic-openat security.

Error contract: missing path preserves502 AGY_ARTIFACT_NOT_FOUND; path/symlink/
nonregular/changed identity use502 AGY_PATH_REJECTED without outside path details.
New bounded-overflow error502 AGY_ARTIFACT_TOO_LARGE; cancel499 GENERATION_CANCELED.
Safe messages do not echo artifact paths, provider stdout or sentinel contents.
Verify real error normalizer/API envelopes, not only helper Error properties.

## Cleanup and fallback

Scanner skips every isSymbolicLink entry (file or directory), and only regular
matching files enter existing age/depth selection. Direct RESULT/SAVED_PATH/regex
paths all pass the same trusted reader; scanner filtering alone is insufficient.

On accepted artifact consumption, re-lstat canonicalPath and compare the receipt
before unlink. If identity changed, do not delete the replacement. Never delete an
outside-root or rejected candidate/target. Parent cleanup must use nonrecursive
rmdir and only a contained subdirectory that is not an approved root; a race that
adds unrelated files must yield ENOTEMPTY rather than recursive deletion. Retain
best-effort cleanup without masking primary errors. Known accepted artifacts on
late abort follow the same guarded cleanup; unknown paths are not swept.

## Independent verification matrix

- Valid PNG under each isolated canonical root, including an intentionally relocated
  root, returns exact bytes/mime/usage and removes only the accepted file.
- Matching-file symlink, directory symlink/junction to outside, relative path,
  sibling-prefix path, direct RESULT/SAVED_PATH, nonregular/FIFO and nonexistent
  path: no outside bytes returned/deleted, descriptor/child cleanup complete.
- File/path swapped at pre-open/post-open/pre-return barriers: reject; replacement
  survives. Cleanup identity swap and concurrently populated parent: unrelated data
  survives. These are controlled mutation cases, not universal race elimination.
- Tiny held handle.read followed by abort rejects499 and closes the handle; no
  operation/route persisted success. Controlled read errors preserve cleanup.
- Hosted50MiB exact succeeds;50MiB+1 fails for both honest stat and a file grown
  after stat. Local runs must not select these cases; use the proven inline child
  marker/filter, not a parent filter that executionTestProcess discards.
- Actual mutations removing file-symlink rejection/containment and streamed bound
  each turn their specific verifier RED, then exact restoration GREEN.
- Canonical Node22/24 CI and selected Windows/macOS filesystem tests at the exact
  standalone tip; no unsupported-platform silent skip qualifies as assurance.
- Caller route/curl error and ordinary success, unchanged Google reference/lifetime
  tests, full current UI regression and independent security verification.

At this future P, read platform filesystem docs/current source before finalizing
flag and error details. Revise the design if real platform constraints contradict
it; do not implement a knowingly weaker fallback under the same criterion.

## Rollback and delivery

Revert this layer through the owned stack and rebuild matching runtime. No user
data migration. Rollback reopens c-18 and the release gate; the prior symlink/raw
read behavior is not production-ready merely because it was previously shipped.
Record source SHA, actual platforms, negative sentinels, size/teardown evidence,
remaining same-user race assumptions and PR parent before D. Scanner success or
green old tests are not substitutes for these negative activations.
