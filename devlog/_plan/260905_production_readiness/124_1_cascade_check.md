# WP12 B checkpoint — verified ancestry cascade and native stack

PR214 merged normally into dev at66a4f9989e14f8bacd657f7d6c7c82599ae8ecb4;
API state MERGED, mergedAt2026-09-06T10:04:53Z, and fetched-dev ancestry exit0.
Its exact-head fullCI34025858936, PR Fast34025766504, CodeQL34025766435 and
independent re-review all passed atd48396ec. Baseline Windows job was schedule-only
and skipped; this is not cumulative Windows proof. This is one infrastructure
prerequisite merge, zero feature-stack merges, zero releases.

Merged the new parent into each task-owned branch bottom-up, preserving original
commits. Every lower tip is verified ancestor of its child. For199..213 the
before/after file delta is exactly the three prerequisite files (workflow depth,
history regression, generated inventory). Only generated inventory conflicts were
regenerated in those layers. Main WP12 additionally had a checkout-comment/ref
conflict: inspected the three-way diff and retained explicit merge ref plus full
history. Its merged tree is byte-identical to67fd7bf4; only ancestry changed.

Main checkout remains /Users/jun/Developer/new/700_projects/ima2-gen, current
branch codex/prod-wp12-readiness, HEADd20b0cb29212681f4de9e02cb3c9a778d9cf0190.
Only user scripts/recording remains visible as untracked. No force, reset, branch
deletion, unrelated write or shared main/dev ref replacement occurred.
All17 task branch updates were pushed atomically. Live PR heads/base edges were
checked against recorded expected values before native registration.

Native GitHub stack216 now exists, base=dev, members in order:
199,198,200,201,202,203,204,205,206,207,208,209,210,211,212,213,215.
POST creation and subsequent GET membership both return these same heads/order.
This is actual registered membership, not a manual chain or Can Stack banner.
Native stack merges must use the asynchronous merge API; no feature merge yet.

Each refreshed layer has a matching-ref/full-SHA CI dispatch in flight. Seventeen
dispatches succeeded; each output contains its concrete run URL. Cumulative WP12
run34026768048 is bound tod20b0cb2. Prior cc304e80 run34026172889 predates the
User-Agent repair and is diagnostic, not final candidate acceptance.

Full machine-readable evidence:
.codexclaw/evidence/01a06e88-aa93-77b2-a99a-fc10f8458eb2/wp12/history-cascade.json
.codexclaw/evidence/01a06e88-aa93-77b2-a99a-fc10f8458eb2/wp12/cascade-ci-runs.json

User-Agent repair: existing folder assertion failed before change (null header),
then all14folder contracts passed. Same reviewer recheck PASS/blocking_issues0.
Source/test types and generated line-count check passed. No final CI inheritance
across changed SHA. Remaining C work: inspect exact-head jobs/artifacts/screenshots,
finish93alert source/negative evidence, preserve original MCP incident obligation,
and collect every refreshed-layer receipt before declaring history-gate complete.
