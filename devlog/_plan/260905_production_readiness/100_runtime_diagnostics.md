# WP10 — Actionable, bounded, machine-readable doctor

Status: WP00 design only. Class C4 for credential/redaction boundaries.
Archetype repair; trigger: mixed JSON output, false runtime floor, unbounded key
verification, opaque-secret leak. Goal: an operator can identify a failed local
prerequisite and a safe next action without exposing credentials or paying for a probe.
Non-goals: telemetry platform, new health endpoint, automatic credential repair,
automatic provider generation, remote URL discovery, or claiming configured=working.
Verifier: subprocess JSON/exit tests, local HTTP fixtures, explicit Node version
fixtures; stop on independent negative assertions and exact-tip CI. Parent owns all
state/dispatch/release. Escalate missing isolation or changed credential scope.

## Dependencies

Semantic: WP01 registry IDs/credential descriptors, existing doctor builders; WP07
terminal errors are diagnostic context only (no direct import needed). Stack base
WP09, then WP11. WP11 consumes engine parser and `doctor --installation --json`.
Main-approved scope amendment: WP10 also owns generic logger error-string
sanitization in lib/logger.ts and its logging.test.ts corpus. Security lane WP12s
(125/006) consumes this contract; that lane does not duplicate the sanitizer.
WP09 owns browser fixture isolation; CLI diagnostic tests use their own subprocess
fixtures, not the browser profile. Image-probe is an existing explicit billed command
and is neither invoked nor redefined by this WP.

## Source evidence and change manifest

`bin/commands/doctor.ts:139` prints before collecting; `bin/commands/doctor.ts:145` hardcodes >=20;
`bin/commands/doctor.ts:253` prints JSON after prior text. `bin/lib/doctor-providers.ts:163` makes deadline-free
fetches and reports every failure as AUTH_INVALID. `bin/lib/doctor-bundle.ts:5` cannot redact
opaque tokens in arbitrary URLs. `doctor-checks.ts` already checks npm, native SQLite,
skills and writable DB parent; reuse these checks, not a new doctor framework.

| Action | Exact path | Purpose |
|---|---|---|
| NEW | `bin/lib/doctor-runtime.ts` | Parse package engine, local installation checks, explicit loopback runtime probe |
| NEW | `bin/lib/doctor-report.ts` | Typed collection/report and fixed message/action table; one formatting boundary |
| MODIFY | `bin/ima2.ts` | Early offline installation dispatch before config/doctor/star-prompt import |
| MODIFY | `bin/commands/doctor.ts` | Collect/report branch for --json/--bundle/--installation; package engine in ordinary text path |
| MODIFY | `bin/lib/doctor-checks.ts` | Structured code on existing results; suppress raw native exception details |
| MODIFY | `bin/lib/doctor-providers.ts` | Stable codes, bounded key verification, no raw URL/error text |
| MODIFY | `bin/lib/doctor-media.ts` | Add code for ffmpeg available/missing/probe-failed |
| MODIFY | `bin/lib/doctor-bundle.ts` | Compatibility fields retained, safe code-derived text and structured checks |
| MODIFY | `lib/logger.ts` | One bounded logger-local string sanitizer, used by fields and sanitizeError; safe scalar metadata retained |
| MODIFY | `config.ts` | diagnostics.keyTimeoutMs and diagnostics.runtimeTimeoutMs positive bounded defaults |
| MODIFY | `.env.example` | Document only new timeout knobs |
| NEW | `tests/doctor-runtime.test.ts` | Engine fixtures and loopback probe behavior |
| NEW | `tests/doctor-report.test.ts` | Report JSON, exit policy and redaction independent assertions |
| MODIFY | `tests/doctor-provider-contract.test.ts` | Replace source-only network guard assertions with controlled behavior tests |
| MODIFY | `tests/logging.test.ts` | Independent opaque URL/userinfo/query/Bearer/nested-error corpus through sanitizeError and captured log sink |
| MODIFY | `tests/cli-doctor-status-contract.test.js` | Keep static help linkage only; runtime assertions live in TS tests |
| MODIFY | `docs/CLI.md` | Flags, exit policy and cost distinction |
| MODIFY | `structure/02-command-reference.md` | Machine report and installation mode |
| MODIFY | `structure/06-infra-operations.md` | Diagnostic vs live-provider evidence meanings |
| MODIFY | `structure/01-file-function-map.md` | Owner map/count refresh |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Inventory refresh |

DELETE none; JS emitted only by build:cli/build:server, not committed by hand.

