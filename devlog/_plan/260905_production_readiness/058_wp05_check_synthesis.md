# WP05 C — first candidate, fixture correction and inherited SAST debt

Candidateec8eb879: PR204 over203, CI33958403086SUCCESS andCodeQL33958404044
SUCCESS. Gitleaks8.30.1 scanned30dc2cb4..HEAD (4commits/~290.86KB), no leaks.
These runs predate the following test-only correction and are not final-head proof.

## Independent C findings

- Pascal/security:PASS after73smallwrapper +53addresscases, no heavy/network calls.
- Turing/parity:PASS after63family +39routes +6searchdefaultcases, no heavy calls.
- Boyle/fixture:GO-WITH-FIXES1. New DownloadNetwork.activate cleared priorinactive
  violations. Caught import-time/between-case DNS/HTTP failures could disappear.

AcceptedM1: activate checks and preserves priorviolations, hostmembership uses
Object.hasOwn. Eight standalone regressions test pre-import/between-case DNS,
HTTP/HTTPS, repeatactivationfailure,inheritedkeys andexactdescriptor restoration.
Originalec8failed8/8; repaired8/8passed. Same Creviewer independently verified
81smallcases/0fail andclosedM1. Production unchanged. Newexact-headCI/CodeQL needed.

## Local resource filter interpretation

executionTestProcess does not forward a parent's name/skip selectors. Smallpolicy
runs mustuse exactfilemarker/nativeflag soNodeexecutesinline. A no-allocation
mainprobe confirmed Node24 omits filteredheavy rows and reports skipped0; absence
is not four explicitSKIPlines. Mainlocaldriver uses a preflight-tested literal
`hosted CI` skipregex, verifies smallcasecounts and refuses any executed heavy
result row. The earlierworker's fourheavy localcases remain disclosed in056;
main did not repeat them or change the canonical hostedheavy gates.

## CodeQL baseline comparison — not a clean-security claim

Current CodeQL analysis1728930273 at ec8eb879 reported93results, error/warningempty.
Baseline dev analysis1725647185 at f499fc7 reported93results. Queried openalerts
forbothrefs:93each, exactlysamealertnumber set, no newnumbers; noalerts innewGrok
or multimodePipeline paths. Noalerts were dismissed/modified.

Inherited high/critical reports include non-Grok path/command/URL flows, test
oracles and missing-rate-limit reports. They require source-grounded triage before
overallproduction/release acceptance; identicalbaseline is not false-positive
proof. NextP must register an explicit integratedCodeQL triage task inWP12,
with follow-on scoped phases if real independent defects require them. WP05 only
claims no newrelevantGrok findings. FullcodeQL alertlist comparison is session
evidence, not permission to waive the larger goal's safetycriteria.
