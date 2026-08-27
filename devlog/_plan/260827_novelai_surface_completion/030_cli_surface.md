# 030 — NovelAI CLI discovery, flags, defaults, and generated artifacts

Depends on: 010. Work phase: wp3.

## Scope

Give `gen`, `multimode`, and `node generate` one shared NAI option vocabulary. The
CLI validates values before network I/O and sends camelCase keys already consumed by
`readNaiOptions`. The default-target case remains usable when neither provider nor
model is explicit.

## File changes

### NEW `bin/lib/nai-options.ts`

Exports only:

```ts
export const NAI_CLI_FLAGS;
export const NAI_CLI_HELP: string;
export function hasNaiCliOptions(args: ParsedArgs): boolean;
export function naiCliPayload(args: ParsedArgs, target?: { provider?: string; model?: string }): Record<string, unknown>;
```

The parser validates the existing server alphabets and numeric ranges before any
server/catalog resolution. Positive and negative boolean flags are mutually exclusive:

- `--nai-auto-smea` / `--no-nai-auto-smea`
- `--nai-decrisper` / `--no-nai-decrisper`
- `--nai-variety-plus` / `--no-nai-variety-plus`
- `--nai-straight-alpha` / `--no-nai-straight-alpha`

Value flags:

- `--nai-negative-prompt`
- `--nai-sampler`
- `--nai-noise-schedule`
- `--nai-steps`
- `--nai-scale`
- `--nai-cfg-rescale`
- `--nai-seed`
- `--nai-uc-preset`
- `--nai-quality-preset`

Target classification is deterministic and pure:

```text
explicit provider=nai OR model starts nai-diffusion-* -> NAI
explicit non-nai provider/model -> NON_NAI
provider/model disagree -> CONFLICT
neither explicit -> UNKNOWN
```

- `NON_NAI` / `CONFLICT` exits 2 before any network call.
- `gen` permits `UNKNOWN` because it already resolves the persisted CLI target from
  `/api/models`; after that one catalog GET, a non-NAI resolved default exits 2 before
  the generation POST.
- `multimode` and `node generate` have no catalog target resolver. With any NAI flag,
  `UNKNOWN` exits 2 and tells the user to pass `--provider nai` or
  `--model nai-diffusion-*`. This check runs before `resolveServer`.
- Enum/range/dual-boolean errors always exit 2 before network I/O on all three commands.

### MODIFY `bin/commands/gen.ts`

```diff
 const SPEC = { flags: {
+  ...NAI_CLI_FLAGS,
 }};
+const naiPreflight = classifyAndParseNaiCliOptions(args);
+// explicit conflicts and malformed values fail here, before fetchCatalog()
 ...
 const body = { ...,
+  ...naiCliPayloadForResolvedTarget(naiPreflight, target),
 };
```

Append `NAI_CLI_HELP` and one V5 alpha/negative-prompt example.

### MODIFY `bin/commands/multimode.ts` and `bin/commands/node.ts`

Spread the same flag spec and call the preflight helper before `resolveServer`.
Require deterministic explicit NAI classification whenever a NAI flag is present;
model-only and provider-only NAI targets are accepted, conflicting or unknown targets
are rejected. Do not duplicate enum/range logic.

### MODIFY tests

- NEW `tests/nai-cli-options-contract.test.ts`: help presence, valid payload mapping,
  numeric/enum failures, contradictory booleans, explicit non-NAI rejection,
  provider/model conflicts, `gen` default-target post-catalog classification,
  `multimode`/`node` unknown-target rejection, model-only/provider-only NAI acceptance,
  no generation POST on failure, and parity across all three commands.
- `tests/cli-feature-parity-contract.test.js`: document the new flags.
- Inventory is refreshed only if the repository classifier requires it.

### Generated artifacts

Run `npm run build:cli`; never hand-edit `bin/**/*.js`. Verify the built
`node bin/ima2.js ... --help` and a local recorder invocation.

## Verification

```text
node --import tsx --test tests/nai-cli-options-contract.test.ts tests/cli-feature-parity-contract.test.js
npm run build:cli
node bin/ima2.js gen --help
node bin/ima2.js multimode --help
node bin/ima2.js node generate --help
```