## New file contracts and exact behavior

### `bin/lib/doctor-runtime.ts` — bounded runtime diagnostics

```ts
export function parseMinimumNodeMajor(engine: unknown): number;
export function checkNodeEngine(version: string, engine: unknown): DoctorCheckLine;
export function buildInstallationDoctorLines(root: string): DoctorCheckLine[];
export async function probeDoctorRuntime(input: {
  url: string; expectedVersion: string; timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<DoctorCheckLine[]>;
```

Complete design: import fs/path/module built-ins, DoctorCheckLine type, and existing
`getUiDistBuildStatus`. `parseMinimumNodeMajor` accepts the repository's deliberate
`/^>=([1-9][0-9]*)$/` contract, returns integer; reject empty, complex semver range,
NaN and malformed type with ENGINE_REQUIREMENT_INVALID. Do not invent a partial
semver solver or silently fall back to 20. If package later needs a complex range,
amend this contract or adopt an already-approved semver parser before changing it.
Read package.json at the caller boundary; `.engines.node` is the sole authority.
`checkNodeEngine` parses `v?MAJOR.MINOR.PATCH` and compares major with requirement.
It returns NODE_RUNTIME_OK / NODE_RUNTIME_UNSUPPORTED / ENGINE_REQUIREMENT_INVALID,
safe version/requirement text and action `Install a Node version satisfying ...`.

Installation checks load package metadata, check node requirement, resolve existing
runtime dependency/bin list (move `missingRuntimeDeps` from doctor command here),
open only an in-memory better-sqlite3 DB to prove native binding, verify three packaged
skills and UI-dist state. No config/auth file parsing, keyring subprocess, provider
credential checks, writeability probe of real user data, backend discovery, network,
setup, migration or build. `source-missing` with dist is pass; missing-source-and-dist
is INSTALL_UI_MISSING; stale checkout is warn INSTALL_UI_STALE with explicit build
action, never auto-build in doctor. Functions ≤50 lines by separate local checks.

Import-time enforcement: current bin/ima2.ts statically imports config, doctor and
star-prompt, each capable of reaching user config before command dispatch. Convert
ONLY those three imports to awaited dynamic imports after an early
`process.argv[2] === "doctor" && process.argv.slice(3).includes("--installation")`
branch. That branch imports doctor-runtime/report only, parses allowed flags
--installation/--json/--help, rejects --bundle/--verify-keys/--runtime with exit2,
collects buildInstallationDoctorLines(ROOT), renders once and exits through
exitFlushed. Define ROOT before the branch and config-derived CONFIG_DIR/CONFIG_FILE
after it. Remaining commands keep existing runtime initialization order afterward.
Report must not runtime-import doctor-checks or doctor-providers (type-only imports
are safe); registry import must be verified not to initialize config. Probe this
entry in a child with fs read instrumentation: fail on config.json/auth.json reads,
keyring subprocess or fetch. No test-only production switch. Package metadata and
node_modules resolution remain allowed. This entry change is narrowly required to
make the advertised installation-mode boundary true, not a dispatcher rewrite.

Runtime probe is OPT-IN `--runtime <URL>` only. Validate URL before any fetch:
http/https, hostname exactly localhost/127.0.0.1/[::1], no username/password/query/hash,
path empty or `/`; reject other origins without network. Request only `/api/health`,
redirect:error, connection:close, manual AbortController timeout cleared in finally.
Classify 401/403 as RUNTIME_AUTH_REQUIRED (action: use the configured authorized
client; do not suggest a provider-key reset), not unreachable. Validate other HTTP
and JSON shape at boundary (`ok === true`, version string, finite pid
if present). Return RUNTIME_READY / RUNTIME_VERSION_MISMATCH / RUNTIME_UNREACHABLE /
RUNTIME_TIMEOUT / RUNTIME_INVALID_HEALTH. No credentials forwarded; no endpoint
fallback. A 200 health response establishes local server response, NOT upstream success.

Later WP12s owns LAN token/cookie bootstrap and media protection. This probe remains
explicit-loopback and sends no tokens/cookies; it does not pretend to validate LAN
authentication. If WP12s requires auth even for loopback health, the report above
must visibly require authorized access, and main decides any credential-aware probe
extension in WP12s. Do not silently forward ambient IMA2_LAN_TOKEN or loosen auth.

### `bin/lib/doctor-report.ts` — complete data contract

