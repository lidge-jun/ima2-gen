# WP06 B — implementation and integration evidence

Baseline54543ee0; audited plan a67eea6e, closure12961e51. Gemini native move
checkpoint0fc7b821: main independently compared12declarations exactly and facade
reexports, after worker six-function/five-import/transpile parity checks.

## Implemented current scope (not yet C acceptance)

Seven workers stayed in062 write sets. Google actual owners and legacy removal are
implemented, with required parent-only/plus mapping and classic/live capture.
Agy process uses centralized readonly policy, close-observed TERM/KILL cancellation;
operations own partial staging failure cleanup and final post-ref-cleanup barrier.
Native parser/scanner unchanged;066/c18 remains pending. Private helper extraction
inside assigned files was explicitly approved to preserve function-size limits.

Main updated import AST policy, actual boundary/native-result/capture tests, Agy
node cap guard and existing Gemini parent-only expectation; Atlas/MiniMax untouched.
Source typecheck and server emit passed. Main five-file regression: boundary87,
node25, import14, error-map4 and prompt script1 substantive checks, all passed.
Tests typecheck, CLI build and inventory also passed. These are partial B outputs,
not current-tip CI or a final C receipt.

Workers reported Google24+Gemini transport34+public wire4, nativeAgy33 (includes
parent test wrapper) and cleanup6 passing. Main's independent combined replay
then found an integration flake; worker PASS was not accepted as final proof.

## Native receipt signal repair

The timeout test failed waiting for a ready receipt with child pid3742 still alive;
its independent watchdog reaped it and the isolation ledger correctly failed.
ps confirmed pid3742 absent. The fixture used filesystem watch notifications to
discover durable JSONL receipts. Those notifications are not a reliable handshake;
the exact reason for this missed notification is not proved by the failing output.
There is no evidence this was a production Agy timeout failure.

Main replaced only the test receipt transport with native IPC. The strict spawn
guard still verifies the DUT requested exactly3pipes and the fixed executable/argv/
env. The private bridge adds a fourth IPC channel after validation; stdout/stderr
remain exact native parser inputs. Child still appends independent file receipts;
close verifies IPC messages equal the persisted records. Windows bridge now uses
the same owned content-validated executable copy, not a separate unchecked source
path. This is fixture infrastructure, not a new production mode or network channel.

After this repair, the native parent group reran32/32 pass, including the previously
failing timeout and native TERM-ignored cases. Full combined replay and repeated
native-group stability checks still precede final acceptance. A watchdog reap in
an ordinary scenario remains failure; the deliberate missing-KILL test expects and
asserts that failure rather than waiving the violation ledger.

## Legacy fixture import isolation

agy-artifact-fallback statically imported the adapter before test setup; refs/config
can be loaded through that graph. It now uses executionTestProcess and installs
isolateExecution before dynamic DUT import. Eight scanner cases are unchanged;
this is not066's file-symlink fix. Future local commands give an owned empty config
upfront in addition to fixture isolation, and never claim env-i alone changes the
OS-reported home. No actual provider/token call was made by the prior replay.

Remaining: complete refreshed focused proofs, real source mutations/restoration,
independent C review, exact-head CI/CodeQL, manual HTTP and current UI regression.

Main refreshed19-file scoped run passed after IPC/import-isolation repair. Three
additional native parent-group runs each reported32/32 pass, including readiness,
TERM-ignored and timeout ordering. The complete run also passed the deliberate
watchdog/violation test. Current tests semantic typecheck and line-count drift
check passed. Raw logs live under session wp06/0fc7b821/focused; that head still
had uncommitted integration changes, so these are B-worktree proof, not final SHA
acceptance. C must rerun its receipt after the source checkpoint and any repairs.

## Source mutations and first hosted candidate

At source1dafb740, main performed five actual source mutations, rebuilding matching
server JS before each probe and each restoration. Every mutant failed the intended
scenario and the exact restoration passed:

- Omit partial-staging cleanup: second-ref EIO test fails the removal count.
- Omit final post-ref-cleanup check: held successful ref-rm abort returns success,
  so assert.rejects fails.
- Compound late-read ablation removes three post-read masking guards: held artifact
  read abort returns success. This is deliberately not a single-redundant-line proof.
- Ignore contextMode in googleInput: real Gemini parent-only wire test fails.
- Omit actual grace-timer KILL: native stubborn/timeout cases require watchdog reaps
  and fail the isolation ledger. Restored native group passes32/32.

All three production files compared identical to committed source after restoration;
no mutation is retained. Raw RED/restored logs: session wp06/mutations/.

PR205 draft above204; first CI33961435592 at1dafb740 failed on both Node versions
only at the old node-studio element-prompt source oracle: it still looked for Google
calls in legacyNode. Frontend39 passed; CodeQL33961436587 succeeded. No clean-CI
claim is made for that candidate. Main retargeted the actual Google runGoogleImage
call and AST-returned prompt fields (including request.prompt vs rawPrompt), while
preserving other families' exact checks. New returned-field extractor ignores
comments/unreturned objects and has direct tests. The affected UI/import suites
pass34/34; semantic tests typecheck passes. The final local driver now includes
this twentieth file. Fresh exact-tip CI/CodeQL and C review remain required.
