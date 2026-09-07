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

Installer retry remains incomplete on direct inspection: shims emit invalid
v20/v22 instead of semantic versions, npm failure fires during --version, success
shims fall through with nonzero status, floor24 still supplies Node20, and owned
timeout/cleanup/sentinel proof is absent. Main retires this actor and reclaims the
already approved test slice now; no further speculative delegation or new fixture
framework. Preserve the useful installer product removals and restored parity.
Consolidate actual platform behavior in the planned install-runtime-contract.ts
so the explicit Windows CI installer step cannot be a platform skip.

Main completed remaining projection/doc omissions, corrected dynamic import to a
file URL for Windows, and restored default-cwd generation while rejecting a bare
--root with no value. Five owned-fixture projection cases pass, real repo check
was RED for stale markers/public copies, then generation made it GREEN. Public
Windows parity now passes without skips. Hosted runtime cases remain unexecuted
locally and will be accepted only from same-tip CI.

Windows source was UTF8 without BOM and contained non-ASCII status markers. Use
ASCII in this short PS5.1 script (including messages/comments); no encoding
framework or test-only source rewrite. Microsoft's character-encoding guidance
confirms Windows PowerShell may interpret BOM-less non-ASCII scripts as ANSI:
[official guidance](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding).
Actual native PowerShell behavior remains the hosted verifier, not a local claim.

Main integration: runtime projection/check clean, source/public Windows checks
restored and passing, local named set48tests/47pass/0fail/1hosted-only omission.
Both typechecks passed; inventory updated through existing script. The actual
hosted installer test is the remaining necessary runtime proof, not a local pass.
Harvey01a0750f-a7b8-7532-9de9-958ddef76cdc reviewed the main-owned CI/Pages/packed
boundary atfd24adf6, ran7focused tests and found no concrete defect. Main read
code/outputs independently. All worker actors are retired; no peer writes remain.
