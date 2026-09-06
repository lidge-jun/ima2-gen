# WP12 C repair — four source-confirmed path defects

Independent audit Boyle overturned provisional path dispositions. Main accepts
H1–H4 after reading the actual producers and sinks; no live provider or destructive
user-file reproduction occurred.124's37guarded candidates are NOT cleared.
These repairs satisfy the existing mandatory CodeQL task, not a new feature/test
platform. Current C acceptance remains blocked until repairs and evidence pass.

## Root causes and scoped decisions

H1: nodeGeneration assigns request format through a TypeScript cast for API/OAuth;
saveNode interpolates it into a path. Upstream execution options do not validate
that value, and best-effort metadata embedding does not stop unsupported formats.
Fix at owning input/write boundary: admit only actual supported image extensions
(confirm existing png/jpeg/webp contract and any supported aliases), reject invalid
format before provider work, and ensure saveNode cannot write an escaping filename.
Keep server-minted node IDs, successful output behavior and valid legacy reads.
Files: lib/nodeValidation.ts, lib/nodeGeneration.ts if its call contract requires
format wiring, lib/nodeStore.ts; existing provider-execution-node/node-validation
tests or extend the new isolated node-store-metadata owner for write negatives.
Activation proof uses malicious format, a controlled successful image adapter,
an owned outside sentinel and zero outside writes; no paid/provider request.

H2: MCP stitch selects body requestId unchanged, and inserts it into tempOut before
ffmpeg output/copy/cleanup. Validating input files does not constrain this output.
Keep public job identity/correlation unchanged; remove requestId from filenames.
Use existing crypto randomBytes to mint an independent flat concat tempfile under
generatedDir and clean only that owned path in finally, including concat failure.
Files: routes/mcpMedia.ts and tests/mcp-media-action.test.ts. Existing concat and
persistence seams remain; hostile ID must not alter output/cleanup parent, while
ordinary stitch still completes once. No new temp-manager or generic path checker.

H3: restore permits trash root equality, then appends .json outside that root;
ordinary source/destination parent symlinks also lack canonical checks. Before any
rename, require a strict descendant regular source file (not root/directory/link),
canonical containment in trash root, and similarly validate optional sidecar.
Resolve destination inside generated root and verify its existing parent resolves
within canonical generated root; support nested valid filenames without following
outside parent links. Missing optional sidecar remains valid. Do not move media
before discovering an unsafe sidecar. No user-data migration, deletion or silent
fallback around permission errors; preserve existing restore return shape.

H4: asset regularity checks reject links but not directories; root equality is
allowed. Require strict-descendant filenames in resolveInGenerated and isFile()
in assertRegularGeneratedPath. This prevents a single-asset trash operation from
moving all generated media. Keep normal file trash/permanent-delete behavior and
existing canonical/link checks; never weaken them to satisfy a fixture.
H3/H4 files: lib/assetLifecycle.ts; existing backend/history owners plus NEW
tests/asset-lifecycle-path.test.ts only if needed for a pure isolated file owner.
Mock config/DB/system-trash before import; all mutations confined to owned temp
roots, with spies proving invalid/root/sidecar/link inputs cause zero moves/deletes.
No local real app or OS trash. Actual route/full tests execute hosted only.

## Verification boundaries

Main owns asset lifecycle and integration; independent workers may own H1 andH2
with disjoint files. Explicit model=gpt-6-astra, reasoning_effort=high. No leaf
dispatch/Git/FSM or broad framework. Same reviewer rechecks blocker closure; fresh
runtime checks are still required. Existing video symlink test's MP4-error oracle
does not prove canonical rejection; record that limitation instead of expanding
the current fixes into a general test-hardening project.

After focused red/green, regenerate existing inventory/docs, run typechecks, then
full CI on the resulting exact SHA. Preserve normal/error/cancel flows and no
outside side effects. Canonical prechecks do not claim atomic protection against
concurrent privileged OS file replacement. No scanner dismissals or release waiver.

Plan reviewer Boyle PASS. Fold-back conditions: retain supported jpg alias; do not
expand write validation into legacy reads. commitMediaResult already cleans before
done, so stitch must not add a later cleanup error after success. Restore destination
parent may equal canonical generated root; dangling sidecar links are unsafe, not
missing. Zero-mutation assertion applies to restore preflight, not pre-existing
permanent-delete ordering. resolveInGenerated stays lexical for not-yet-created
derived outputs; isFile belongs only in the existing-asset check.

Main fallback inspection: trashAsset's rename fallback currently appends the
original request filename after a timestamp. A path containing parent segments
can normalize safely at the generated source yet differently at the trash root.
Mint that flat fallback name from basename of the already resolved source, keeping
ordinary output naming. This is the same23/24 destructive sink, not a new helper.
