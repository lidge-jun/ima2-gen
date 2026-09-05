# WP09 — isolated, persistence-honest composer journeys

Status: WP00 design only. Baseline `ecde2bc79cddc50ff0da38091c1ce0590383090c`.
Research: [003_visual_research.md](003_visual_research.md).
Geometry contract: [080_composer_contract.md](080_composer_contract.md).

## Outcome, scope and dependency contracts

Archetype: regression protection. Trigger: existing seven E2E files cover only
eleven cases, reseed navigation state and inherit live environment/ports.
Goal: reproduce actual cross-mode/provider/viewport edits and recovery without
live provider traffic or a fixture overwriting the state under test.
Non-goals: provider generation proof, another Playwright install, a universal
mock-server framework, changing generation policy, replacing node/API tests.
Verifier: focused isolation negatives, deterministic browser assertions and
source-bound rendered artifacts. Stop only when each row below activates and has
an independent assertion; skipped rows are not completion.
Memory artifact: this doc, `003`, implementation C results and per-test attachments.
Expected terminal outcomes: verified isolated journeys, or blocker with exact row.
Escalation: unsafe runner/new transport or changed WP02/WP07 wire contract goes
to main before widening implementation; this leaf cannot control FSM/git/release.

Semantic prerequisites: WP02 provider/model selection and WP08 retained DOM/input
contract. J5 recovery consumes WP07, without modifying its lifecycle. Stack parent
is WP08; WP03–06 appear by cumulative integration, not UI imports.
WP09 owns fixture isolation and journey tests, WP12 consumes those fixtures and
owns combined evidence/build verification. Main explicitly requested this bounded
isolation scope on 2026-09-05. No fixture changes are made now.

### Per-phase execution boundary — resolved by main

WP09 remains after WP08; its fixture implementation is not moved backwards.
WP02/WP08 browser C uses isolated GitHub runners with minimal env, no provider
secrets, no `.env` or legacy config in the audited source/build tree, synthetic
homes/config directories, and no live provider services. Exact-head builds are
served only at owned isolated endpoints, never live `:3333`. Those early cases
are selection/geometry/edit/focus checks with zero generation POSTs. WP08 records
and inspects actual screenshots there; callback-only keyboard checks do not dispatch.
These runner preconditions suffice for the early non-generating scope without
pretending the existing fixture already provides fail-closed transport isolation.

WP09 B implements the filesystem/home/network/process boundary in this document,
then runs I1–I9 isolation/hold checks before any browser generation/error test. Only after
those pass against the actual child startup/transport may C run T5, E1/E2, R1 and
other generation-bearing journeys, using synthetic credentials and owned loopback
stubs. A fresh exact-head UI build and clean fixture state remain mandatory.
All app/server/browser execution remains on a clean disposable credential/media-free
runner, including the first isolation tests. Passing a constructor or in-memory
patch probe does not relax that restriction: I6–I9 must exercise actual startup,
poisoned synthetic files and real relevant calls; main must review that evidence
before authorizing a different runner. No OS/native sandbox is claimed and no
provider-generating spend or live upstream call is authorized. Failure stops tests, never selects an
unauthenticated fallback. WP12 consumes the verified fixture; WP12s later adds
its distinct isolated LAN security cases.

This resolves the earlier fixture-before-UI sequencing question. No parent
decision remains outstanding on whether to reorder WP09. No browser runs in WP00.

WP12s is a later semantic owner, after WP12 and before release, for LAN bootstrap,
session cookies and generated-media security (`125` design owned by main). This WP
stays `IMA2_HOST=127.0.0.1` normal mode: no LAN token option, fabricated cookie,
auth header injection or production auth exception. WP12s can add separately
scoped isolated LAN fixtures later. A 401/403 from the real app is a real failed
authorization path, not a response to rewrite to 200 to make journeys pass.

Selection-only browser catalog fixtures describe synthetic UI state, not an
authorization assertion. They never stub login/bootstrap, cookies, media access,
or the app's rejection behavior. J2 retains its genuine local 401 path. If any
journey's entry is blocked by app authentication, return that seam to WP12s/main;
do not silently add credentials or mask the rejection.

## Future exact file map

| Action | Path | Delta |
| --- | --- | --- |
| MODIFY | `ui/e2e/fixtures/appServer.ts` | Typed seed, isolated launch, ownership registry and exported automatic-worker `test` fixture. Preserve `startApp(mode, options)`/AppHandle callers. |
| MODIFY | `ui/e2e/fixtures/stubUpstream.ts` | Capture parsed synthetic generation bodies; switch billing response at request boundary for recovery; deterministic offline proxy routes. |
| NEW | `ui/e2e/fixtures/appIsolation.ts` | Pure environment constructor, no credential reads; exact contract below. |
| NEW | `ui/e2e/fixtures/appProjection.ts` | Owned source projection, emitted-runtime manifest/build validation, policy serialization and owned cleanup; never copy a whole checkout. |
| NEW | `scripts/write-ui-build-receipt.mjs` | Single parent UI build wrapper; owns nonce/lock, existing tsc/Vite stages and post-build receipt, using Node builtins only. |
| NEW | `scripts/lib/uiBuildReceipt.mjs` | Canonical inventory, digest, schema and binding validator shared by producer and projection consumer; no app import. |
| NEW | `scripts/lib/uiBuildReceipt.d.mts` | Exact declaration companion for the MJS exports consumed by the TypeScript E2E fixture. |
| MODIFY | `ui/package.json` | Preserve ordinary build verbatim; ADD build:fixture for the strict parent receipt wrapper. Only isolated E2E callers use it after server/CLI emit. |
| NEW | `tests/ui-build-receipt.test.mjs` | Standalone Node synthetic-filesystem producer/consumer and independent digest/output negatives; no Vite/browser/app run. |
| MODIFY | `docs/migration/runtime-test-inventory.md` | Regenerate inventory for the new test using the existing classifier; no runner/script-policy change. |
| NEW | `ui/e2e/fixtures/appFilesystemGuard.mjs` | Child-only home override and file-read/copy guard before any app import. |
| NEW | `ui/e2e/fixtures/appProcessGuard.mjs` | Child-only async/synchronous process and worker interception, no compiler exception. |
| NEW | `ui/e2e/fixtures/appNetworkGuard.mjs` | Preloader composes home/filesystem/process guards before TCP guard; no production import. |
| NEW | `ui/e2e/fixture-isolation.spec.ts` | Node-side Playwright environment/seed/guard/poisoned-file/startup tests; independent negatives before browser cases. |
| NEW | `ui/e2e/fixtures/composerAssertions.ts` | DOM measurement + unobscured-control assertions only; no actions or expected-value derivation from production code. |
| MODIFY | `ui/e2e/j6-model-select-label.spec.ts` | Preserve three scenarios; assert actual same-origin reload after setter, no reseed. |
| MODIFY | `ui/e2e/j7-nai-negative-geometry.spec.ts` | Reuse measurement helpers, preserve all three baseline cases/thresholds, add Home/short/long/locale cases. |
| NEW | `ui/e2e/j8-composer-transitions.spec.ts` | Cross-mode/provider/persistence/IME/mention interactions in explicit cases below. |
| MODIFY | `ui/e2e/j2-oauth-reauth.spec.ts` | Assert retained draft, actionable reauth target, focus/useability on return; never perform real login. |
| MODIFY | `ui/e2e/j3-provider-error.spec.ts` | Drive error → edit → successful local stub retry; assert request body and cleared busy state. |
| MODIFY | `ui/e2e/j5-restart-recovery.spec.ts` | Enter Create explicitly before composer; distinguish durable gallery restart from same-origin browser persistence. |
| MODIFY | `ui/e2e/j1-first-run.spec.ts`, `ui/e2e/j4-node-workflow.spec.ts` | Import `test,expect` from appServer for automatic owned-worker cleanup only; all assertions unchanged. |
| MODIFY | `ui/playwright.config.ts` | `trace:"retain-on-failure"`, `screenshot:"only-on-failure"`; no retries/workers expansion. |
| MODIFY | `.github/workflows/ci.yml` | WP09 e2e job builds server/CLI, then UI build:fixture before fixture tests; WP12 consumes these steps. Other job/ordinary build commands unchanged. |
| MODIFY | `.github/workflows/pr-fast.yml` | Retain existing server/CLI builds; change only its UI build command to build:fixture for subsequent browser tests. No trigger expansion until WP12. |
| MODIFY | `structure/04-frontend-architecture.md` | Document ownership/test evidence split and selector/geometry protection. |

DELETE: no files. Every J1–J8 and fixture-isolation spec imports `test,expect` from
`./fixtures/appServer`; fixture-isolation still runs without a browser. J1/J4
retain original test bodies and assertions, adding only the cleanup-owning import.
WP09 adds `ui/package.json` build:fixture and the listed receipt scripts; ordinary build is unchanged;
no package dependency/lockfile or production server/UI behavior changes. The e2e
prebuild steps also land in WP09; no dispatch/OS expansion. These are FUTURE writes
in the implementation map; this A-repair writes only `090` and `003` Markdown.
CI already discovers `ui/e2e` and uploads `ui/test-results/`; WP12 owns successful
evidence collection if its requirements exceed this existing artifact path.

## Fixture security boundary (not just a Host-header assertion)

Assets: developer credentials, local provider services, generation credits and
user files. Entrypoints: inherited env, dotenv, local config fallback, provider
autostart, native transport, browser requests and persisted selection. Threat here
is accidental escape by a test, not hostile user code. Owned temp app/stub processes
must never reuse 10531/18645 or a shared live browser. Runtime mock success proves
the local application path only, never successful OpenAI/NAI/Grok/Google service.

### `appIsolation.ts` full new-file design

Export only:

```ts
export type IsolationOptions = {
  home: string;
  stubUrl: string;
  mode: "minimax" | "oauth-expired" | "minimax-billing";
  withoutMinimaxKey: boolean;
};
export function makeAppEnv(
  inherited: NodeJS.ProcessEnv,
  options: IsolationOptions,
): NodeJS.ProcessEnv;
```

Pure constructor; no filesystem access, service probing, shell or global mutation.
Create a fresh env object, copy ONLY `PATH`, `SystemRoot`, `WINDIR`, `COMSPEC`,
`PATHEXT`, `TMPDIR`, `TMP`, `TEMP` when defined, then apply the explicit values
below. Never spread env then delete a finite list of today's secret names.
Do not copy `HOME`, `USERPROFILE`, `CODEX_HOME`, `NODE_OPTIONS`, proxy env,
`OPENAI_*`, `XAI_*`, `GEMINI_*`, `GOOGLE_*`, `VERTEX_*`, `NOVELAI_*`,
`ATLASCLOUD_*`, `MINIMAX_*`, `IMA2_*`, `OAUTH_PORT` from inherited input.
Explicit paths alone do NOT replace `os.homedir()` or package/global fallbacks.
The child preload overrides app-facing `os.homedir()` before named ESM imports;
neither parent nor child repurposes HOME/CODEX_HOME. No raw env in artifacts.