```ts
export interface DoctorReport {
  schemaVersion: 1;
  version: string;
  mode: "standard" | "installation";
  checks: Array<{
    code: string;
    kind: "pass" | "fail" | "warn" | "info";
    lane?: string;
    evidence: "local" | "local-http" | "remote-auth";
    message: string;
    action?: string;
  }>;
  summary: { passed: number; failed: number; warned: number; exitCode: 0 | 1 };
}
export function buildDoctorReport(input: {
  version: string; mode: DoctorReport["mode"];
  lines: readonly DoctorCheckLine[];
}): DoctorReport;
export function renderDoctorReport(report: DoctorReport): string;
```

Extend existing DoctorCheckLine with required `code: string`, optional registry lane,
and optional evidence kind. Every in-repo constructor is in the manifest above or
doctor command; find all `DoctorCheckLine` and `ProviderDoctorLine` callers before
build. The existing human `text` stays for compatibility but the machine report
NEVER trusts it. Fixed code→message/action definitions live in this file; unknown
code maps to DIAGNOSTIC_UNKNOWN/warn, not pass and not arbitrary string passthrough.
Whitelist lane against `listProviders()`; omit unrecognized lane. No paths, URLs,
prompt, raw exception, environment value, config object, private key or hostname in
checks. Human-only safe local path detail may be printed by existing text doctor,
but bundle uses fixed messages only. Baseline bundle legacy version/node/platform/
hostnameHash/lanes fields remain with safe lane text; add schemaVersion/checks/summary.
Do not claim the old unsalted hostname hash is anonymization; retain for compatibility
only, with removal separately versioned if requested.

Minimum code table (all failure rows carry the stated action):

| Code family | Kind / evidence | Action on failure |
|---|---|---|
| NODE_RUNTIME_OK / NODE_RUNTIME_UNSUPPORTED / ENGINE_REQUIREMENT_INVALID | pass/fail/local | Install supported Node / inspect package metadata |
| INSTALL_PACKAGE_MISSING / INSTALL_DEPENDENCY_MISSING / INSTALL_NATIVE_FAILED / INSTALL_SKILL_MISSING / INSTALL_UI_MISSING | fail/local | Reinstall same approved package version; no auto install |
| INSTALL_UI_STALE | warn/local | Run project UI build in source checkout |
| NPM_READY / NPM_MISSING / NPM_OLD | pass/warn/local | Install required package manager |
| DB_PARENT_WRITABLE / DB_PARENT_UNWRITABLE | pass/fail/local | Check configured directory permissions, no auto chmod |
| CONFIG_PERMISSIONS / CONFIG_INVALID / ADVERTISEMENT_INVALID | warn/fail/warn/local | Restrict file access / repair JSON / start a known local server |
| CREDENTIAL_PRESENT / CREDENTIAL_MISSING / CREDENTIAL_SHAPE_INVALID | pass/warn/fail/local | Configure this lane; present explicitly means not verified |
| OAUTH_FILE_READY / OAUTH_FILE_REQUIRED | pass/fail/local | `ima2 login` (human initiated) |
| LOCAL_CLI_FOUND / LOCAL_CLI_MISSING / LOCAL_ORIGIN_VALID / LOCAL_ORIGIN_INVALID | pass/fail/local | Correct configured executable/origin; never print raw invalid origin |
| FFMPEG_READY / FFMPEG_MISSING / FFMPEG_PROBE_FAILED | pass/warn/local | Install/check ffmpeg for video tasks |
| AUTH_VERIFIED / AUTH_INVALID / AUTH_RATE_LIMITED / AUTH_UPSTREAM_FAILED / AUTH_NETWORK_FAILED / AUTH_TIMEOUT | pass/fail/remote-auth | Login/replace key only for 401/403; otherwise retry later or inspect network/upstream |
| RUNTIME_* above | pass/fail/warn/local-http | Start intended server, inspect version, or check endpoint |

For existing informational checks (port availability/cardNews), use codes
PORT_AVAILABLE/PORT_IN_USE/FEATURE_ENABLED/FEATURE_DISABLED, fixed info messages.
Storage text builder remains human output only; report must not parse its prose or
scan legacy galleries merely to manufacture another check. Report documents its
covered surfaces, not a claim of exhaustive storage recovery verification.

Summary is computed from emitted checks, not original raw lines. All fail rows set
exit 1, warnings alone exit 0. Installation mode only includes installation checks;
missing optional provider auth is not an installation failure. Standard mode retains
existing selected-OAuth failure policy; do not silently downgrade it to make installs
green. Invalid invocation combinations exit 2 before collection, with stderr only.

