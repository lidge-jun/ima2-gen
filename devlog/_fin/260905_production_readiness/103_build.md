# WP10 B — bounded doctor implementation

102 closes all4plan blockers through same-reviewer PASS; real A→B persisted.
Main implemented config-free doctor-runtime/report and earlyinstallationentry,
packageenginecheck, fixed machine messages/fail-preservingunknowncode, safe
compatibility bundle, explicit whole-response deadlines and categorized key checks.
Existing native/skills checks share their config-free owner rather than duplicate
probes. Config accepts object roots; doctor independently reports malformed roots.

Independent worker Carver changed onlylogger.ts/logging.test.ts. MAIN inspected
the actual patch and reran17testsPASS; worker recorded5pass12failRED beforefix.
Report/runtime/logging24testsPASS. Provider tests now execute actual checker code
with synthetic config/auth/fs/env and injectedfetch, no real home/keyring; all9
provider cases plus CLI help contract pass. Both typechecks pass after line-code
fixtures are migrated. No standard doctor or live provider check executed locally.

Remaining verification is product-required: actual emitted installation/standard
JSON CLI output and exit codes under an owned hosted subprocess. Existing
doctor-report.test.ts may export its fixture-only verifier for explicit CI execution
after emit; it is not a production hook or new generic test runner. Add one narrow
WP10 diagnostic workflow reusing build/test commands, and invoke the same verifier
in the final existing CI root jobs. No new isolation framework or account probes.
Main keeps test writes scoped to preplanned doctor/report/runtime files.

First diagnostic34010003677 at5e00a48c SUCCESS:33focused tests; actual emitted
installation JSON exits0 with configReads/authLookups/subprocess/network all0.
Invalid installation combination exits2/stdoutempty; standard null configuration
and bundle produce singleJSON/exit1, no opaque fixture credential. Incomplete
owned-package unit case now distinguishes native/dependency/UI failures (34pass).

ReviewerHume01a074d8-83b3-7033-b0b0-de2347befa6d reports one medium defect: old
loadConfig swallows malformed legacy JSON before diagnosticConfig can classify it.
Accept the actual code path; diagnosticConfig now selects primary then legacy
path itself and parses inside its existing safe catch. Human/image-probe loader
compatibility remains unchanged. No new config framework or recovery behavior.
Existing invalid-config subprocess proof exercises that catch; legacy selection
priority is additionally source-reviewed, not claimed separately runtime-probed.

Same reviewer confirmed PASS after that two-line fix, with no remaining finding.
Main reran root and test typechecks (both exit0), all34 focused cases (0fail), and
diff whitespace check. The final extra source line required only the existing
structure line-count refresh. Ready for grouped exact-SHA full CI and CodeQL;
this is not yet C acceptance, merge, or release proof.
