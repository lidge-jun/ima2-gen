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