## Command and provider diffs

Before standard Node check: `if (nodeMajor >= 20) ...`.
After: `checkNodeEngine(process.version, packageMetadata.engines?.node)` with same
structured result used by installation mode and human formatter. Remove the duplicate
20 literals. Fixtures engine `>=22`, versions `v20.19.0`, `v22.0.0`, `v24.17.0` must
yield fail/pass/pass. Fixture engine `>=24` and v22 must fail (not a hardcoded 22 fix).

At `doctor(args)`, after help and explicit image-probe branch, parse recognized flags.
For --json OR --bundle OR --installation, collect lines without any prior console.log;
emit JSON once for --json, else formatted report once. `--bundle --json` emits a
single compatibility bundle with report fields. `--json` alone emits DoctorReport.
Use `exitFlushed(report.summary.exitCode)` after complete stdout. Plain doctor keeps
human storage section while sharing node and safe provider checks. Help names all
flags and states --verify-keys is remote auth only; image-probe is billed generation.
Reject --installation combined with --verify-keys or --runtime; it must stay offline.

Keep `verifyConfiguredKeys(fileConfig, fetchImpl = fetch)` compatibility. Add third
options argument `{ timeoutMs?: number }`; default from config.diagnostics.keyTimeoutMs.
Default 5,000 ms per request; config parser clamps positive configured values to
30,000 ms ceiling, runtime probe default 1,500 ms (same ceiling). Explicit
AbortController timer, redirect:error; clear timer in finally. Classify 401/403 as
AUTH_INVALID, 429 AUTH_RATE_LIMITED, other non-2xx AUTH_UPSTREAM_FAILED, aborted signal
AUTH_TIMEOUT, other thrown error AUTH_NETWORK_FAILED. Never echo caught error.message,
response body or configured key. Gemini x-goog-api-key versus Bearer behavior stays.
This does not validate generation capability or balance. Credentials without a
declared non-generating validate URL remain local-only, never invent an endpoint.

## Generic error-string sanitizer — definite WP10 owner

Source: `lib/logger.ts:65-80` currently scrubs Bearer and image data URLs only,
then collapses whitespace and truncates to 240 characters. `lib/logger.ts:82-91`
passes message through that path, preserves name/code/status, and omits cause/stack.
`lib/logger.ts:153` maps those sanitized fields to the actual log sink.

Dependency decision: keep logger import-free and add a private pure string helper
in that file. Do not import Responses helpers: `lib/responsesDoctor.ts:1-10` imports
config/OAuth/parser, while `lib/responsesParse.ts:1-2` imports inflight AND logger,
creating an upward dependency/cycle. Its private sanitizeProbeErrorMessage at
`lib/responsesDoctor.ts:258` also only covers selected query names. MCP scrubValue
(`lib/mcp/sanitizer.ts:7-30`) imports only crypto and is cycle-safe, but its recursive
snapshot policy removes long opaque strings/emails and selected query parameters;
it neither guarantees generic userinfo removal nor preserves arbitrary diagnostic
correlation strings. Rejected reuse is semantic, not a claim MCP import would cycle.
Reuse the existing logger's Bearer/data-image behavior, not either larger helper.
Do not change Responses/MCP sanitizer code or snapshot hashes in this WP.

Before (current sanitizeValue string branch):

```ts
const oneLine = value
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
  .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "data:image/[redacted]")
  .replace(/\s+/g, " ")
  .trim();
return oneLine.length > MAX_VALUE_LEN ? `${oneLine.slice(0, MAX_VALUE_LEN)}...` : oneLine;
```

After: `if (typeof value === "string") return sanitizeLogString(value);` and
private `function sanitizeLogString(value: string): string` with this ordered policy:

1. Replace existing image base64 data URLs with `data:image/[redacted]` first.
2. Replace complete absolute URL tokens (scheme:// through next whitespace or
   quote/angle-bracket delimiter) with `[redacted-url]`. Include custom schemes,
   userinfo, port, path, query and fragment; signed/opaque credentials need not have
   a known prefix or a known query key. Also redact protocol-relative //host tokens.
   Deliberately retain NO URL host/path from an error message: URLs may hold opaque
   credentials anywhere. Do not parse, decode, fetch or reconstruct the URL; malformed
   URL-shaped tokens receive the same redaction. Multiple URLs are all replaced.
3. Scrub Bearer followed by any non-whitespace/non-quote token, not only the current
   limited alphabet, to `Bearer [redacted]` (case-insensitive).
