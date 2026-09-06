# WP12 download review — User-Agent compatibility repair

Fresh reviewer Euler returned FAIL with oneP1 at cc304e80: GitHub folder API's
native request lacks User-Agent. Main accepts this finding. Replacing fetch lost
its automatic transport header; the explicit caller currently supplies only
Accept. This is a real API contract gap, not a reason to weaken destination checks.

Official GitHub documentation was opened2026-09-06 and confirms requests need a
valid User-Agent identifying the application:
https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#user-agent-required
No actual GitHub folder request/403 was executed; reviewer confirmed the missing
header at the mocked native boundary. Distinguish that evidence from a live403.

Minimal repair: add User-Agent: ima2-gen to the existing GitHub API caller headers
and assert it in the existing folder test at the request boundary. No shared
transport default, retry change, new helper, scanner exception or auth relaxation.
No conflict with121 scope; this preserves caller compatibility during extraction.
Re-run the affected folder contract and re-use the same reviewer for closure.
The in-flight cc304e80 CI is diagnostic only after this runtime delta lands;
the amended exact SHA still requires the full final gate.
