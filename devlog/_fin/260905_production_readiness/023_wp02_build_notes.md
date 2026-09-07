# WP02 B checkpoints

Main pure policy and storage boundary:15 focused tests pass; tests typecheck0.
Core module141lines, storage58lines; memory key appended atindex20 without moving
existing keys. Future-version memory survives explicitv1 writes; supplied lane
records replace rather than resurrecting deliberately cleared slots. Legacy active
keys stay authoritative; no read repair, no history write, no network.

The first memory harness bundle entered at the storage module and exposed the
existing storePersistence->size->i18n->useAppStore initialization cycle before the
VIDEO_DEFAULTS_FALLBACK constant was initialized (undefined.model). A reviewer had
also hit this baseline ordering when probing a non-App entry. The harness now
enters through the real useAppStore first, then exports the real storage functions;
no module implementation is replaced.15 tests pass with that natural initialization.
This does not certify production browser startup: exact-head hosted built UI still
must execute in C. Any actual App startup failure blocks C and must be fixed.
The harness uses esbuild write:false IIFE with a named evaluation frame, avoiding
data-URL stack traces that dump the entire source bundle into a test log.
It measures explicit operation writes after unrelated initial browserId registration.

Parallel worker deltas are still in progress; this checkpoint is not whole-WP green.
