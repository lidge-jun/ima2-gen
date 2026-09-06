# WP09 A — independent audit closure

Round1 atcbad8d09 found nine concrete blockers. Main accepted all, recorded their
root causes/cross-conflicts and folded exact repairs in090/093/094/095. Round2
reviewed f4c6f842 against actual source. No implementation had begun.

- Dirac01a073a6-dbb8-7e20-8a18-b4b2c295b34d: runtime isolation and parent ownership,
  four prior blockers resolved, VERDICT: PASS, remaining0.
- Ptolemy01a073a6-dc47-7ba2-af61-4b852a0513c3: receipt/build/cache, both prior
  blockers resolved, VERDICT: PASS, remaining0.
- Averroes01a073a6-dcf8-7bf2-9c0b-ee4f638a6c59: UI/E2E consumer and observation
  path, three prior blockers resolved, VERDICT: PASS, remaining0.

These are real static A reviews, not executed future-verifier proof. Main judges
the audit pass. B follows094 ownership plus095 additions, with main owning the
receipt/Tailwind/CI integration critical path. No worker may widen writes or run
local app/browser/provider/guard startup, full suites or paid calls. Main owns git
and every FSM transition. Existing user recording files remain untouched.

The build plan has public APIs, input/output/cleanup contracts and activation rows;
C must still prove every new path, including raw-body cancellation, cache lifetime,
strict source scanning, native guard startup and actual UI behavior. Missing or
failed evidence remains a blocker rather than an audit waiver.