Set: `IMA2_CONFIG_DIR=home`, `IMA2_DB_PATH=home/sessions.db`,
`IMA2_GENERATED_DIR=home/generated`, `IMA2_TRASH_DIR=home/generated/.trash`,
`IMA2_PORT=0`, `IMA2_HOST=127.0.0.1`, `IMA2_NO_OAUTH_PROXY=1`,
`IMA2_NO_GROK_PROXY=1`, `IMA2_OAUTH_PROXY_PORT=<owned stub port>` in EVERY mode,
`IMA2_GROK_PROXY_PORT=<owned stub port>`, `IMA2_GROK_PROXY_HOST=127.0.0.1`,
`IMA2_MINIMAX_REGION=global_en`, both MiniMax base URL variants=`stubUrl`,
both `IMA2_NAI_BASE_URL` and `IMA2_NAI_ACCOUNT_BASE_URL`=`stubUrl` origin,
`IMA2_MCP_TOKEN_DIR=home/mcp`, `IMA2_MCP_SNAPSHOT_DIR=home/mcp/snapshots`,
`DOTENV_CONFIG_PATH=home/fixture.env`, `IMA2_E2E_HOME=home`,
`IMA2_TEST_HOME=home`, `IMA2_TEST_EXEC_PATH=home/runtime/bin/node`,
`IMA2_TEST_ARGV1=home/runtime/bin/ima2`, `TSX_DISABLE_CACHE=1`,
and `IMA2_E2E_ALLOWED_ORIGIN=<stub origin>`.
`appServer` additionally sets `IMA2_E2E_POLICY=projection.policyPath` after the
projection is built. It is not inherited. Set TMPDIR/TMP/TEMP to `home/tmp` rather
than a developer cache. Never copy npm prefix/cache, APPDATA/LOCALAPPDATA,
XDG_*, PNPM_HOME, NVM_HOME, ESBUILD_BINARY_PATH or runtime injection variables.
Only `MINIMAX_API_KEY=e2e-minimax-key` is inserted, unless `withoutMinimaxKey`.
No fake keys for unsupported generation lanes just to show them ready.

Reject a stub URL unless protocol is `http:`, hostname exactly `127.0.0.1`,
explicit nonzero port exists and URL has no credentials. Store only origin in the
guard variable. Do not accept all loopback ports: a real provider is also loopback.
Config fixture must contain `mcp:{enabledProviders:[]}`; an empty env string is
not reliable because `pickStr` ignores empty values (`config.ts:67-88`).
Fixture config is written BEFORE spawn; this suppresses `config.ts:49`'s fallback
only when parsed successfully. Server key loaders still continue on a missing key
(`server.ts:52-203`), so a valid config is NOT the fallback-read barrier. The
projection excludes `.ima2/config.json`; the empty owned `fixture.env` prevents
dotenv's default path. I6 exercises missing/invalid primary config as well.

### `appProjection.ts` — owned launch tree and lifetime (R1-06)

New test-only API, with no production imports:

```ts
export type Projection = {
  root: string; policyPath: string; guardPath: string; entryPath: string;
  dispose(): Promise<void>;
};
export async function createAppProjection(options: {
  repoRoot: string; home: string; buildDir: string;
}): Promise<Projection>;
```

`home` must be a real directory issued by this fixture's process-local ownership
registry (created with mkdtemp), never arbitrary caller input. Register before
initialization; reject unknown/symlinked homes before reads/writes. J5/WP12 reuse
the registered `app.home` after close; close preserves it. The auto worker fixture
exported as `test` by appServer disposes all homes after owned children exit; caller-owned
unknown paths are never deleted. A new projection per restart is independent of
the durable test home. `dispose` is idempotent and deletes only its validated
mkdtemp root; startup failure invokes it after child exit, then closes the stub.

Projection construction, before app spawn:

1. Read names with `git ls-files -z --cached` in the repository; do not read every
   tracked file then filter. Intersect with this positive source allowlist:
   `server.ts`, `config.ts`, `package.json`, `tsconfig.json`, `tsconfig.build.json`,
   `tsconfig.bin.json`, `lib/**/*.ts`, `routes/**/*.ts`, `bin/**/*.ts`,
   `types/**/*.ts`, plus the THREE fixture `.mjs` guards
   (network/filesystem/process and no other preload). `appProjection.ts` runs only
   in the parent and is NOT copied as a preload. Copy current tracked
   worktree bytes, not stale HEAD bytes; hash each copied file for the receipt.
2. Reject symlinks, path traversal, non-regular files and source paths with a
   `.env*`, `.ima2`, `.codex`, `.grok`, `.progrok`, `generated`, `config.json`,
   database, auth or user-artifact component. Missing required entry/guard is an
   error. No recursive checkout copy, root symlink, `scripts/recording`, `.git`,
   untracked files, stale emitted `.js` or package `generated/` ever enter it.
3. Distinguish source staging from runtime: within one owned mkdtemp container use
   `source/` for that allowlist and `runtime/` for emitted artifacts. In the parent
   fixture builder, before any guard/app loads, run the installed TypeScript CLI
   against copied `tsconfig.build.json` then `tsconfig.bin.json`, overriding
   `--outDir <runtime> --listEmittedFiles`. Use the same Node/TypeScript versions
   as preceding `npm run build:server` and `npm run build:cli`. Both must exit 0;
   reject diagnostics, output outside runtime, duplicate outputs with different
   bytes, and emitted paths lacking a tracked `.ts` input. Each new emitted `.js`
   path is recorded separately, NEVER claimed to come from `git ls-files`.
   Compare each emitted byte sequence with the known corresponding preceding
   build output, except normalize the entry `bin/ima2.js` shebang exactly as
   `scripts/fix-shebangs.mjs`; mismatch/missing output is a stale-build failure.
   Record `{sourcePath,sourceSha256,emittedPath,emittedSha256}` per output plus
   source commit and compiler version. Copy package.json and three guards into
   runtime. `Projection.root` is runtime, `entryPath` is runtime/server.js.
   Server imports of bin/lib/platform.js are included by the emitted manifest;
   no tsx, TypeScript loader, esbuild service, worker or nested Node in app child.
4. `buildDir` is the clean runner's UI build produced by WP09's receipt-integrated
   `npm --prefix ui run build`, not an assumed WP12 artifact or developer dist.
   Call `verifyUiBuildReceipt({repoRoot,distDir:buildDir,requireGitHead})` from the
   WP09 module below BEFORE copying any assets. In exact-head CI requireGitHead is
   true; never accept a source-digest-only receipt as exact-head evidence. Copy
   the verified complete regular-file output list, then rehash the copied bytes
   and recheck the source dist inventory to catch changes during copying. Do not
   copy the receipt itself into the served projection. Missing/stale/tampered or
   extra output is fatal before app spawn. The
   UI build is a separate generated-asset input, never a source allowlist escape.
   Runtime assets use tracked `assets/card-news/templates/**` and the two sanitized
   `assets/mcp-snapshots/{higgsfield,runway}.sanitized.json` only; reject any new
   runtime asset until explicitly added here. No screenshots or user uploads.
5. Resolve installed dependency modules read-only; only projection `node_modules`
   may link to the trusted installed dependency tree. Resolve its real root and
   enumerate real package roots in the policy; reject links escaping that tree.
   No `NODE_PATH`, parent-directory module fallback or install is allowed. The
   filesystem guard refuses data paths even inside dependencies. The source staging
   needs its own dependency link for the parent-only tsc build; neither link grants
   app child subprocess permission. No esbuild executable allowance exists.
6. Create `home/tmp`, empty `home/fixture.env` and explicit `home/config.json`
   (on first start only; restart preserves edited config). Write the JSON policy
   below under projection before spawn. A supplied existing registered home is
   reused, never reseeded. Config includes disabled MCP and autostart from above.

`startApp` keeps its public options unchanged. It derives repoRoot from its own
module URL, uses the runner's exact-head `ui/dist` as buildDir only after the build
receipt check, and supplies the freshly issued home. No optional caller bypass.
Source-archive UI builds can use digest-only receipts as defined below; that does
not relax this app projection's git-tracked source requirement or authorize
source-archive exact-head CI. The non-git compatibility is for the ordinary UI
build/receipt consumer, not a new appServer launch mode.

### WP09 UI receipt producer and consumer (R2-S2)

Ownership is standalone WP09, before any fixture needs a receipt. No new dependency,
external service, environment dump or timestamp-based freshness check. This is a
trusted-build integrity receipt, not a signed attestation against a malicious
builder who can rewrite both assets and receipt. Clean disposable-runner policy
and exact-source CI remain in force.

`ui/package.json` exact additive fixture-build command (SEC-R3 repair):

```diff
     "build": "tsc -b && tsc -p tsconfig.e2e.json --noEmit && vite build",
+    "build:fixture": "node ../scripts/write-ui-build-receipt.mjs",
```

The wrapper acquires its nonce-bound build transaction BEFORE compilation and
invalidates an old receipt; it writes `ui/dist/.ima2-ui-build-receipt.json` ONLY after Vite exit 0
and after rechecking the same inputs/head/build options. Merely recomputing a
source hash after an earlier build would mislabel stale assets, so finish without
a matching same-process transaction is an error. There is NO public --begin or
--finish command that could borrow another process's snapshot. Only `npm --prefix ui run build:fixture` gets this strict behavior. Ordinary
`npm run ui:build`, root prepack, verify:release:source and source-serve auto-rebuild
retain the original build command/order and documented .env compatibility.
Root build:server/build:cli definitions also stay unchanged. A normal build does
not issue a strict receipt; appProjection NEVER accepts uncertified output as fallback.

The CLI derives repoRoot from import.meta.url, accepts no arguments or
path/force/skip options, uses fixed ignored cache/dist paths, catches failures
at main, prints only a stable error code and exits 1. Success logs
only receipt path relative to repo, output count and binding kind. The reusable
module exports the following exact declaration companion (`.d.mts`):

