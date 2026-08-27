# 031 — wp3 stale check and CLI contract

Date: 2026-08-27. Prior D direction: server and UI now share a complete sparse NAI
option vocabulary; CLI remains provider/model-only.

## Current command facts

- `bin/commands/gen.ts:371-391` parses args, validates prompt/refs, then fetches
  `/api/models` and resolves a concrete `{lane,model}`. It can support a persisted
  default and post-catalog model-aware checks.
- `bin/commands/multimode.ts:70-123` and `bin/commands/node.ts:56-90` do not fetch a
  model catalog. They must require an explicit NAI provider/model whenever any NAI
  flag is present.
- `bin/lib/args.ts:23-92` returns values and unknown flags; it does not validate.
- `bin/lib/output.ts:55-67` owns JSON/text failure and exit 2.
- `bin/lib/modelResolver.ts:26-28` returns the resolved lane/model for `gen`.
- `canonicalizeImageModel` handles GPT aliases only and otherwise preserves NAI IDs.

## Amended helper API

The 030 sketch exported a throwing payload helper. Use a pure result contract instead
so unit tests do not manipulate process exit state:

```ts
export const NAI_CLI_FLAGS: Record<string, FlagDef>;
export const NAI_CLI_HELP: string;
export type NaiCliPreflight = { hasOptions: boolean; payload: NaiRequestOptions; target: "nai" | "non-nai" | "unknown" };
export type NaiCliResult = { ok: true; value: NaiCliPreflight } | { ok: false; code: string; message: string; flag?: string };
export function parseNaiCliOptions(args: ParsedArgs, policy: "allow-unknown" | "require-explicit"): NaiCliResult;
export function finalizeNaiCliTarget(preflight: NaiCliPreflight, target: { lane: string; model: string }): NaiCliResult;
export function unwrapNaiCliResult(result: NaiCliResult, jsonMode: boolean): NaiCliPreflight;
```

Commands translate a failure result with their existing `fail({json,...})` surface.
`unwrapNaiCliResult` is the single shared translation so `gen.ts` stays at the
400-line limit and all three commands emit the same error shape. Parsing/finalization
remain pure result APIs. No new generic CLI framework or dependency.

## Target rules

- Provider `nai`, an exact model ID derived from `getProvider("nai").models`, or
  namespaced `nai/<exact-id>` is NAI. Prefix matching is forbidden.
- Explicit NAI plus explicit non-NAI is `NAI_TARGET_CONFLICT`.
- Explicit non-NAI with any NAI flag is `NAI_FLAG_TARGET_MISMATCH`.
- `auto` is unknown, not proof of NAI.
- `gen`: unknown is allowed until catalog resolution, then `finalizeNaiCliTarget`
  rejects a non-NAI result before generation POST.
- `multimode` / `node`: unknown with NAI flags is
  `NAI_EXPLICIT_TARGET_REQUIRED` before `resolveServer` or file reads.
- Provider-only and model-only explicit NAI are accepted for compatible fields.

Complete classification before policy:

| Provider | Model | Classification |
|---|---|---|
| absent | absent | unknown |
| `auto` | absent | unknown |
| `nai` | absent | NAI |
| other | absent | non-NAI |
| absent or `auto` | exact bare NAI registry ID | NAI |
| absent or `auto` | namespaced `nai/<model>` | NAI |
| absent or `auto` | other model | non-NAI |
| `nai` | NAI model | NAI |
| `nai` | non-NAI model | `NAI_TARGET_CONFLICT` |
| other provider | NAI model | `NAI_TARGET_CONFLICT` |
| other provider | other model | non-NAI |

When no NAI flag is present, the helper returns `{hasOptions:false,payload:{}}` and
does not alter existing target resolution, including existing provider/model conflicts.
NAI aliases are not invented here: the accepted model-only form is the exact registry ID
or `nai/<exact-id>`, matching current `modelResolver` behavior.

## V5-only rules

- Explicit `--nai-straight-alpha` true and any `--nai-quality-preset` require V5.
- An explicit V4.5 target fails locally rather than silently letting the adapter pin
  them. `--no-nai-straight-alpha` remains valid as an explicit false.
