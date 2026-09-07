# WP11 C — bounded existing Windows compatibility repairs

Frozenf327f9c9 fullCI34013352539: LinuxNode22/24 succeed; WindowsNode24 root
reports3250tests/3203pass/41fail/6skip. Windows installer step actually executed
all8scenarios,2tests/2pass/0skip, with named calls and sentinelAlive. WindowsNode22
also reports a root-suite failure. No final acceptance/merge/release claimed.

Hypotheses: H1 new installer failure (falsifier: its native8rows pass before root
suite; confirmed); H2 Windows path/launch representation mismatch (falsifier:
failure values are already platform-normalized; several clearly are not); H3
native OS/refusal/watcher behavior differs from test premise (falsifier: fake
host and native semantics agree; inspect each before editing). No retry of the
excluded066artifact-content/provenance probe. This is the existing registered CI
suite, not that separate tool-blocked auxiliary probe.

| Existing owner | Observed failure and minimum action |
|---|---|
| tests/_actionPins.mjs, ui-gradient-manifest-contract.test.ts | Native backslashes disagree with the declared POSIX manifest keys. Normalize existing repository-relative output; retain all pin/gradient checks. |
| tests/j6-isolation-preflight.test.mjs | Synthetic Linux process/home uses real Windows path/url module semantics. Bind its existing mock modules to POSIX semantics only; do not change actual J6 guard or permit real Windows/Linux home access. |
| tests/vectorize-cli-contract.test.ts | execFile npx yields ENOENT on Windows. Invoke pinned process.execPath with the existing tsx loader, no shell or network npx lookup; same actual CLI and assertions. Hosted only. |
| tests/stop-command-contract.test.ts | Windows returns term for SIGTERM and processControl deliberately returns unknown for POSIX birth-time corroboration. Assert those explicit platform contracts without skipping tests or changing processControl protection. |
| registered Agy driver contract and _executionTestProcess.ts | Child environment filter excludes USERPROFILE, but Windows native child shows runneradmin. Observe native/loader synthesis with a bounded environment-presence probe; keep home/config/credential exclusion, never simply allow the path to pass. |
| tests/_videoFfmpegFixture.ts | ownedPath canonical parent enters assertInside; reject reports could be case/alias-equivalent root. Collect relative-empty/absolute booleans first. Keep symlink/hardlink/type/bounds checks; no arbitrary-root exception. |
| UI build receipt transaction | beginUiBuild sees an actual watch event during initial snapshot. Cause remains unexplained; record actual event/filename in an owned fixture before any change. Do not disable watcher, ignore changes, add sleep/retry or claim this passed. |

Use one narrow WindowsNode24 diagnostic CI job with existing dependency/build
commands, the failing files and bounded observation steps. No browser build,
full-suite rerun, new runner abstraction, receipt format, or blanket permission
changes during diagnosis. Batch confirmed fixes; then rerun complete required CI
and CodeQL at the final candidate. If watcher repair needs a new architecture,
stop for direction rather than grow a testing platform. Existing WP12 macOS
watcher and security work remains open, not silently completed here.