```ts
export type FileDigest = { path: string; bytes: number; sha256: string };
export type UiBuildOptions = {
  mode: "production"; sourcemap: boolean; devUi: boolean;
  nodeMode: boolean; cardNews: boolean; agentMode: boolean;
};
export type UiBuildReceipt = {
  schemaVersion: 1; headSha: string | null;
  sourceInputDigest: string; buildOptions: UiBuildOptions;
  outputs: FileDigest[];
};
export type UiSourceSnapshot = {
  headSha: string | null; sourceInputDigest: string; buildOptions: UiBuildOptions;
};
export function sourceInputDigest(files: FileDigest[], options: UiBuildOptions): string;
export function readUiSourceSnapshot(repoRoot: string): Promise<UiSourceSnapshot>;
export function inventoryUiOutputs(distDir: string): Promise<FileDigest[]>;
export function parseUiBuildReceipt(value: unknown): UiBuildReceipt;
export function assertUiReceiptBinding(receipt: UiBuildReceipt,
  current: UiSourceSnapshot, outputs: FileDigest[], requireGitHead: boolean):
  "git-and-source" | "source-digest";
export type UiBuildTransaction = { nonce: string; source: UiSourceSnapshot };
export function beginUiBuild(repoRoot: string): Promise<UiBuildTransaction>;
export function finishUiBuild(repoRoot: string, transaction: UiBuildTransaction): Promise<UiBuildReceipt>;
export function abortUiBuild(repoRoot: string, transaction: UiBuildTransaction): Promise<void>;
export function verifyUiBuildReceipt(options: {
  repoRoot: string; distDir: string; requireGitHead: boolean;
}): Promise<{ receipt: UiBuildReceipt; binding: "git-and-source" | "source-digest" }>;
```

Complete producer CLI body (all I/O policy remains in the single shared module;
no duplicated consumer rules):

```js
// scripts/write-ui-build-receipt.mjs
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beginUiBuild, finishUiBuild, abortUiBuild } from "./lib/uiBuildReceipt.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = resolve(repoRoot, "ui");
const uiRequire = createRequire(resolve(uiRoot, "package.json"));
const run = promisify(execFile);
let transaction;
try {
  if (process.argv.length !== 2) {
    throw Object.assign(new Error("UI_RECEIPT_ARGS"), { code: "UI_RECEIPT_ARGS" });
  }
  transaction = await beginUiBuild(repoRoot);
  const tsc = uiRequire.resolve("typescript/bin/tsc");
  const vite = resolve(dirname(uiRequire.resolve("vite/package.json")), "bin/vite.js");
  for (const args of [[tsc, "-b"], [tsc, "-p", "tsconfig.e2e.json", "--noEmit"],
    [vite, "build"]]) {
    await run(process.execPath, args, { cwd: uiRoot, maxBuffer: 8 * 1024 * 1024 });
  }
  const receipt = await finishUiBuild(repoRoot, transaction);
  console.log(JSON.stringify({
    path: "ui/dist/.ima2-ui-build-receipt.json", outputs: receipt.outputs.length,
    binding: receipt.headSha ? "git-and-source" : "source-digest",
  }));
} catch (error) {
  const code = typeof error?.code === "string" && /^UI_RECEIPT_[A-Z_]+$/.test(error.code)
    ? error.code : "UI_RECEIPT_IO";
  console.error(code);
  process.exitCode = 1;
} finally {
  if (transaction) {
    try { await abortUiBuild(repoRoot, transaction); }
    catch { console.error("UI_RECEIPT_CLEANUP"); process.exitCode = 1; }
  }
}
```

The three exact commands are the pre-existing `tsc -b`,
`tsc -p tsconfig.e2e.json --noEmit`, `vite build`, now invoked via the installed
UI dependencies with no shell/npm recursion. Child output is bounded and not
dumped on failure because it can contain environment-derived paths; failure is
nonzero and cannot reach finish. No transformed/guarded app child is involved.

Input inventory is explicit and **not filtered by git tracking**: source archives
and newly added source files must be hashed. All entries are repo-relative POSIX
paths, sorted by raw codepoint ordering, with byte length and lowercase SHA256
of original file bytes (no text/newline normalization). Enumerate regular files
recursively in `ui/src/`, `ui/public/`, `ui/dev/`, `ui/e2e/`; include these exact
files: `ui/index.html`, `ui/package.json`, `ui/package-lock.json`,
`ui/vite.config.ts`, `ui/playwright.config.ts`, `ui/tsconfig.json`,
`ui/tsconfig.app.json`, `ui/tsconfig.node.json`, `ui/tsconfig.e2e.json`,
root `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`,
`tsconfig.bin.json`, `scripts/fix-shebangs.mjs`,
`scripts/write-ui-build-receipt.mjs`, `scripts/lib/uiBuildReceipt.mjs`,
`scripts/lib/uiBuildReceipt.d.mts`, `lib/presetCompiler.ts`,
`lib/presetCompiler.js`, `lib/videoMotionPresets.ts`, `lib/videoMotionPresets.js`,
`presets/camera-motion.json`, `presets/style.json`, `presets/lighting.json`.
Missing listed files fail. Root `.js` inputs are deliberately included because
Vite can resolve the existing emitted files imported by UI; they are NOT confused
with their TS source. Required server/CLI prebuilds precede UI for WP09 CI.

This covers current source imports at `ui/src/lib/presets.ts`,
`ui/src/lib/videoMotionSelection.ts`, `ui/src/store/storeGenImpl.ts` and
`storeVideoImpl.ts`, as well as the Vite config's `ui/dev` import. New build input
roots or root-module imports must extend this inventory and its tests in the same
change. No blanket scan of repository configs, home, node_modules or user data.
Dependencies are bound by both lockfiles on a trusted fresh install, not by a claim
that this receipt measures every installed dependency byte.

Reject symlinks/non-regular entries in selected inputs/outputs; never follow them
outside an owned build tree. Reject secret/artifact names in source input trees
(`.env*`, auth.json, config.json, database files), rather than reading their bytes.
Do not include dist, tsbuildinfo, node_modules, reports, pending state or receipt
in source input digest. Before build, check existence only (no contents) of
`.env`, `.env.local`, `.env.production`, `.env.production.local` in root and ui;
refuse these implicit Vite inputs in the deterministic fixture build path.
An ordinary source zip with no such files still builds normally.

Normalize only the known public Vite build switches into UiBuildOptions: mode is
production; `VITE_SOURCEMAP`/`VITE_IMA2_DEV` map to sourcemap/devUi with `=== "1"`;
`VITE_IMA2_NODE_MODE`, `VITE_IMA2_CARD_NEWS`, `VITE_IMA2_AGENT_MODE` map to
nodeMode/cardNews/agentMode with `!== "0"`. Reject defined values other than
`"0"|"1"` for these five switches. Reject unknown VITE_* names without printing
their values; the known VITE_IMA2_API_TARGET is dev-proxy-only and must be absent
or the fixed runner literal `http://127.0.0.1:1`, never persisted in receipt.
No raw env strings, credentials, hostnames, absolute paths or Git remote URLs are
serialized. Build options are included in sourceInputDigest and rechecked by the
consumer, not copied from the receipt as the expected value.

Canonical digest preimage, implemented in the module using node:crypto:

```js
// uiBuildReceipt.mjs digest core
import { createHash } from "node:crypto";
export function sourceInputDigest(files, options) {
  const entries = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(({ path, bytes, sha256 }) => [path, bytes, sha256]);
  const flags = [options.mode, options.sourcemap, options.devUi,
    options.nodeMode, options.cardNews, options.agentMode];
  return createHash("sha256").update(JSON.stringify([1, flags, entries])).digest("hex");
}
```

Output inventory walks **every** directory under dist, including hidden `.vite`,
and every regular file, including `index.html`, copied `fonts/*.woff2`, maps and
non-bundled public assets. Exclude ONLY the exact root receipt filename
`.ima2-ui-build-receipt.json`; do not use Vite's manifest as the whole output set.
Require nonempty index.html; reject symlink, path traversal, duplicate/case-colliding
paths, malformed entries, absolute/backslash paths and non-regular files. Sort
entries identically to input inventory. A missing or added output is a mismatch
even if all original bundled JS/CSS hashes still match.

One parent transaction, with all temporary state under the existing ignored
`ui/node_modules/.cache/ima2-ui-build/` directory. `.gitignore:4` ignores
node_modules and `:17` ignores ui/dist; no new ignore entry is necessary. Never
write build state to repository root, `.codexclaw`, `.ima2`, a user's HOME or an
unignored `ui/` sibling. Vite may wipe dist: no begin state is stored only there.

1. `beginUiBuild` requires the installed ui/node_modules directory and verifies
   cache parents are directories, not symlink escapes. Atomically `mkdir` the
   fixed `active/` child without recursive/exist-ok. EEXIST -> UI_RECEIPT_BUSY
   BEFORE invalidating receipt or running any compiler. Generate randomUUID nonce,
   store `{schemaVersion:1,nonce,source:UiSourceSnapshot}` as `active/input.json`;
   intermediate state stays in `active/input.tmp`. Return the transaction object
   and register that exact object plus its root/nonce in a private WeakMap.
   If begin itself fails after acquisition but before returning tx, its own catch
   closes watchers and removes only the lock/state it just acquired; the wrapper
   cannot clean a transaction it never received. A losing concurrent begin never
   cleans the winning process's state.
2. Capture source-input watchers before the initial digest. Watch selected input
   directories recursively and selected files' parent directories with exact
   filename filters; ignore only generated/output/cache paths excluded above.
   Any matching change/rename event (including edit then revert), watcher error,
   or missing input invalidates this transaction. Unsupported watching fails
   closed, not polling-as-proof. Rehash inputs after watcher installation, then
   invalidate the exact old dist receipt before executing the three build stages.
   Watchers remain active through publication and are closed in final cleanup.
3. Only the same wrapper process calls finish after all three awaited commands
   return exit 0. `finishUiBuild(repoRoot,tx)` requires private WeakMap identity,
   matching root and on-disk nonce/snapshot; absent, malformed, wrong nonce,
   foreign or already-finished tx -> UI_RECEIPT_TRANSACTION. It refuses any
   watcher invalidation or pre/post source/head/flag change with
   UI_RECEIPT_BUILD_CHANGED. A manually reconstructed snapshot cannot certify an
   old dist. Nonce is transient state only, never receipt/environment metadata.
4. Inventory outputs after Vite, compare source again, and stage receipt ONLY at
   `active/receipt.tmp`. Atomic rename publishes it into the ignored dist path;
   require same-filesystem rename (EXDEV is failure, no non-atomic fallback).
   Re-read the published receipt, full outputs and inputs before success. Any
   mismatch removes only this transaction's newly published receipt. No old
   receipt is restored. Consumers reject UI_RECEIPT_BUSY while active exists;
   producer's private final comparison occurs under its own held transaction.
5. `abortUiBuild(root,tx)` is idempotent: a completed/released transaction is a
   no-op, even if another build has since acquired active. For an active tx,
   verify nonce/identity before deleting its exact temp/input/lock paths; mismatch
   refuses deletion and reports UI_RECEIPT_CLEANUP. It removes its incomplete
   receipt, closes watchers and releases active only after the owned compiler
   child has exited. Success preserves the verified final receipt and releases
   all temporary state. No directory outside this owned cache subtree is removed.

