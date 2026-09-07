# WP12 C — existing asset canonical boundaries

New CodeQL96..99 review proves lexical traversal is rejected but does not clear
pre-existing Canvas media/sidecar links. Main accepts the gap under the same
storage-boundary policy used for restore: a requested generated asset must not
read/overwrite files outside configured generated storage, even if an existing
entry is a link. This is not a newly claimed remote symlink-creation primitive.
Do not narrow the threat model just to mark findings false positives.

Additional main source observation: Canvas ensureInsideGeneratedDir currently
permits root equality, then readGeneratedMetadata appends .json. A sourceFilename
of dot can therefore read the generated-root sibling .json if it exists. This
is the same root/suffix boundary error as restore, without a symlink requirement.

Scoped repair owners:

- lib/canvasVersionStore.ts: retain lexical resolver but reject root equality;
  resolve canonical configured root and validate existing media/sidecar before
  read/write. New output files may be absent; existing file links/directories must
  not be treated as absent. Prevalidate both image and optional sidecar before
  writing image, so an unsafe sidecar cannot cause a partial overwrite. Preserve
  normal create/update/bake/revert and existing error/return behavior where safe.
  No external/public API, database schema or new transport/tooling abstraction.
- lib/nodeStore.ts: existing image/asset readers still use lexical-only paths.
  Reuse its metadata-reader canonical-root check internally for these real read
  consumers before bytes are read. Preserve valid legacy IDs and internal aliases;
  no additional character allowlist or unrelated write policy.
- Existing isolated tests/canvas-version-normalization.test.ts and
  tests/node-store-metadata.test.ts: use owned roots/sentinels and dependency mocks;
  cover normal files, root/sibling metadata, media/sidecar links and zero outside
  I/O. No local real app, account module, provider or OS-trash execution.

Functions stay private/scoped to their existing owners. Canonical checks do not
claim atomic safety against a concurrent privileged writer replacing filesystem
entries. Native Windows junction cases and final exact-head CI remain required.
Source/test review and focused red/green precede the next full candidate. Preserve
all existing positive cases and do not add an independent checker/harness package.

Implemented in the two existing owners and tests. Canvas invalid-link/root-suffix
cases failed against the prior source with the owned I/O spy refusing outside
access; after correction all8Canvas cases and20Node cases pass. Normal create,
update,bake,revert, internal Node aliases and missing-file behavior are retained.
Reviewer found one missing-bake404 regression; main restored the original metadata
404 ordering before checked image reading and added the activating missing case.
Same-reviewer final PASS/blocking_issues=[]; no unobserved runtime claim.
Source/test typechecks and server/CLI emission also passed during this patch.

For remaining rate-limit report evidence, the existing hosted app owner now sends
the configured120non-mutating-to-state POSTs to an unknown API route, then verifies
the next mutation receives429/API_RATE_LIMITED before malformed JSON could reach
the parser. Read health remains available. No production policy override or test
route was introduced; those endpoints remain404. Hosted execution is still pending.
