# WP02 C repair synthesis

## Indexed persistence registry assertion

At4aec25b1, post-dispatch impact search for PERSISTED_KEYS found one stale test in
tests/nai-client-options-contract.test.ts:227 requiring naiOptions to be the LAST
entry forever. Focused execution:17pass1fail. New coreSelectionMemory was correctly
appended atindex20; existing NAI key and exported constant remainindex19. The old
assertion prevents every future append despite its stated append-only intent.

MAIN C scoped verifier repair: assert naiOptions at historicalindex19 (plus its
exportedconstant), preserve unrelated NAI assertions. Add independent whole-prefix
key sequence in core-selection-memory.test.ts so inserting/reordering any of the
twenty historical keys still fails; new key isindex20. Do not reinsert keys or
change production registry for the obsolete assertion. Exact-head CI must rerun
after this correction; current4aec25b1 run cannot certify the eventual source.
Leave the in-progress browser job running to collect any actual runtime failures;
do not label the run green or merge on its partial result.

## Hosted path-metadata false positive

CI33945116628 completed FAIL. Both Node legs failed only the obsolete registry
tail assertion above. WP02 browser beforeAll failed before fixture spawn on
AZURE_EXTENSION_DIR and XDG_CONFIG_HOME;8 scenarios did not run,9 unrelated E2E
passed. Artifact9963119087 contains failedpreflight JSON, no WP02 render proof.

RCA: broad env-prefix refusal treats directory metadata as a provider credential.
Do not unset HOME, hide an alternate config root, blanket-allow AZURE_ variables,
skip preflight, or call this runtime success. MAIN repair adds two exact checked
path exceptions only: XDG_CONFIG_HOME must be the canonical nonlinked runner
home/.config (or absent on disk with no credentials); Azure extension directory
must be canonical /opt/az/azcliextensions, root-owned and not group/world writable.
All credential env patterns, home/auth-store/dotenv/mount guards remain. Both
metadata vars are excluded from the spawned child's existing env allowlist.
Any different path remains blocked. These allowed paths are design bounds, not
claims that the first CI recorded their values; next exact-head run must prove
them and emit only validated path metadata in its isolation receipt.

Fixture reviewer found one Medium in that candidate: existsSync=false also means
a dangling symlink, not genuine absence. Accepted; lstat must precede the absence
decision, and only ENOENT on the exact XDG path qualifies. Symlinks, EACCES and
other errors remain blocked. The new synthetic-host preflight test runs actual
bundled appServer code with injected fs/os/process inputs and spawn/socket methods
that throw; it tests allowed paths, wrong paths, credentials, ownership/mode,
dotenv/auth/mount refusal, localhost refusal and dangling-symlink behavior. No
actual HOME change, credential read, server or local browser is involved.