The wrapper's finally path runs abort on tsc/Vite/finish failure. A crash/SIGKILL
can leave only ignored cache state and an unusable/missing receipt; next build
fails BUSY rather than borrowing/replacing it or guessing liveness from a PID.
For recovery, use a fresh disposable runner, or have the operator confirm no
owner is running before removing that exact cache lock directory. No automatic
stale-lock stealing. This is a small build lock, not an artifact service or an
OS-level race/security guarantee; trusted build tools and a controlled runner
remain required, and lost native filesystem events are not treated as a hostile-
writer containment claim.

Git binding: use a bounded `git rev-parse --show-toplevel` and `rev-parse HEAD`
in the source parent process, not guarded child. If this exact repo root has no
Git metadata, headSha is null and source digest is still mandatory. A present
but unreadable/broken Git repo is an error, not archive fallback. Do not bind a
source zip to a surrounding unrelated repo. In exact-head CI both producer and
consumer require current root Git HEAD; null is forbidden. Receipt head must
match current head whenever current Git exists, and source digest must also match
to catch uncommitted edits. Source archives without Git use source-digest binding;
that result is never labeled exact-head. CI requirements come from the runner's
existing CI/GITHUB_ACTIONS context, never a receipt field or caller skip flag.
For a source ZIP, install root/UI dependencies and run existing build:server and
build:cli first so the two explicitly hashed root emitted-JS inputs exist, then
run the same UI build wrapper. Missing prerequisites fail clearly; no Git init,
fabricated SHA or fallback to a prior dist. SourceZIP receipt acceptance does not
enable the git-tracked appServer projection or exact-head release gate.

`parseUiBuildReceipt` strictly validates the schema above (no unknown fields,
40-hex head or null, 64-hex digests, safe integer nonnegative byte lengths, sorted
unique normalized relative output paths); malformed JSON is UI_RECEIPT_SCHEMA.
`verifyUiBuildReceipt` reads the fixed receipt, recomputes current source and
complete output inventory independently, and calls this exact binding core:

```js
// uiBuildReceipt.mjs binding core (schema validation precedes this function)
export function assertUiReceiptBinding(receipt, current, outputs, requireGitHead) {
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  if (requireGitHead && (!current.headSha || !receipt.headSha)) fail("UI_RECEIPT_HEAD");
  if (current.headSha && receipt.headSha !== current.headSha) fail("UI_RECEIPT_HEAD");
  if (receipt.sourceInputDigest !== current.sourceInputDigest ||
      JSON.stringify(receipt.buildOptions) !== JSON.stringify(current.buildOptions)) {
    fail("UI_RECEIPT_SOURCE");
  }
  if (receipt.outputs.length !== outputs.length || receipt.outputs.some((file, i) => {
    const actual = outputs[i];
    return !actual || file.path !== actual.path || file.bytes !== actual.bytes ||
      file.sha256 !== actual.sha256;
  })) fail("UI_RECEIPT_OUTPUT");
  return current.headSha ? "git-and-source" : "source-digest";
}
```

Normalize parsed buildOptions property ordering to the declared order before
this call. Missing receipt is UI_RECEIPT_MISSING; source/head/asset errors are the
specific codes above; begin/finish input race is UI_RECEIPT_BUILD_CHANGED. All
errors propagate through projection's existing owned cleanup before server spawn.
Consumer never regenerates/repairs a receipt or drops an offending output.
Creation -> pending/receipt JSON -> strict parse -> projection copy/recheck and
WP12 evidence is the full chain. The receipt is not application state/auth data.

Standalone tests belong to `tests/ui-build-receipt.test.mjs` (discovered by the
existing `scripts/run-tests.mjs` regex), with focused command
`node --test tests/ui-build-receipt.test.mjs`. Tests import the shared module but
do NOT import app code, run Vite or need Playwright. Build a tiny owned source
fixture satisfying the explicit input table with independent literal content,
then exercise begin -> synthetic output creation -> finish -> verify. For the
CLI wrapper's script ordering, parse the real `ui/package.json` build entry and
assert it invokes the wrapper once; run wrapper against synthetic installed
tsc/Vite executable stand-ins recording order. Assert acquire -> first tsc ->
E2E tsc -> Vite -> finish, and nonzero at ANY stage never publishes a receipt;
actual Vite
integration and emitted startup remain a separate clean-runner WP09 gate.

| Test ID | Independent activation/oracle |
| --- | --- |
| UIR-1 valid | Source fixture contains index/src/public font/presets/root shared modules; dist contains index.html, hashed JS, `.vite/manifest.json`, public font and extra regular public asset. Receipt lists EVERY output once with independently computed byte counts/digests; verify returns git-and-source with same fixture commit. |
| UIR-2 missing/schema | No receipt, malformed JSON, wrong schema, duplicate/traversal/absolute paths, symlink, missing index: expected typed error, no projection copy/spawn. Parser does not invent defaults. |
| UIR-3 stale HEAD | Receipt bound to commit A then source repo HEAD B with identical input bytes: UI_RECEIPT_HEAD. Missing Git in exact-CI mode also fails. |
| UIR-4 source changed | Change source CSS/TS, index.html, public font, root preset, root emitted shared JS, Vite config or lockfile after receipt (one at a time): UI_RECEIPT_SOURCE. Add/remove a selected source file changes digest too. Never refresh the receipt to satisfy this negative. |
| UIR-5 output tamper | Change dist/index.html then dist/fonts/example.woff2 in separate cases, keeping byte length equal; each gives UI_RECEIPT_OUTPUT even with unchanged JS/CSS and Vite manifest. Repeat with missing file and altered length. |
| UIR-6 full inventory | Add unlisted dist/public-extra.bin or a hidden regular asset, or remove an original asset: UI_RECEIPT_OUTPUT. Receipt itself is the sole excluded output; no extension allowlist. |
| UIR-7 archive | Source zip fixture outside any repo: headSha null, correct source digest and all outputs pass as source-digest; same data requireGitHead=true fails. Broken `.git` fails rather than becoming an archive. |
| UIR-8 build transaction | Missing/malformed begin, copied tx object, mismatched nonce and replayed finish fail UI_RECEIPT_TRANSACTION. Hold one wrapper: concurrent begin returns BUSY before compiler/receipt mutation. Input edit, edit-then-revert/watch invalidation, head/flag change during build -> UI_RECEIPT_BUILD_CHANGED, no valid receipt. Simulated failure at each tsc/Vite stage releases only owned state; later normal build succeeds. Crash orphan refuses reuse; old tx cleanup cannot remove newer lock/receipt. |
| UIR-9 producer privacy/copy race | Synthetic secret env names/values are neither copied nor logged; unknown VITE_* rejects without value disclosure. After verify mutate source dist during projection copy: post-copy hashes/inventory reject, owned projection cleaned, app never spawned. |
| UIR-10 release cleanliness | In a disposable source checkout, record git status before/after successful and failed wrapper runs and simulate abandoned active state. No new nonignored paths; ignored cache and dist only. Vite's dist deletion preserves active/input.json. No `.codexclaw` or `.ima2` write. Verify ignores with git check-ignore, not by weakening release assert-clean. |

Use a second hand-computed SHA256 oracle for a fixed tiny ordered input set and
assert reordering enumeration does not change its digest. Tests must not compute
their expected digest with sourceInputDigest itself. Dispose only owned synthetic
dirs in finally; never read real dotenv, credentials, media or mutate project dist.
WP09 updates the generated test inventory with the existing classifier after
adding this test. No new framework, test runner flag or package dependency.

Serialized policy, parsed/validated by the preload before installing guards:

```ts
type FixturePolicy = {
  version: 1; root: string; home: string;
  dependencyRoots: string[];
};
```

Require absolute real root/home/dependency roots, `process.cwd()===root`, owned
policy path inside root and matching `IMA2_E2E_HOME`. Reject malformed/unknown
fields before any dynamic app import. Every app child process/worker API denies.
The policy's producer is appProjection, serializer is JSON at policyPath, parser
is appNetworkGuard, consumers are the three guards; never persisted to app state.

### `appFilesystemGuard.mjs` — exact app-facing boundary

Exports `installFilesystemGuard(policy, report): () => void` for preload and
isolated contract probes only. `report` receives
`{type:"ima2-e2e-file-denied", operation:string,
category:"outside-fixture"|"expected-discovery-metadata"}`;
never raw path or contents. The returned restoration function is idempotent;
the app child retains the guard until exit, while in-memory probes restore in
`finally`. No app source imports this API. `root` is emitted runtime, not source staging.

Install order is binding: capture builtin originals, assign `os.homedir = () =>
policy.home`, install file wrappers, then `syncBuiltinESMExports()`, THEN import
server.js. An env omission or `IMA2_TEST_HOME` alone cannot cover `codexDetect`'s
module-level `HOME = homedir()` or quota's default home argument. The private home
installer has this exact body; `installFilesystemGuard` calls it after validating
policy.home and includes its restore in the returned finalizer:

```js
// appFilesystemGuard.mjs home installer (private)
import os from "node:os";
import { syncBuiltinESMExports } from "node:module";

function installAppHome(home) {
  const original = os.homedir;
  os.homedir = () => home;
  syncBuiltinESMExports();
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    os.homedir = original;
    syncBuiltinESMExports();
  };
}
```

Implement `checkPath(value, operation, write=false): void` with this exact policy:
convert file URLs using fileURLToPath, Buffers using UTF-8, strings using resolve;
reject numeric FDs supplied from outside the guard (no inherited read FDs beyond
stdio/IPC). Check BOTH lexical location and nearest-existing-parent realpath plus
missing suffix; use captured realpathSync/lstatSync, reject symlink escapes. A
proper descendant comparison uses `relative` and path separators, never startsWith
on an unseparated root. No target content is opened during canonicalization.

- All data reads/writes/copy destinations: allow only `policy.home` and its
  canonical descendants, except its synthetic migration sources under `runtime/`,
  `.npm-global/`, `.nvm/`, `.fnm/`, `.volta/`, `.bun/`, `.config/yarn/`, `.asdf/`,
  `.local/share/`, `Library/pnpm/`, `.npm/`, `AppData/`: deny those subtrees.
- Projection source/assets: read-only. Deny `.env*`, `.ima2`, `generated`, auth
  files and database components even if they were maliciously placed in root
  after construction; allow only `ui/dist` build assets from the receipt. No
  copy source from a projection `generated` directory.