- `gen` can enforce this after catalog resolution for provider/default-only targets.
- `multimode`/`node` require an explicit V5 model when either V5-only value is used;
  provider-only NAI is not sufficient because those commands have no catalog truth.

## Input validation

- samplers: modern six (`ddim_v3` excluded);
- noise schedules, UC presets, quality presets: existing server alphabets;
- steps: integer 1-50; scale: finite 1-10; CFG rescale: finite 0-1; seed: integer
  0..2^32-1; negative prompt: <=10,000 chars;
- positive/negative boolean pairs are mutually exclusive;
- malformed values and explicit target conflicts exit 2 before network I/O.

Exact flag-to-body map:

| CLI flag | Request key | Type/rule |
|---|---|---|
| `--nai-negative-prompt` | `negativePrompt` | string <=10,000 chars |
| `--nai-sampler` | `sampler` | modern six |
| `--nai-noise-schedule` | `noiseSchedule` | server alphabet |
| `--nai-steps` | `steps` | integer |
| `--nai-scale` | `scale` | number |
| `--nai-cfg-rescale` | `cfgRescale` | number |
| `--nai-seed` | `seed` | integer |
| `--nai-uc-preset` | `ucPresetId` | server alphabet |
| `--nai-quality-preset` | `qualityPresetId` | server alphabet, V5-only |
| boolean pairs | `autoSmea`, `decrisper`, `varietyPlus`, `straightAlpha` | explicit true/false only |

The helper payload is typed as `NaiRequestOptions` imported from
`lib/naiOptions.ts`, not an unconstrained generic record.

## Exact insertion order

- `gen`: immediately after help handling, before prompt/ref validation and
  `fetchCatalog`; use `allow-unknown`. After `resolveImageTarget`, call finalize before
  character/MCP/file work and before `/api/generate`.
- `multimode`: immediately after help handling, before prompt validation,
  `resolveServer`, ref-file reads, or request-id creation; use `require-explicit`.
- `node generate`: immediately after help handling, before prompt validation, refs,
  `fileToDataUri`, and `getServer`; use `require-explicit`.

Every new preflight/finalize failure is translated through the command's existing
`fail({json:Boolean(args.json), code, message, extra:{flag}})` surface. With `--json`,
stdout is one `{ok:false,code,message,...}` document and exit 2; without it, stderr has
the human message and exit 2. Existing downstream SSE/provider error formatting is
unchanged and explicitly out of scope.

## RED test plan

New `tests/nai-cli-options-contract.test.ts` first asserts:

- all valid fields map to server camelCase keys;
- every enum/range edge and boolean contradiction fails;
- target state matrix, model-only/provider-only, unknown policies, V5 mismatch;
- `finalizeNaiCliTarget` rejects resolved non-NAI and resolved V4.5 V5-only use;
- all three commands spread `NAI_CLI_FLAGS`, call preflight before network resolution,
  append `NAI_CLI_HELP`, and spread the payload body.

The pre-implementation run must fail because the helper/file/wiring does not exist.

## Built CLI QA

After `npm run build:cli`:

- three `--help` outputs contain the same flag vocabulary;
- invalid enum/conflict commands pointed at an unreachable server exit 2, proving no
  network attempt (server-unreachable would be 3);
- an isolated local recorder serves `/api/models`, `/api/generate`,
  `/api/generate/multimode` SSE, and `/api/node/generate`; built CLI invocations capture
  every mapped value and return successful JSON without a real NovelAI token.
- new preflight failures are spawned in text and `--json` modes: both exit 2, JSON
  emits one parseable error document, and an unreachable `--server` never changes the
  result to server-unreachable exit 3.

## Verification

```text
node --import tsx --test tests/nai-cli-options-contract.test.ts tests/cli-feature-parity-contract.test.js
npm run typecheck
npm run typecheck:tests
npm run build:cli
node bin/ima2.js gen --help
node bin/ima2.js multimode --help
node bin/ima2.js node generate --help
node --import tsx --test tests/nai-cli-built-smoke.test.ts
npm run test:inventory
git diff --check
```
