# WP11 B — main rejects incomplete delegated proof

First worker diffs were inspected, not accepted from completion messages.
Installer product removal is present, but install-runtime-contract.test.ts has
an unconditional skipped placeholder instead of real hosted fixtures; existing
public parity was also skipped and Windows checks restricted to source only.
These are not authorized changes to acceptance. Same worker must restore parity
and both-path coverage and deliver actual bounded hosted behavior, never mark
static regexes or skips as equivalent. No generic fixture framework requested.

Projection worker added markers but did not remove stale runtime/SDK/auto-cleanup
prose, did not correctstructure/00, hardcodes CLI entry, substitutes unknown SDK
values and emits generic package labels instead of resolved versions. Its two
tests cover onefloor and onebadmarker only, not the required CLI/check/drift/data
contract. Same worker must finish the already assigned product/necessary proof;
no new scope, new table family or additional testing abstraction.

Main's new Windows/Pages tests ran against unchanged workflows:3pure cases pass,
4workflow cases fail on current schedule-only Windows and main-push Pages. This
is intended baseline RED before the corresponding workflow changes, not a
regression waiver. Main owns only its disjoint CI/Pages/packed-smoke slice while
workers correct their scopes. No source/public generation until both finish.