- Dependencies: read-only module loading. Deny `.env*`, `.ima2`, `.codex`, `.grok`,
  `.progrok`, `generated`, `auth.json`, `config.json`, `*.db`, `*.sqlite*` at any
  component. Metadata lookup of ancestor directories of approved roots is allowed
  for module resolution ONLY (`stat`, `lstat`, `realpath`, `access` variants), not
  readFile, readdir, open or copy. The original repo is not an allowed data root.
- Everything else denies before original content/read/copy operation. In particular
  the hardcoded `/opt/homebrew` and `/usr/local` migration candidates stay denied
  even though `IMA2_TEST_EXEC_PATH/ARGV1` redirect the other runtime prefixes.

Wrapper coverage and return behavior are part of the contract, not optional:

| Builtin methods (apply unsuffixed, Sync, fs.promises where present) | Checked operands | Denial behavior |
| --- | --- | --- |
| readFile, readdir, opendir, stat, lstat, realpath, access, readlink | path 0 | sync throws; callback queued with error; promises reject |
| open | path 0 plus flags: anything except read-only is a write | same; successful FileHandle/FD remains tied to its checked path |
| copyFile, cp | source 0 read AND destination 1 write | deny source before mkdir/copy; no partial destination |
| writeFile, appendFile, mkdir, rm, rmdir, unlink, truncate, chmod | path 0 write | deny outside home before mutation |
| rename | both paths write | neither source deletion nor target replacement outside home |
| symlink, link | both operands | always deny; fixtures do not require runtime links |
| existsSync / exists | path 0 | record denial then false / callback(false); never probe original |
| createReadStream / createWriteStream | path 0; also reject supplied `fd` | throw typed error synchronously before stream construction |

All other listed callbacks preserve native return values on allowed operations and
use `process.nextTick(() => callback(error))` on denial (exists is the documented
boolean exception); they never throw after scheduling a callback. Error is
`Object.assign(new Error("fixture filesystem access denied"),
{code:"E2E_FILESYSTEM_DENIED"})`. Promise wrappers catch sync validation errors and
return rejected promises. Track allowed open/openSync FDs; read/readv/fstat/write/
ftruncate and FileHandle equivalents accept only tracked descriptors and honor
their read/write mode; remove tracking on close, preserve native close results.
Do not forward untracked descriptor reads to native APIs. Module-loader-internal
reads, native addons, native FileHandle internals and races are NOT proven covered
by this JS policy: the clean-runner restriction remains the final exposure bound.

Expected filesystem discovery records are DENIALS, not permission to read. Use
`expected-discovery-metadata` only for these operation/path combinations,
classified before path redaction; all content/open/copy calls remain unexpected:

- `existsSync` of `root/.ima2/config.json`: server loaders probe this even with a
  valid explicit config lacking a key. Return false without original call,
  including if a poisoned fallback really exists; record the refusal.
- `stat` of `root/generated` or the four exact `/opt/homebrew|/usr/local` plus
  `/[lib/]node_modules/ima2-gen/generated` paths: reject before original stat.
- `stat` of home legacy paths ending in `node_modules/ima2-gen/generated` and
  beginning in one of the forbidden home migration subtrees; `readdir` of the
  exact wildcard bases at `storageMigration.ts:153-166`, substituting fixture
  home/default env. Freeze these literal patterns in the fixture, never derive
  the expected list by calling the production function under test.

Count these in `expectedLegacyProbes` (includes the package-key metadata probe).
I6/I7 assert these counters fire and underlying metadata/content/copy calls stay
zero. Ordinary assertClean permits only this metadata category, not arbitrary
errors swallowed by app catches. Independent content-read negatives must report
`outside-fixture` and ordinary assertClean must fail. No read/copy is admitted
by classifying discovery refusal as expected; new patterns require amendment.

### `appNetworkGuard.mjs` full new-file design

ESM preloader installed ONLY in the fixture's emitted-JS child invocation:

```ts
spawn(process.execPath, [
  "--import", projection.guardPath, projection.entryPath,
], { cwd: projection.root, env, stdio: ["ignore", "pipe", "pipe", "ipc"] });
```

No exported app runtime API. Read and validate the owned policy, install the
filesystem/home guard, process guard, then TCP guard; synchronize builtins before
the entry module loads. Send `{type:"ima2-e2e-guard-ready",version:1}` after all
three are installed. Parent requires this IPC record AND actual server listen;
either missing means startup failure/cleanup. Validate `IMA2_E2E_ALLOWED_ORIGIN` before installation;
missing/malformed values throw before loading server. Keep one original
`net.Socket.prototype.connect`; normalize supported connect overloads (options,
port/host, normalized internal args) and reject Unix-domain sockets and any
host/port other than the exact allowed `127.0.0.1:<stubPort>` BEFORE original
connect/DNS. Throw an Error with `code="E2E_EGRESS_DENIED"`; report an IPC record
`{type:"ima2-e2e-denied",transport:"tcp",host,port}` containing no path/query/key.
Built-in fetch/HTTP/HTTPS and SDK transports using Node sockets must all fail
through this boundary. Do not patch only global fetch or count stub arrivals.
HTTP redirects to an unowned destination must also hit this check.

`appProcessGuard.mjs` complete installer (R1-07). It blocks every listed public
API and the lower asynchronous spawn hook, plus worker creation. No compiler
exception: the child uses emitted JS. Reporting only safe API/kind fields prevents
command arguments (potential tokens) leaking to artifacts. `classify` is the exact
read-only discovery matcher described below, not a permission predicate.

```js
// appProcessGuard.mjs
import childProcess from "node:child_process";
import workerThreads from "node:worker_threads";
import { syncBuiltinESMExports } from "node:module";

export function installProcessGuard(report, classify) {
  const restores = [];
  const deny = (api, args) => {
    const discovery = classify(api, args);
    report({ type: "ima2-e2e-process-denied", api, discovery });
    throw Object.assign(new Error("fixture subprocess denied"), {
      code: "E2E_PROCESS_DENIED",
    });
  };
  const patch = (target, key, api) => {
    const original = target[key];
    target[key] = function (...args) { return deny(api, args); };
    restores.push(() => { target[key] = original; });
  };
  for (const api of ["spawn", "exec", "execFile", "fork",
    "spawnSync", "execSync", "execFileSync"]) {
    patch(childProcess, api, api);
  }
  patch(childProcess.ChildProcess.prototype, "spawn", "ChildProcess.spawn");
  patch(workerThreads, "Worker", "Worker");
  syncBuiltinESMExports();
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const restore of restores.reverse()) restore();
    syncBuiltinESMExports();
  };
}
```

Signature: `report(record): void`; record has the literal type above, `api:string`,
`discovery:"agy-version"|"grok-version"|"codex-login-status"|null`.
`classify(api:string,args:unknown[]): record["discovery"]`. Every rejected API
throws synchronously BEFORE any original call, even callback-style APIs; no fake
ChildProcess, Buffer, SpawnSyncReturns or successful exit status is manufactured.
Promise executors naturally reject this throw; real startup tests must show that
actual callers catch it. The return value of the installer is idempotent restore,
used only by disposable probes; the app keeps the interception until exit.

Expected discovery is a refused operation, never a launch allowance. Match
`spawn` only for agy `['--version']` (`routes/models.ts:351`); match
`execFileSync` only for grok `['version']` and
Codex `['login','status']`, or `[resolvedBundledCodexBin,'login','status']` when
executable is process.execPath. Resolve the bundled script only from the approved
dependency manifest before app import; no app helper import. Match bare platform
binary names or exact home-local agy candidates returned by the independently
specified paths in `lib/agyCli.ts:9-17`, not basename/substring on arbitrary paths.
No exec shell command, changed argument, worker or nested arbitrary Node can be
classified as expected. Expected records are stored separately and asserted by
I9; all other attempts fail assertClean. Do not set a nonexistent IMA2_AGY_BIN.

Quota (`routes/quota.ts:153`) legitimately attempts grok version even without
tokens; Codex detection (`lib/codexDetect.ts:73,90-123`) can probe bundled Node,
PATH and Windows `.cmd` to query OS keyring. All are denied before execution,
returning the existing unavailable/error classification rather than authed/ready.
I9 must prove these exact consumers activate, not just call a mocked API by hand.

Poisoned-path tests create ONLY owned synthetic trees: an original-home stand-in
and fake `opt/homebrew`/`usr/local` trees beneath a separate test mkdtemp. They do
not populate the actual user's home or system prefixes. `migrateGeneratedStorage`
already accepts `options.legacyDirs`; use those explicit synthetic outside paths
for real read/copy-denial activation. Separately observe actual default global
candidate stat calls being rejected before native metadata access. This separates
real path-policy proof from an invented claim that test stand-ins are OS mounts.

The preloader is bounded test isolation, not an OS security sandbox. Known bypasses:
native addons/raw syscalls, internal loader reads or a new unpatched builtin API.
This WP uses trusted app code and validates every exercised transport, not arbitrary
adversarial code. If a new lane needs a bypass, stop and request an isolated runner;
do not weaken the allowlist. Final universal enforcement layer: none. The transport
tests are automated prevention for the tested Node path; broader claims are E7
review guidance and must be worded accordingly.

### `appServer.ts` concrete before/after contract

Before: `const env = {...process.env, ...}` and conditional OAuth port; spawn has
three stdio streams; close sends SIGTERM, sleeps 200ms, closes stub.
After: call `makeAppEnv`; load guard first; attach IPC handler before awaiting the
startup log and guard-ready IPC; collect denied destinations. On startup timeout, exception or early
exit, terminate only this owned child, await its exit and close its stub before
rejecting. `close()` is idempotent, waits for exit with bounded escalation for the
owned PID, then closes stub and disposes only the owned projection. Preserve the
registered test home for restart; worker teardown owns its final deletion. No
broad process kill or user-home cleanup. Failure aggregates cleanup errors and
assertions without masking the original startup error.

Preserve existing AppHandle fields; add only:

```ts
isolation: {
  deniedConnections: ReadonlyArray<{ transport: "tcp"; host: string; port: number }>;
  deniedProcesses: ReadonlyArray<{ code: "E2E_PROCESS_DENIED"; executable: string }>;
  deniedFilesystem: ReadonlyArray<{ operation: string; category: "outside-fixture" }>;
  expectedDiscoveries: ReadonlyArray<{
    api: string; discovery: "agy-version" | "grok-version" | "codex-login-status";
  }>;
  expectedLegacyProbes: number;
  assertClean(): void;
};
```

Parent maps unexpected process records to the preserved `{code,executable}` shape;
`executable` is the safe API label, not a command/path. Expected refused discoveries
are not part of unexpected `deniedProcesses`. Exact discovery metadata probes
are likewise separate counted expected observations, not swallowed exceptions.
`assertClean()` fails on any unexpected refusal. `close()` checks it only AFTER
cleanup; a failing security assertion must not leave the service running.
Retain `assertStubOnlyCalls(stub)` for source compatibility but describe its narrow
Host-header meaning. WP12 calls `app.isolation.assertClean()` and uses the same
cleanup. It does not create another startApp or second network policy.

