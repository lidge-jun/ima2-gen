# WP13 B — observed workflow-registration refusal

PR218 was created at ba5b1c7334ff5626488d5399948a6838c5ab57f7. Attempting
`gh workflow run published-ui-smoke.yml --ref codex/prod-wp13-release -f artifact_kind=candidate`
returned404: workflow not found on the default branch. The workflow listing also
had no entry. Existing ci.yml/codeql.yml dispatches remain available, so this is
not evidence of missing account authorization. YAML/inline syntax checks already
pass; no candidate UI execution happened in the refused dispatch.

Minimal registration/activation correction: a push trigger limited to the exact
task-owned codex/prod-wp13-release branch and its three UI-probe files. Push events
explicitly select candidate acquisition and the actual event SHA; published
acquisition remains manual-only with required validated product inputs. One job,
existing dependencies, contents:read, unchanged artifact/digest/doctor/UI checks.
No schedule, heartbeat, global role/config change, new parser or compatibility
fallback. No publication is triggered by this workflow. This supersedes only
the earlier manual-only description for candidate bootstrap, not published proof.

The acquisition kind is computed once at job env and passed unchanged into input
validation, acquisition, test-process identity and artifact naming. The original
driver-SHA assertion remains correct for a push event. Future source changes still
need their own exact-head proof; a successful earlier run is not reused silently.
