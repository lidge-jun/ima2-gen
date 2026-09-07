# WP12s C — final scanner triage and explicit-token cooldown

At5327ac130255b813cb7d637ae604b28ec549176d full CI34043170570 passed all six
jobs; focused native/UI34043027902 passed33; CodeQL analysis1732147517 completed.
These passes do not close new alert105. Alert106 is a test-only substring
assertion, not an authorization URL check; replacing it with an exact expected
service-output line strengthens the oracle (focused test passes).

## Alert105: preserve one failed-token budget across entrypoints

H1: only bootstrap counts failed shared-token guesses. H2: the global API budget
already bounds rejected tokens. H3: only bounded, high-entropy cookie work is
reachable. Source rejects H2: API guard and sessionCheck end401 before the API
budget. H3 does not cover explicitly supported short legacy tokens. Both ordinary
API/media header/query authentication and GET session status compare those tokens
without the bootstrap counter. A direct, no-network regression using actual
guard/sessionCheck callbacks reproduces attempt11 returning401, not429, after
ten invalid explicit-token guesses spread across those paths. Initial test syntax
error was corrected before this behavioral RED; it is not reproduction evidence.

Bounded correction to125_0's ordering contract: keep routing, Host/Origin policy,
API admission budget and parser order intact. Reuse the existing socket-peer
10-failures/60-second throttle for **all explicit shared-token comparisons**,
including status GET, and bootstrap's required token. No new counter/dependency
or generic limiter. Invalid bootstrap credential shapes still count once;
success never resets failures. Missing/expired cookie reads must not consume
guess allowance or block valid existing cookie sessions: normal reauth and
accepted-job observations retain their contract. Duplicate malformed fields
cannot test a candidate token and still fail before token comparison.

Main owns implementation and negative checks; independent source triage is in
progress. No new GitHub alert was dismissed. Existing approval is101–104 only.
After the repair, rerun focused/native and full exact-candidate gates;5327 is
then superseded, not retroactively relabeled as security-complete.

Owner explicitly prohibited heartbeat automation. Existing ima2-wp12-ci was
already deleted; do not recreate/reactivate it. Continue direct checks only.

Independent triage confirmed105 as a real Medium/P2 missing bearer-guess
control, not a proved High-throughput DoS.106 is a security false positive in
test output. The implemented repair retains the original counters and routing:
shared cooldown before comparison, failure increment exactly once, no successful
comparison increment. Global media failure ends the response before its mounted
guard can run. Parser-invalid nonbootstrap encodings cannot validate a candidate
and retain their existing fail-closed behavior; malformed bootstrap accounting
is unchanged. Normal cookie-only reads do not spend or consult this guess budget.

Local behavioral proof: first ten wrong comparisons401, correct explicit tokens
on attempts11/12 get429/Retry-After across media/status, advancing the controlled
clock60seconds permits the correct explicit token.16/16 pure policy/store/
middleware cases pass; source and test typechecks pass. Existing hosted-session
file now checks same-bucket POST refusal and valid-cookie/public-status continuity;
focused CI selects those HTTP cases plus the unchanged33 browser scenarios.
No fixture framework or permission boundary was widened. Hosted/full final-head
results remain pending after this repair; no dismissal or release claim yet.