Automatic cleanup lives in appServer, not a new competing fixture. Add these
test-only exports alongside retained startApp/seedBrowser; all existing journey
imports and WP12's integrated spec use this `test` (not bare Playwright test):

```ts
import { test as base, expect } from "@playwright/test";
export { expect };
export const test = base.extend<{}, { ownedAppCleanup: void }>({
  ownedAppCleanup: [async ({}, use) => {
    try { await use(); }
    finally { await disposeOwnedApps(); }
  }, { scope: "worker", auto: true }],
});
```

Private `disposeOwnedApps(): Promise<void>` snapshots the registered app records,
awaits every record's idempotent close (collects errors, continues others), and
checks every child's observed exitCode/signalCode before touching its home. If
any child exit is unconfirmed, retain its projection/home, report cleanup failure,
and let the disposable runner teardown remove the environment. Otherwise invoke
each registered home's captured disposer once, remove its registry entry only on
success, and throw `AggregateError(errors,"fixture cleanup failed")` if any close/
dispose failed. Disposers recheck realpath/lstat against the captured mkdtemp path
and refuse changed identity; rm is limited to that exact owned directory. No
afterAll in another process that cannot see this registry. A failure-path test must
prove cleanup runs when the test body throws and same-home restart works before
worker teardown; no ownership token/home path may appear in uploaded artifacts.
This additive `test` export changes no startApp/hold/transport API, but main must
align the WP12 integrated spec's import in `120` with it.

Browser contexts add a request route allowing only the exact app origin and owned
stub origin plus `data:`/`blob:` assets; abort other URLs and record their origin.
Use serviceWorkers `block` on test-owned contexts. No shared browser/profile.
This browser check does not substitute for the server socket guard.

## Reload-safe initialization contract

Keep `seedBrowser(page, options): Promise<void>`, but factor/export its options:

```ts
export type BrowserSeedOptions = {
  provider?: import("../../src/types").Provider;
  dismissOnboarding?: boolean;
  imageModel?: string;
  generationDefaults?: Record<string, unknown>;
  workspaceProfile?: "default" | "prompt-studio";
  locale?: "en" | "ko" | "zh-Hans" | "zh-Hant";
  seedId?: string;
};
```

Before: addInitScript unconditionally writes generationDefaults/imageModel.
After: the init script checks a fixture-only **sessionStorage** marker,
`ima2.e2e.seed.<seedId>` (default `initial`). If present, return without any writes.
Apply one complete seed payload, then set the marker. Restrict seeding to HTTP(S)
documents so about:blank cannot throw. Never install a second conflicting seed
script on the same page. For a fresh case use a fresh context; for reload keep the
same page/origin, no seed call. The marker is not a production persistence key.
J5's restarted app uses a new origin and deliberately gets its initial seed;
that row is server recovery, not localStorage survival.

Use typed `provider:"nai"` in J7, not the oauth-plus-override workaround. Preserve
legacy precedence `generationDefaults` wins for intentionally corrupt-state rows.
If new provider is not minimax/oauth, require explicit imageModel in fixture
validation instead of guessing a possibly invalid current model.
Runtime language uses `ima2.locale`; profile uses `ima2.workspaceProfile`; draft
values go under existing `ima2.generationDefaults`, model under `ima2.imageModel`.
No new app field/enum chain: test options serialize into init payload, deserialize
there, and are consumed only by existing storage readers (`003` anchors).

## Stub capture and recovery

Preserve StubMode union. Add to StubHandle:

```ts
generationRequests: ReadonlyArray<{ path: string; body: unknown }>;
setMode(mode: StubMode): void;
holdNextGeneration(): { submitted: Promise<void>; release(): void };
```

Before `/image_generation`: `void readBody(req).then(() => { ... })` discards body.
After: parse body once inside try/catch, append `{path:new URL(...).pathname,body}`,
then choose response from mutable currentMode captured at request handling time.
Malformed JSON returns deterministic 400; never a floating rejected promise.
`setMode` changes subsequent responses, not earlier requests. Retain tiny PNG.

`holdNextGeneration()` is the agreed WP12/120 cancellation seam, owned here in
the test-only `stubUpstream.ts`. It arms exactly the next `/image_generation`
request, not model/status probes. Calling it while another hold is armed or held
throws an explicit fixture misuse error; no implicit queue or timer is introduced.
The request body is fully parsed and appended to `generationRequests` before
`submitted` resolves. While held, no response headers or image bytes are sent.
Snapshot the response mode when the request arrives, so later `setMode()` calls
cannot change an already-submitted request's outcome.

`release()` is idempotent, including release before arrival: it opens this one
hold's response gate, never another request's. A disconnected/destroyed response
is not written; remove listeners and settle internal waits. `stub.close()` releases
pending gates and closes only its owned connections so failure cleanup cannot
hang. If closed before submission, reject the pending `submitted` promise with
a fixture-closed error and ensure the fixture observes that rejection. Handle
request read/abort errors explicitly; no floating promise or unhandled rejection.
Tests must await submission with the existing test timeout, never arbitrary sleeps.

Exact WP12 consumer sequence (no production API addition):

```ts
const held = app.stub.holdNextGeneration();
// Drive the existing Generate button with a synthetic MiniMax prompt.
await held.submitted;
// Drive the existing cancel action for this request and await its observable
// canceled terminal state through the current WP07 UI/API contract.
held.release();
// Assert no result from this canceled request is published or stored.
```

WP12/120 owns the real cancellation journey and its current WP07 request-id/
terminal-state selectors; WP09 owns this hold method and its deterministic fixture
tests. Required proof is ordered: one upstream request arrived, no stub response
was sent before cancel, the application's cancel transition completed, then the
upstream gate was released. After release, the canceled request must produce no
new gallery/result item, no successful terminal SSE event, and no persisted
history/generated-media result attributable to that request. Compare request IDs
or unique synthetic prompt markers and before/after result inventories; absence
of a visible tile alone is insufficient. Inspect after reload/reconciliation too.
The server may have disconnected upstream before release; that is valid cancellation,
not a reason to force a stub write. A late synthetic upstream completion must never
be admitted as application output. This proves local cancellation behavior, not
that any real provider stopped computation or refunded credits.
Offline OAuth/Grok status probes return deterministic unready responses except
oauth-expired returns existing 401; do not advertise provider readiness globally.
Selection-only NAI/Comfy catalogs are browser-route fixtures with explicit
lane status and the shape read by `api-comfy.ts`, not an upstream-generation claim.
Use no live key-status fetch to make a dropdown selectable: install a fixed
`GET /api/models` JSON fixture before navigation for transition cases, containing
`{ok:true,lanes:{oauth:{status:"ready",models:{image:[],video:[]}},
minimax:{status:"ready",models:{image:[],video:[]}},
nai:{status:"ready",models:{image:[],video:[]}},
comfy:{status:"disconnected",models:{image:[],video:[]}}}}`.
Static core image options still come from real UI model data. J6-S3 deliberately
keeps its removed workflow absent, so the production fallback row must name it.
For Home provider-choice cases, intercept `/api/keys/status` with all seven
`KeyStatus` entries (`configured`, `source`, `valid`, `maskedKey`), set only
minimax/nai valid for the scenario, `source:"fixture"`, `maskedKey:null` everywhere.
This models availability in the browser only and does not write a server key.
Ordinary J1/J2/J3/J5 retain real local app status routes and owned stub responses.

J3 activation: first request gets billing error, assert named error and editable
draft; `app.stub.setMode("minimax")`; edit prompt; retry through actual Generate;
assert second captured body has the new text and a real local result tile appears.
Do not infer success from only a toast disappearing.

## DOM measurement helper — complete new-file responsibility

`composerAssertions.ts` imports only Playwright's `expect` and types. Exports:

```ts
export type PaneSurface = "sidebar" | "bottom" | "mobile" | "home";
export async function measurePanes(root: Locator, surface: PaneSurface): Promise<{
  positiveHeight: number; negativeHeight: number;
  positiveMaxHeight: string; negativeMaxHeight: string;
  gridBottom: number; toolbarTop: number; rootBottom: number;
  horizontalOverflow: number;
}>;
export async function expectUnobscured(control: Locator): Promise<void>;
export async function expectPaneDescriptions(root: Locator): Promise<void>;
```

Map only DOM selectors: classic `.composer__textarea`, `.negative-prompt__textarea`,
`.composer__prompt-panes--dual`, `.composer__toolbar`; Home `#home-prompt-input`,
`.negative-prompt__textarea`, `.home-prompt__panes--dual`, `.home-prompt__footer`.
Throw on missing/ambiguous root/field, never turn a null rectangle into zero success.
Measure raw rectangles/scroll sizes; expectations stay literal in individual tests.
`expectUnobscured` scrolls the control into view, polls center-point hit containment,
checks viewport and then `click({trial:true})` for enabled buttons. Also check focus
after keyboard focus; a disabled button must remain disabled, not force-clicked.
For mobile, compare against sticky `.compose-sheet__actions` as well as viewport.
Descriptions resolve each field's label/htmlFor and aria-describedby id to visible
text; scroll each hint into the usable scrollport. Do not require offscreen content
to lie inside the grid's current rect. Long textarea content needs `scrollTop>0`
and access to its end; a PNG alone cannot prove it.

## Activation matrix (explicit cases, not a giant Cartesian product)

All cases use local fixture state and actual DOM controls, not `useAppStore.setState`.
Tests can select modes using NavRail `#home`/`#create` routes and their actual
buttons; desktop Create's verified anchor is `nav[aria-label='Main navigation']`
button `Create`. Localized cases use IDs/scoped CSS and dictionary-backed names.
Provider IDs: desktop `.sidebar #sidebar-generation-provider`; mobile
`.mobile-app-bar #sidebar-generation-provider`. `GenProviderModelSelect.tsx:459`
uses the SAME ID in compact mode (`MobileAppBar.tsx:48`), so scope to visible host.
No generic `.first()` to accidentally measure a hidden desktop composer on mobile.

