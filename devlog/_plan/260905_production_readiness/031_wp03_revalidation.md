# WP03 P — current-tree revalidation

Baseline: `a34205f7d551e179bcd95aeee084c7e2971c181c`, branch
`codex/prod-wp03-execution`, parent WP02 PR #201. FSM P in main session
`01a06e88-aa93-77b2-a99a-fc10f8458eb2`. No WP03 production changes at capture.
Untracked user `scripts/recording/` is excluded throughout.

## Scope and prior gates

WP02 exact-head CI 33949143800 succeeded on Node 22/24 and frontend.
Its selection/geometry work does not resolve server admission. WP08 contrast,
WP08c Comfy display, WP12 shallow-history repair and WP13 release remain open.
WP03 is one boundary extraction plus two specified image admission corrections;
no video admission changes or claim that all Grok requests are fail-closed.

## Evidence and accepted amendments

### Missing direct key and ignored NAI refs reproduced

Owned diagnostic script:
`.codexclaw/evidence/01a06e88-aa93-77b2-a99a-fc10f8458eb2/wp03/baseline-admission.mjs`.
Executed under `env -i PATH="$PATH" node --import tsx ...` with an empty synthetic
config, owned DB/storage, actual Express routers and ephemeral loopback.
All provider fetches and subprocess execution were intercepted, never forwarded.
Native fetch was used only for the owned app request. Server/DB/temp roots closed.

- Missing `grok-api` key reached the proxy `/v1/chat/completions`; deliberately
  failing fixture yielded `GROK_PLANNER_BAD_REQUEST`, not a key refusal.
- Valid 8x8 PNG multimode NAI reference reached the NAI generation endpoint;
  generated request contained no reference field. Fixture returned NAI_BAD_REQUEST.
- Process calls: zero. No external traffic or paid generation. These are RED
  behavioral baselines, not green extraction tests.

### Narrow provider values without casting request input

Virtual TypeScript CompilerHost/noEmit probes showed successful
`resolveProviderOptions` results inferred `provider: string | undefined` with
truthiness error guard, and `string` with `error !== undefined`.
Changing only its final return to `provider: activeProvider as "api" | "oauth"`
plus the explicit error guard yielded zero server diagnostics. This local variable
already comes only from `provider === "api" ? "api" : "oauth"`; the assertion
does not bless raw user input or alter unknown-provider normalization.

Implement that final return annotation and replace the four selected callers'
`if (providerOptions.error)` with `if (providerOptions.error !== undefined)`.
Current model/effort normalizers emit nonempty errors, so behavior is unchanged.
Do not broaden this to all provider consumers or replace their admission rules.

Additional virtual full-contract + generic facade/legacy overload assignment probe:
first run failed only TS6133 for an unused proof variable; exporting that proof
yielded diagnostics=0 and exit0. No output emitted and no source file created.

Node normalization becomes these equivalent closed unions:

```ts
const contextMode = rawContextMode === "parent-only" ? "parent-only"
  : rawContextMode === "ancestry" ? "ancestry" : "parent-plus-refs";
const searchMode = rawSearchMode === "off" || rawSearchMode === "auto"
  ? rawSearchMode : "on";
```

Keep the ancestry refusal at its original point. The later request then has only
the two legal context modes and uses the existing effectiveImageModel.

### Independent parity review accepted

Goodall, agent `01a07049-c551-7012-8f96-ba7079d02a96`, read-only at this baseline:

- Four native single results permit null providerUrl (Atlas/MiniMax/NAI/Comfy).
  Old contract failed four TS2322 native assignments. Revised single-only Omit
  contract passed 12 result assignments, two callback assignments, and sequence
  image-to-caller assignment. Preserve narrower sequence/progress image type.
- Node captures Grok key once before the attempt loop. Preserve nonblank replacement
  semantics while adding current-presence checks at prepare and each execute.
- Retain all-ref parent-only behavior for Atlas/MiniMax/Gemini and Agy exception.
- Keep classic cancellation inside its Responses retry loop; no new normalization.
- Forward native metadata and original awaited final-callback images.

All are folded into 030. Closed reviewer after result; no source edits by reviewer.

### New error must reach a truthful UI card

Current `error-class-coverage` scans all server code. New code needs explicit
`providerMap.ts` AUTH_INVALID mapping, generationErrors passthrough/401 and a UI
spec. AUTH_INVALID overrides ordinary registered UI specs, so this code must also
join SELF_DESCRIBING_AUTH_CODES. Existing `reauth` CTA actually calls
`openSettings("providers")`; retain the action but supply key-setting copy.
Add English/Korean/Simplified Chinese/Traditional Chinese strings and visual
fixtures. Avoid a general promise about Grok video or external account auth.
Exact file ownership and visual scope are in 032.

### Test mechanism verified before adoption

Native Node module-mock diagnostic lives at `.../wp03/mock-probe/`.
Command: `node --experimental-test-module-mocks --import tsx .../probe.mjs`.
Mocking `wire.ts` intercepted entry.ts's `./wire.js` import, both with and without
a physical emitted JS twin. The real transport was defined to throw; expected
fixture return was observed. Node 24.17 only; Node 22 compatibility remains a CI
obligation. Production receives no injection flag or mock hooks.

Boundary tests may launch a test-only sanitized child with this native flag;
mock only concrete transports and retain the actual prepare/legacy implementation.
This proves dispatch/argument/callback/result parity, not upstream operation.
Separate real-route fixture tests prove actual transport payload/envelope/storage.

### Focused baseline refreshed

Owned empty config/DB/generated paths, dotenv disabled, no inherited credentials:

```sh
node --import tsx --test --test-concurrency=1 \
  tests/provider-adapter-v1-contract.test.ts \
  tests/responses-adapter-safety.test.ts \
  tests/grok-planner-adapter.test.ts \
  tests/grok-upstream-retry.test.ts \
  tests/gemini-api-wire-contract.test.ts \
  tests/agy-artifact-fallback.test.ts tests/agy-cli.test.ts
```

Observed 51 pass / 0 fail / 0 skip. `typecheck`, `typecheck:tests`,
`test:inventory` each exit 0. Full local suite not run. Generated JS must be built
before new runtime verification; no emitted twins are committed.

## Resource and authority bounds

Existing repo/owned stack branches and hosted CI only; credentials remain unused
except GitHub publication tooling already authorized. Zero paid model calls.
Main owns FSM/goal and shared docs; disjoint workers only after A. Dispatch explicit
gpt-6-astra/high per user steering; service priority is configured by the user,
not independently set or proven by this spawn API. Four-hour WP reassessment and
72-hour goal bounds remain unchanged. Preserve unrelated work, stores and refs.
