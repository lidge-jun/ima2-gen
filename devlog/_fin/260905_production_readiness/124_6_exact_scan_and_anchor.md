# WP12 C — exact scan and one stale source-test anchor

CodeQLanalysis1731590212 is bound to fae494f94eda4259d13e6da3114a83a3fd1c0d2e,
with no analyzer errors/warnings and67open findings. All returned instances carry
that same SHA. Snapshot: wp12/fae494-codeql-alerts.json. Eight new IDs96..103 arise
in the changed/extracted path/request owners; independent exact-source review is
running. A reduced count is not clearance, and new IDs are not automatically bugs.

FullCI34028152854 root lanes failed at a stale source anchor in
tests/nai-routing-contract.test.ts: it looked for the removed explicit union type
in `let resultFormat`. The H1 fix removed that unchecked cast/type assumption while
preserving provider selection. Updated only its exact anchor to `let resultFormat =`;
the three-site isolation and prohibition on forcing JPEG for NAI are unchanged.
Focused8cases passed. Other lane-specific failures must still be read independently.

## Correct the provisional Critical19/20 source descriptions

The actual reported sinks are Buffer length/signature checks, not original-name
or query.kind handling.19 is localImportStore.detectFormat:14;20 is
assetDerived:140. Both use short-circuit !Buffer.isBuffer before accessing Buffer
length/subarray. JSON data cannot manufacture a Node Buffer or executable method.
imageImport additionally supplies Buffer.alloc(0) for non-Buffer request bodies;
createLocalImport rejects that before persistence. Earlier unrelated scalar/header
observations are valid code facts but are NOT proof for these two alerts.

For direct negative evidence, extend only the existing local-import and derived
owners with JSON object/array/fake-Buffer bodies. Their existing bare fixtures now
include the actual server's express.json stage before raw route parsing. Assert
typed400 (not500) and no new generated files; preserve raw PNG success tests.
These route tests are hosted-only; no local real app/account graph was loaded.
No production guard change or new harness. Pending runtime outcomes are not passes.

Medium13: direct pure configKeys import (no config/account module) rejected five
prototype-bearing keys; all37writable paths have no prototype/constructor segment.
The config CLI checks that Set before setNestedKey. Defaults use fixed MODEL_KEYS,
REASONING_KEYS or a kind gated by exact image/video comparisons. This falsifies the
claimed hostile-key path for those actual callers; it does not certify arbitrary
direct invocation of the low-level helper on a hostile object.