| ID / file | Activation | Independent assertion |
| --- | --- | --- |
| I1 / fixture-isolation | Synthetic inherited env with sentinel secrets, hostile endpoint/HTTP proxy/NODE_OPTIONS; each StubMode | Sentinels absent; only owned endpoints present; both proxy ports equal stub port, empty dotenv path owned. No real credential values used. |
| I2 / fixture-isolation | Child loads guard; fetch and http/https attempt public hostname, unowned loopback listener, redirect to that listener | `E2E_EGRESS_DENIED`, listener receives zero requests; no DNS/connect called on refused host; allowed stub receives exactly one control request. |
| I3 / fixture-isolation | Invoke spawn, exec, execFile, fork, spawnSync, execSync, execFileSync and ChildProcess.prototype.spawn; create Worker; repeat public functions via named ESM imports | Every call throws `E2E_PROCESS_DENIED` before original native call, counter fires independently per API; fake executable creates no sentinel. No compiler/process allowlist. Separate I9 proves emitted app startup. |
| I4 / fixture-isolation | Execute installed seed against synthetic storage twice, mutate draft between calls | Second call preserves edited value, first defaults applied once; different new context receives fresh defaults. |
| I5 / fixture-isolation | Arm hold, send one owned stub generation, await submitted, inspect response gate, release; repeat with abort/close | Exactly one parsed request captured before submission resolves; no headers/body before release; one response after release when connected, no write after disconnect; double release harmless; second concurrent hold rejected; close settles waits without leaks. |
| I6 / fixture-isolation | Disposable runner real startup, valid/missing/malformed primary config; poison source package `.env`, `.ima2/config.json`, generated media are excluded before projection copy. Separately inject synthetic `.ima2/config.json` into runtime AFTER projection and let the real key loaders call existsSync | Expected-discovery-metadata count increases; existsSync returns false BEFORE original call; poison content reads/copies are 0; real keys/status has no poison key, media/history unchanged. deniedFilesystem remains empty and ordinary assertClean PASSES. This tests the expected fallback probe, not a forbidden content-read path. |
| I6-content / fixture-isolation | Separate guarded child deliberately invokes readFileSync/readFile or copyFile on that same poisoned runtime `.ima2/config.json`, bypassing the loader's existsSync early return | E2E_FILESYSTEM_DENIED before content read/copy, category outside-fixture; unexpected deniedFilesystem count increases, original content/copy counters 0, ordinary assertClean FAILS as expected. Catch/assert cleanup rejection only after owned child exit; never reinterpret this as the ordinary startup outcome. |
| I7 / fixture-isolation | Synthetic original home and runtime/global sources contain distinct poison markers; fixture home has only a neutral config marker and NO auth/version files; load real storageMigration, codexDetect and quota only AFTER preloader | Both default and named homedir yield fixture home; `codexAuthPaths` paths all use fixture home, no parent HOME/CODEX_HOME writes. Migration candidates from IMA2_TEST_HOME/EXEC_PATH/ARGV1 stay synthetic except four hardcoded globals; expected global stat denials occur before underlying calls. Candidate explicitly pointing at outside poison dir is refused; `copied===0`, destination inventory unchanged, original content-read/copy counters zero. |
| I8 / fixture-isolation | Each guarded fs read API: direct path, sibling-prefix path, file URL, Buffer, symlink escape, copyFile/cp source and destination, supplied fd; callback/promises/Sync forms | Independent outside sentinel-read and copy counters remain zero; typed error/exists=false as specified. Allowed synthetic-home read and write succeed and cleanup works. Positive module read succeeds but dependency generated/auth/config reads deny. Remove guard only inside a fully synthetic test: same sentinel becomes readable, proving the negative oracle. |
| I9 / fixture-isolation | Guarded emitted server startup plus real models/keys/quota discovery requests; emitted Codex detect and inspectGrokWeeklyEligibility invoked in isolated guarded child with absent fixture auth/version files | guard-ready precedes listen; actual local routes respond; Codex `proxyReady:false`, `authed:false`, `probe:"error"` (blocked CLI), Grok `{eligible:false,reason:"no-auth",candidateCount:0,clientVersion:null}`; exact expected refused discovery records nonempty. No live keyring/proxy launch, no fixture auth marked ready, unexpected process/network/filesystem denials zero. Stale emitted output, missing manifest/guard or forced startup exit prevents listen and cleans child/stub/projection. |
| J6-R / J6 | Comfy → GPT using real provider select, then same-origin reload | Exact `5.6l` label, comfy fields null both before/after reload, selected provider/model survives; no init reseed. |
| G1 / J7 | Retain 1157×826/sidebar, 1440×1000/bottom, 390×844/mobile cases | Original 72px floor preserved; bottom both >=86/max148; mobile both >=160; toolbar nested controls unobscured. |
| G2 / J7 | Sidebar 1024×600, bottom 1440×600, mobile 320×568 | Fill both with 120 lines and a 512-char unbroken token; scroll field and grid/body; all hints/toolbar/actions reachable, document horizontal overflow <=1px. |
| G3 / J7 | Home NAI 1440×900, 768×900 and 390×844 | 168/144 floors, true container-driven columns, long text does not widen page, footer receives pointer/focus. |
| G4 / J7 | Same page resize 800→801→1024; NAI and MiniMax | Correct mobile/desktop owner visible, closed sheet inert, dual class only for NAI; no stale height or invisible duplicate input used. |
| G5 / J7 | Locale ko/zh-Hans/zh-Hant in paired Home/mobile/sidebar cases; dark then light | Real translated labels/hints resolve and fit, focused field/control unobscured, no literal translation keys. Screenshots inspected; do not call pixel text fit a language-quality proof. |
| T1 / J8 | Home NAI type distinct positive/negative → Create → Home | Exact drafts survive; sidebar is only visible desktop classic owner, Home negative has same value; no generation POST. |
| T2 / J8 | Classic NAI → MiniMax → NAI via provider select; same-origin reload | Negative disappears/reappears with original literal `@not-a-mention`, positive unchanged; final provider `nai`, model `nai-diffusion-5-full`, trigger `nai v5`; intermediate MiniMax model `image-01` / trigger `minimax`. |
| T3 / J8 | Prompt-studio profile seeded once; enter Create, resize to mobile, open sheet, edit and resize back | Same positive/negative values and profile survive; sheet closes on desktop; bottom composer visible; no permanently hidden focused field. |
| T4 / J8 | Mobile open Prompt; ArrowRight/Left/Home/End across tabs, Escape and reopen | aria-selected and tabpanel linkage correct, values retained; focus returns to actual `.mobile-app-bar__generate` opener; Ctrl/Cmd+Enter not swallowed by tabs. |
| T5 / J8 | Each classic positive/negative and Home positive/negative composition chord sequence | Generation request count 0 during composition and 1 after commit; plain Enter inserts newline, negative text has no mention menu. Capture request at browser boundary, fulfill synthetic error, no upstream dispatch. |
| T6 / J8 | MiniMax positive: attach synthetic PNG using existing hidden file input, remove tray entry leaving tag, scroll/resize | Retired highlight follows textarea; mirror width/padding/line-height match measured input and scroll offsets; pointer goes to textarea; no duplicate insertion during IME. |
| E1 / J2 | Existing oauth-expired → reauth CTA → close Settings | Settings/Providers reached, exact original draft retained, Generate and textarea usable, no login or external navigation. |
| E2 / J3 | MiniMax billing failure → edit → local stub retry | Named billing error, busy cleared; two captured requests with distinct prompts, final local image visible and owned isolation clean. |
| R1 / J5 | Generate locally, close owned server, start new server with same fixture home | Gallery result restored, no second generation POST required. Explicit Create before editing; not mislabeled as localStorage reload. |

Keyboard tests must cover Control and Meta separately using KeyboardEvent's actual
`isComposing` flag for synthetic composition activation; this is handler evidence,
not proof of every OS IME. WP12 performs supervised/native IME observation if the
release claim includes real OS composition. Synthetic attachment fixture uses no
user file. NAI/Comfy selection tests never click a generation endpoint unless its
browser interception was installed first and counted.

### Concrete modifications to existing journey bodies

J6-S2 before: provider click → label/storage checks → screenshot. After: retain all
checks, add `await page.reload()` (no second seed), wait for the same model trigger,
then repeat exact `5.6l`, provider and null-workflow assertions. J6-S1/S3 remain
separate corrupt-hydration cases; don't replace them with the transition case.

J7 before: local `geometry()` returns booleans; three test bodies repeat setup.
After: import `measurePanes/expectUnobscured/expectPaneDescriptions`, assert raw
heights with literals from WP08, loop over actual `.composer__toolbar button`
including descendants, and add named G2–G5 cases. Preserve old screenshot names
only for old cases; new case attachments include surface/viewport/locale labels.
Example bottom acceptance (independent of the stylesheet implementation):

```ts
await expect.poll(async () => (await measurePanes(composer, "bottom")).positiveHeight)
  .toBeGreaterThanOrEqual(86);
await expect.poll(async () => (await measurePanes(composer, "bottom")).negativeMaxHeight)
  .toBe("148px");
for (const button of await composer.locator(".composer__toolbar button").all()) {
  await expectUnobscured(button);
}
```

J2 before: close Settings → Generate visible. After: same checks + original
`"expired session"` textarea value, focus textarea, fill `"retry draft"`, assert
value/selection; no login call or auto-generation is needed to prove edit recovery.
J3 before: billing copy + stub call existence. After: retain those checks, set stub
mode to minimax, fill `"after billing recovery"`, click Generate once, assert
`generationRequests.length===2`, bodies' `prompt` values equal independently fixed
`"billing failure"` and `"after billing recovery"`, final local tile visible, and
Generate is enabled again. Seed `promptMode:"direct", multimode:false` for exact
prompt oracle; do not let an unrelated prompt planner rewrite these strings.
J5 before: goto → unscoped composer fill on the initial Home. After: goto → actual
Create button → scoped sidebar textarea fill; retain the same-home server restart
and result prompt assertions. This is a reachability repair, not a lifecycle change.

For T5 use independent contexts per surface/field/modifier so Home's post-submit
navigation cannot invalidate the next field case. Seed nonempty positive draft,
`multimode:false`, `promptMode:"direct"`, default valid size, no missing elements.
These satisfy `storeGenerateEntryImpl.ts:8-26` before the request-count assertion.
Install `page.route("**/api/generate", ...)` before the chord; count POST only,
capture JSON body and fulfill a synthetic 400 JSON error. Assert count with poll,
not a delay; no provider adapter is reached. Keep normal Enter/no-submit assertion
separate from composition, so one guard cannot accidentally satisfy both rows.

## Evidence, commands and baseline outcomes

Observed in WP00: focused node command in `003` exit 0 / 35 passed, UI tsc exit 0,
`npm run typecheck:e2e` exit 0, `npm run test:e2e -- --list` exit 0 / 11 tests in 7
files. UI tsconfig includes `src`; E2E includes `e2e` and `playwright.config.ts`.
These commands observe source/tests, NOT Markdown acceptance prose.

### Standalone WP09 CI/prebuild contract — emitted child, no loader exemption

Exact `.github/workflows/ci.yml` e2e change (before existing Build ui step):