4. Scrub query fragments not attached to an absolute URL: preserve ? or & and the
   parameter name but replace each value through next &/whitespace/quote/angle
   delimiter with `[redacted]`, regardless of parameter name/case. This includes
   `?sig=opaque`, `&X-Amz-Credential=opaque`, and unknown `?custom=opaque`; never
   whitelist only token/key. Fully encoded values remain redacted without decoding.
5. Collapse whitespace and trim, then apply existing MAX_VALUE_LEN=240 truncation
   and `...` suffix. Sanitization MUST precede truncation, so cutting a secret-bearing
   URL cannot turn its leftover prefix into apparently safe diagnostic text.

Concrete helper body (no new dependency or public string-helper export):

```ts
function sanitizeLogString(value: string): string {
  const oneLine = value
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "data:image/[redacted]")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/(^|[\s("'<>])\/\/[^\s"'<>]+/g, "$1[redacted-url]")
    .replace(/Bearer\s+[^\s"'<>]+/gi, "Bearer [redacted]")
    .replace(/([?&][^=\s?&#"'<>]+)=([^&\s"'<>]*)/g, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return oneLine.length > MAX_VALUE_LEN ? `${oneLine.slice(0, MAX_VALUE_LEN)}...` : oneLine;
}
```

sanitizeError keeps its public call signature and output keys; string input becomes
the actual sanitized message instead of silently "Unknown error". Use only safe
scalar metadata and do not recursively serialize arbitrary error objects:

```ts
export function sanitizeError(err: unknown) {
  if (!err) return { message: "Unknown error" };
  const e = typeof err === "object"
    ? err as { name?: unknown; code?: unknown; status?: unknown; message?: unknown }
    : {};
  const message = typeof err === "string" ? err
    : typeof e.message === "string" ? e.message : "Unknown error";
  return {
    name: typeof e.name === "string" && e.name ? sanitizeLogString(e.name) : "Error",
    code: typeof e.code === "string" ? sanitizeLogString(e.code) : undefined,
    status: typeof e.status === "number" && Number.isFinite(e.status) ? e.status : undefined,
    message: sanitizeLogString(message),
  };
}
```

Ordinary machine code `UPSTREAM_FAILED` and status 503 remain exact; a code/name
containing credential-bearing text is sanitized rather than exempted. No conversion
of 429/timeout into AUTH_INVALID, and no loss of valid numeric status (including 0).
Nested `cause`, `errors`, stack, rawResponse, request/response/body remain OMITTED,
not recursively traversed. Existing sanitizeFields policy remains: Error value uses
sanitizeError; other objects become `[object]`, arrays `[array:N]`, sensitive keys
`[redacted]`. Cyclic errors/objects therefore cannot recurse or leak nested strings.
If a caller puts cause.message directly into a string field, sanitizeLogString still
handles its URL/Bearer patterns. Do not start logging causes to improve test coverage.

Doctor's exported report/bundle still uses fixed code-derived messages. It must not
include upstream body or arbitrary sanitizedError.message just because this helper
exists: pattern scrubbing cannot reliably recognize an opaque secret in ordinary
free text. This is generic logger URL/token-pattern coverage, NOT proof every
provider diagnostic is secure. Direct console output, MCP jobs.log, Responses probe
exports and other sinks retain their separately scoped policies and evidence.
WP12s/125 may rely on this helper only for paths actually reaching logError or
sanitizeFields; identifying and changing bypass sinks requires an explicit owner.

### Synthetic corpus and independent assertions

Extend tests/logging.test.ts to import sanitizeError; keep all five existing cases.
Every test uses synthetic fixtures and a captured configureLogger sink; no credentials,
network, image probe, or config import. Assert complete outputs where deterministic
and literal fixture-marker absence in JSON.stringify(sanitizeError(...)), formatted
fields AND captured logError lines; never use the sanitizer to calculate expectations.

