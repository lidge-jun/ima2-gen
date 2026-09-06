# WP12 — exact-source security disposition ledger

Candidate cc304e8025b4477c092589b9e6f07d594be79a52. This is an ID-level working
ledger, NOT security acceptance or scanner dismissal. Full candidate CI34026172889
and new CodeQL analysis are pending. Original snapshot has93 alerts: IDs1..95
except14 and18, all from aca964 runtime (109171 only added closeout docs).

C correction: independent path audit found four genuine High caller/sink paths
among the provisional37guarded candidates. Main confirmed the source and accepted
the repairs in124_3_path_repair_plan.md. The earlier table is a snapshot of working
dispositions, not clearance; do not use its candidate counts as a passing gate.

## Report reconciliation

| IDs | Current source decision | Evidence still required before acceptance |
|---|---|---|
| 1,2,3 | Reachable costly normalization repaired in canvasVersionStore, githubFolder, parsePromptCandidates. Use linear boundary scans; no timer threshold or broad parser-linear claim. | Candidate focused tests plus CodeQL location refresh. Empty-frontmatter body preservation differs beneficially from prior behavior; record, do not claim full equivalence. |
| 5,6,7,8 | openUrl no longer builds a shell command from URL punctuation. HTTP(S) only; argv or fixed PowerShell/base64 data boundary. | Pure platform cases pass. Native Windows child launch EPERM means PowerShell round-trip is NOT verified. No policy bypass. |
| 15,16 | GitHub imports now validate before each request, pin public DNS answers and limit bodies while reading; post-response URL checking alone was insufficient. | Fresh independent download review, candidate tests and updated alert instances. |
| 17 | Auxiliary schema spike returned attacker-controlled error as HTML; now nosniff plain text. | Existing source contract passed; not a production-server XSS claim or live OAuth proof. |
| 44 | Route nodeId reached metadata read without containment; nodeStore now verifies lexical and canonical boundary using the supplied generatedDir. | Owned traversal/sibling/directory and leaf-symlink cases pass; Windows junction coverage and candidate CI pending. Privileged concurrent FS replacement is not atomically confined. |
| 58..90,92 | Production API endpoints now share real per-app socket-peer admission before parsers, alongside unchanged auth/job limits. | Pure budget cases pass, including native Windows; hosted actual route behavior and per-ID source/caller mapping pending. Custom middleware may remain a scanner finding; count is not the decision. |
| 21..43,45..57,94 | Existing path reports have caller-minted names, constrained identifiers or path containment. P explorer found37 guarded cases besides44; these are source-grounded candidates for false-positive disposition, not blanket clearance. | Main must reconcile each actual sink/guard and existing negative test result; lexical-only helpers must not be described as symlink confinement. |
| 19 | imageImport.decodeHeader maps non-string headers to null; localImportStore.safeOriginalName is metadata only. Actual output filename is minted from detected format/timestamp/random bytes. | Confirm existing local-import candidate tests and metadata/render consumers. No arbitrary original filename reaches write path. |
| 20 | assetDerived explicitly narrows query.kind to string; non-string selects keyed-png, not an array sink. source/projectId/name have separate scalar handling. | Existing derived-route cases plus current caller chain. Correct the explorer proposal: repeated kind keys are NOT universally rejected400; they can select the default. Do not add a needless guard merely to match the report. |
| 95 | Gemini URL scheme/hostname are literal Google origins in both API and Vertex branches; model/project interpolation occurs after the fixed host. Credentials/project are trusted operator configuration. | Source/test evidence must prove user model cannot replace origin and retained model selection validation; no claimed browser-origin authorization from this fact. |
| 13 | Actual config CLI calls isWritableConfigKey/WRITABLE_CONFIG_KEYS before setNestedKey; defaults callers form fixed/typed keys. | Verify exact callers and existing config tests. Direct invalid helper invocation does not establish an HTTP/CLI bypass. No speculative prototype helper patch. |
| 4,9,10,11,12,91,93 | Test-only assertion/mock/fixture sites, not production request routing or rendering. | Confirm package/source reachability and each actual sink. Keep scanner scope unchanged; no automatic dismissals. |

The table partitions93 IDs without treating those counts as proof:45 IDs map to
implemented repairs,37 to existing path controls and11 to other source/test-only
dispositions. Reviewers' provisional “verified false positive” labels are not
copied as acceptance. In particular, prior “no nested quantifier” and “near-linear”
regex arguments were rejected, and the initial prototype-caller claim omitted
the actual key allowlist. No alert was dismissed and no scanner rule was disabled.

## Additional confirmed boundary and preserved blocker

API token guard used case-sensitive startsWith while Express matches routes
case-insensitively. It now shares segment-exact case-insensitive matching with
admission; GET-only exact OAuth callback exemption preserves state/PKCE handling.
This repair is independent of future WP12s cookie/origin/media policy.

Controlled first-frame SSE disconnect is repaired and independently checked with
one POST and retained cursor across two EOFs. The original historical first-case
MCP timeout still lacks a causal classification. New green CI cannot close that
incident on its own; keep wp12/mcp-recovery open until an evidence-based disposition.

PR214 history prerequisite: independent source re-review PASS at
d48396ec6cefc8a46d75918f0b977b8ba6cac05e; PR Fast34025766504 and CodeQL34025766435
passed. Full CI34025858936 is separate from this cumulative candidate's CI.
No feature stack merge or release has occurred; native stack registration and
ancestry cascade remain required before completed stack delivery.