```diff
+      - name: Build server for isolated fixture
+        run: npm run build:server
+      - name: Build CLI imports for isolated fixture
+        run: npm run build:cli
       - name: Build ui
-        run: npm --prefix ui run build
+        run: npm --prefix ui run build:fixture
```

These existing scripts are `tsc -p tsconfig.build.json` and
`tsc -p tsconfig.bin.json && node scripts/fix-shebangs.mjs`. They run only in the
clean disposable source runner, BEFORE runtime fixture launch, never in the guarded
app child. appProjection's independent scratch emit/manifest comparison observes
these exact outputs and rejects stale JS. Failure cannot fall back to `--import
tsx`, raw TS, an unguarded child or a permissive esbuild/Worker allowlist.
WP12/120 already proposes these prebuilds later; main must change that ownership
statement to consume WP09's landed steps and add its later `verify:built-runtime`
checks after them. No WP11 verifier is required before it exists. WP09's own
startup + manifest/I6–I9 and UIR-1–10 checks are standalone, not retroactive WP12
proof. Only this E2E `Build ui` step invokes build:fixture. In pr-fast.yml, retain
its already-present server/CLI builds and change its UI build invocation to
`npm --prefix ui run build:fixture` before its browser tests. Add pr-fast.yml to
this WP's explicit write map for that invocation only. Other CI matrix, package,
release and operator source builds remain ordinary. The fixture producer is NOT
deferred to WP12. Main aligns
`120` to consume `.ima2-ui-build-receipt.json` through this existing validator,
not create a parallel producer or continue claiming package scripts unchanged.

Future focused C commands (not yet executable proof of new files):

```sh
node --test tests/ui-build-receipt.test.mjs
cd ui
npm run typecheck:e2e
npm run test:e2e -- fixture-isolation.spec.ts
npm run test:e2e -- j6-model-select-label.spec.ts j7-nai-negative-geometry.spec.ts j8-composer-transitions.spec.ts
npm run test:e2e -- j2-oauth-reauth.spec.ts j3-provider-error.spec.ts j5-restart-recovery.spec.ts
```

The existing typecheck/list outcomes above are prior WP00 observations, NOT rerun
by this A-repair worker. New-file test commands are
NOT RUN (files do not exist in WP00); runtime commands also await isolation and a
fresh UI build. No full local suite. Parent runs full exact-head CI or approved
macmini-cf jobs after environment confirmation. No installation command is added.

Per case attach `geometry.json` (measured numbers, viewport, locale, surface),
`state.json` (synthetic provider/model/draft markers and request counts, not env or
headers), and before/after PNGs through `testInfo.attach`/`testInfo.outputPath`.
Traces and screenshots on failure stay under existing `ui/test-results/` upload.
WP12 binds successful artifacts to commit/build/runner and inspects images.
Mutate floor/overflow/reseed/allowlist behavior once in a disposable implementation
checkout: specific row must turn red, then restore and rerun green. Do not weaken
expected values to match a new screenshot.

## Compatibility, rollback and SoT sync

Existing fixture defaults preserve caller signatures; typed provider widening is
test-only. New defaults deliberately remove ambient credentials/ports. Any old
test relying on developer auth must get a named synthetic fixture, not an exception.
No app schema or API changes. Existing AppHandle/startApp/seedBrowser/holdNextGeneration
signatures and transport arrays remain; filesystem/expected-probe diagnostics are
additive. A registered home survives close/restart, config edits are not reset,
and final worker teardown deletes only owned scratch state after exit.
Roll back failing journey assertions independently
only after explaining their false oracle; do not roll back isolation to obtain green.
If isolation breaks a necessary trusted transport, emitted import or native addon,
stop runtime tests and amend the design. Do not restore tsx/subprocess exceptions,
copy a live checkout or revert the prebuild alone. Roll back the fixture/runtime
manifest/prebuild change as one unit only with runtime journeys disabled; retain
the disposable-runner restriction and previous evidence. No user history cleanup.
The UI receipt producer/schema/validator/build command form one compatibility
unit: rollback disables receipt-dependent fixture launches until a valid matching
build is available, never treats a missing receipt as success. Ordinary source-zip
builds use digest binding without claiming Git provenance; exact-CI cannot opt out.
Only generated receipt/pending/temp files are invalidated on failure, not output
assets or operator data. Root server/CLI build scripts and all existing fixture
hold/transport/home APIs remain unchanged by R2-S2.

Same PR appends a factual testing paragraph to
`structure/04-frontend-architecture.md`: "J6–J8 exercise real controls, persisted
selection, dual-pane geometry and input recovery using isolated app/stub processes.
Fixture init seeds once per test page/origin; reload tests observe actual persisted
state. Stub success is local path evidence, not provider service certification."
WP12 references these tests rather than re-owning them. Parent updates the master
roadmap; no separate project-level docs convention or new production registry.

## WP00 A round1 amendment evidence boundary

R1-06 and R1-07 are accepted design repairs, not verified runtime fixes. This
worker edits only this file and `003_visual_research.md` with apply_patch. No
source/test/script/workflow file is changed; no app imports, browser, full suite,
credential reads or fixture builds run in this amendment. Main owns staging,
cross-lane `120` ownership update, re-audit and all phase/release decisions.
The long decade doc is intentional under the two-file scope: exact fixture
contracts stay canonical here rather than being appended as contradictory overrides.

Fresh A-repair checks, 2026-09-05 (not baseline or runtime acceptance):

| Command / observed target | Result |
| --- | --- |
| `node --input-type=module` stdin probe, extracts the two JavaScript fences from this doc; replaces original process/worker functions with failing sentinels before installing the proposed guard | exit 0; 17 independent default/named/prototype/Worker denials, original/native calls 0, idempotent restore exercised. Home default/named ESM override and restore passed; parent HOME/CODEX_HOME unchanged. No app import or disk writes. |
| `node --input-type=module` stdin TypeScript compiler-host probe, extracts the automatic worker fixture fence and supplies only a declared disposer signature | exit 0; 0 diagnostics, virtual source/no emit. Proves fixture typing against installed Playwright, not disposer implementation. |
| `git diff --check -- devlog/_plan/260905_production_readiness/090_user_journeys.md devlog/_plan/260905_production_readiness/003_visual_research.md` | exit 0, no whitespace diagnostics; observes these tracked document deltas only. |

Extracted process-installer SHA256:
`31eee0c92c9ca6d9f2e560032ffe1449730c4e728d768c9ca533593c59f171d7`;
home-installer SHA256:
`2e99dde67b1eb20051877c8870f02f6e8d13989076c01f5aa9ed790915287f40`.
These proofs do NOT execute appFilesystemGuard wrappers, appProjection, builds,
poisoned-file I6–I9, worker teardown or the actual app. Those remain required
future WP09 acceptance before any isolation/runtime-completion claim.

## WP00 A round2 amendment receipt

R2-S1: replaced the contradictory I6 oracle in its canonical row; expected
existsSync fallback refusal passes ordinary assertClean, while separate explicit
content-read/copy refusal fails it. R2-S2: WP09 now owns the actual begin/finish
producer, shared schema/validator/declaration, UI package build integration,
complete inventory and standalone tests; main must align `120` to consume them.
No production, script, package, CI, test, git or phase files were changed in this
repair; only `090` and `003` Markdown. No additional authority decision is needed
inside this lane; re-audit and cross-document integration belong to main.

Fresh `node --input-type=module` stdin probe extracted the documented digest and
binding cores: exit 0, **10 binding cases passed** (valid, stale HEAD, changed
source/flags, same-length font and HTML changes, missing/unlisted output, archive
success and exact-CI archive rejection). Independent literal-preimage digest,
input-order invariance and new-input/flag-change checks also passed. Fixed tiny
oracle with a/b repeated 64-digit file hashes, paths `ui/index.html`/`ui/src/a.ts`,
byte lengths 1/2 and flags `["production",false,false,true,true,true]` yields
`fa81e0c5165375779f4113b861eefd46402bf74b8a227c7fa9286408587f4c10`.
This probe performs NO producer filesystem I/O, schema-parser execution, Vite
build, app import or browser run; it is not UIR-1–10 integration success.
`git diff --check -- <090 path> <003 path>` returned 0 with no diagnostics.

Prelude amendment: the separate begin/finish CLI has been replaced in the canonical
build entry and producer body by one parent wrapper. Nonce-bound exclusive cache
state survives Vite cleanup, all partial files stay under ignored node_modules,
and only the verified final receipt lives under ignored dist. No release-clean
exception or project `.ima2`/`.codexclaw` state is introduced. UIR-8/10 now require
concurrent/missing/invalid/changed-input/cleanup and git-cleanliness evidence.
These new wrapper/lock/watcher paths have not been executed in this docs-only turn.
Read-only `git check-ignore -v` confirmed active/input.json and active/receipt.tmp
match existing `.gitignore:4` node_modules, and final receipt matches `:17` ui/dist.
No files were created for that check. Extracted wrapper parsed with installed
TypeScript: 0 syntax diagnostics; installed tsc/Vite CLI paths resolve to regular
files. No subprocess/build was run. This is path/syntax evidence, not a passing
release assert-clean or a runtime concurrency/watch test.

## SEC-R3 ordinary/fixture build separation acceptance

This section resolves008_2, and replaces any earlier suggestion that the ordinary
product build is the fixture wrapper. Its strict source snapshot may require the
emitted server inputs because BOTH browser CI entrypoints emit them first. The
normal product build has no new emitted-file prerequisite or .env rejection.

Add to tests/ui-build-receipt.test.mjs: inspect actual ui/package.json and root
package.json script values; ordinary build must equal the original three commands,
root prepack/ui:build/verify order unchanged, build:fixture maps to the strict wrapper.
Parsed ci/pr-fast fixtures prove server/CLI emit precedes build:fixture and browser
launch. Mutation replacing ordinary build with wrapper or moving strict build before
emit fails. No assertion merely checks a comment saying this is safe.

Implementation C on clean disposable checkout: run ordinary npm run ui:build and
npm pack without preexisting server .js outputs; preserve existing successful
resolution behavior. Separately create a synthetic .env with harmless documented
values and run ordinary build/source auto-rebuild; it must not fail on existence.
Never read real credentials. Strict build:fixture with synthetic .env must reject
before receipt, and missing required emitted inputs must reject. Emit server/CLI,
remove only owned synthetic poison, run strict build and prove appProjection admits
its exact receipt. Run the actual root prepack/release verify order in CI, not a
reordered surrogate. Full suites stay on exact-head CI, not the laptop.

An ordinary build wipes or invalidates previous dist/receipt through existing Vite
emptyOutDir behavior; if any receipt remains it must fail input/output binding and
must never be treated as current without running build:fixture. Installed artifact
QA is independently bound by published tarball provenance/digest on a clean runner;
it is not a relaxed source-fixture receipt path.