| Input/activation | Independent expected result |
|---|---|
| Error `fetch https://user:opaque_user_4711@example.invalid/p?custom=opaque_query_5822#opaque_fragment_6933`, code UPSTREAM_FAILED/status503 | message exactly `fetch [redacted-url]`; code/status unchanged; all three markers absent |
| mixed-case/custom scheme, percent-encoded userinfo/value, unknown signed-query names, two URLs | each whole URL becomes redacted-url; neither decoded nor encoded fixture sentinel remains |
| protocol-relative `//user:opaque_relative_7044@example.invalid/p` | full token omitted; surrounding safe words retained |
| `query ?custom=opaque_query_8155&X-Amz-Signature=opaque_sig_9266` | exact `query ?custom=[redacted]&X-Amz-Signature=[redacted]` |
| Bearer opaque punctuation token, mixed case, existing base64 image string | raw synthetic token/base64 absent; prior Bearer/data:image output contracts preserved |
| outer Error with cause Error containing userinfo/query/Bearer, AggregateError.errors, response.body, self-cycle | output has only name/code/status/message; nested markers and cause/body/stack keys absent; no recursion/throw |
| nested Error as ordinary structured field; separately cause.message passed as string | structured error does not reveal nested payload; direct string uses same scrubber |
| 239 safe chars followed by secret-bearing URL | no partial fixture URL/secret before ellipsis; bounded length ≤243; codes/status remain separately observable |
| safe message/requestId/provider, codes TIMEOUT/AUTH_RATE_LIMITED, statuses504/429 | safe values unchanged; log-level filtering and existing sink routing unchanged |
| opaque free-text upstream response body in doctor error | exported DoctorReport contains only fixed code-derived message; unique body marker absent even without recognizable token pattern |

Mutation proof at implementation C: remove URL replacement, query-fragment step,
or move truncation first; the corresponding fixture MUST fail. Nested-field mutation
that serializes cause/body must fail the independent marker/output-key assertions.
Do not weaken tests to allow leaked prefixes or treat regex source presence as proof.

Observed amendment baseline: `node --import tsx --test tests/logging.test.ts` exit0,
5 pass/0 fail. A direct synthetic sanitizeError probe returned
`{"userinfoOrQueryLeaked":true,"code":"UPSTREAM_FAILED","status":503}` (probe exit0,
defect reproduced, not acceptance green). No implementation occurred. Future C runs
that same focused file with the expanded corpus plus doctor-report tests; typecheck
and exact-tip CI cover logger callers. Regenerate structure counts in this WP.
Rollback restores old logging behavior and reopens this privacy limitation; it must
not retain WP12s's sanitizer acceptance claim after reverting the implementation.

## Acceptance and evidence

| Activation | Independent oracle |
|---|---|
| versions 20/22/24 with engine >=22; v22 with >=24 | fail/pass/pass/fail, explicit literal messages/code; no helper-generated expected value |
| malformed/complex/missing engine | fail ENGINE_REQUIREMENT_INVALID; no permissive fallback |
| `doctor --installation --json` isolated installed fixture | whole stdout JSON.parse succeeds; exit agrees summary; zero ANSI/banner before or after |
| installation entry with poisoned config/auth paths | file-read guard observes zero config/auth reads despite normal entry importing config historically |
| `doctor --bundle --json` isolated standard collector | compatibility fields + safe checks; stdout one JSON document |
| missing UI or native module | distinct actionable check, exit 1; not an auth failure |
| local deps fine, all provider credentials absent | installation mode exits 0 and invokes neither auth detector nor fetch |
| synthetic opaque keys, userinfo URLs, query tokens, private-key text in builder errors | report/bundle contains NONE of exact fixture sentinels (do not use bundleContainsSecrets as oracle) |
| key HTTP 401/429/503/network throw/abort | five distinct codes; timer cleanup observed; error body ignored |
| invalid runtime origin or redirect off loopback | zero redirected outbound calls; safe error, no raw secret echoed |
| health 200 wrong shape/version, timeout, good version | INVALID_HEALTH / VERSION_MISMATCH / TIMEOUT / READY; no paid endpoint hit |
| image-probe not requested | fake paid probe counter remains zero; no live image-probe executed for baseline or C |

Baseline: research records 3 source-contract tests pass; both typechecks pass;
synthetic bundle leak reproduced. Standard doctor, full provider test file (it invokes
auth detection) and billed probes were NOT run here. New runtime/report files are
future gates: `node --import tsx --test tests/doctor-runtime.test.ts
tests/doctor-report.test.ts` after implementation. Existing provider tests must use
isolated injected observations/subprocesses before execution; never real keyring.
Use Node's test mocks at actual fs/auth/subprocess boundary or an isolated child
process; do not add a production test-mode switch. Run future process-level tests on
generated CLI in exact-tip CI too so TS imports cannot mask stale JS output.

Rollback: revert layer/rebuild; no config migration or credential mutation. Added
timeout knobs are optional and old versions ignore them. JSON consumers adopting new
schema must tolerate absent new fields on rollback; document that compatibility limit.
SoT sync is in this PR. WP11 must not reimplement engine parsing or report formatting.
