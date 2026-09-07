# WP01 C visual-evidence amendment
The locked010 acceptance requires observed NAI versus OAuth reference affordances.
Existing CI uploads E2E artifacts only on failure, and old J7 screenshots live
outside that uploaded path. A successful test alone cannot provide observable C
evidence. This is a verification implementation step for the same acceptance,
not WP09 fixture redesign or a new product feature.

NEW ui/e2e/provider-surface-affordance.spec.ts: actual provider select NAI->OAuth,
NAI add/attach disabled, OAuth enabled, attach an8x8 synthetic PNG and verify
@Image_1 reference/mention. GenerationPOST is intercepted and count must stay0.
Run ONLY clean hosted CI before WP09; no local live3333/profile invocation.

MODIFY ci.yml e2e and pr-fast.yml: one narrowly filtered success/failure upload
for ui/test-results/**/wp01-*.png,14day retention. No config/DB/log/cookie uploads.
Existing failure artifacts/gates/permissions/pins remain. Missing screenshots do
not by themselves fail upload, but main's WP01 C MUST fetch nonempty images and
observe them before marking c-2 met. CI failure cannot be relabeled success.

Normal UI build compiles new E2E TypeScript. Source/API/backend behavior is unchanged.
C review covers this added spec and workflow step; no new dependency/runtime.
