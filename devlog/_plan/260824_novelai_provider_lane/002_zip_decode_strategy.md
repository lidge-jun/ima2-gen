# 002 — ZIP→PNG decode strategy (research)

Research only. No diffs (LEXICO-SPLIT-01).

## Problem

NAI returns a ZIP archive, but every other ima2-gen image lane returns JSON
with base64 or a URL. The shared pipeline consumes a base64 PNG string. So the
NAI adapter must turn `application/x-zip-compressed` bytes into the same
`{ b64, mime }` the pipeline already understands, and it must do so without
becoming the first lane to need a new runtime dependency.

## Dependency audit (verified against package.json)

Server `dependencies`: `@modelcontextprotocol/sdk`, `@openai/codex`,
`better-sqlite3`, `dotenv`, `express`, `google-auth-library`, `openai`,
`openai-oauth`, `progrok`, `sharp`, `trash`, `ulid`, `zod`.

**None can unzip an archive.** `sharp` decodes image formats, not containers.

Absent from both `dependencies` and `devDependencies`: `fflate`, `unzipper`,
`jszip`, `adm-zip`, `yauzl`. `jszip` appears only as a transitive entry in
`ui/package-lock.json` — a frontend artifact, not importable from `lib/`.

## Decision: parse the local file header, inflate with node:zlib

`node:zlib` alone cannot read a ZIP: zlib implements DEFLATE streams, while ZIP
is a container (local file headers, file data, central directory, EOCD). But
for a **single-entry archive from a known server**, the needed parsing is one
fixed-layout 30-byte header.

Precedent in-repo: `lib/comfyPngWorkflow.ts` already hand-parses PNG chunks and
calls `zlib.inflateSync` for `zTXt`/`iTXt`. Byte-level container parsing is an
established pattern here, not a novelty.

### Local file header layout (little-endian)

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 | signature `0x04034b50` (`PK\x03\x04`) |
| 4 | 2 | version needed |
| 6 | 2 | general purpose bit flag |
| 8 | 2 | compression method (0 = stored, 8 = deflate) |
| 10 | 4 | mod time + date |
| 14 | 4 | CRC-32 |
| 18 | 4 | compressed size |
| 22 | 4 | uncompressed size |
| 26 | 2 | filename length `n` |
| 28 | 2 | extra field length `m` |
| 30 | n | filename |
| 30+n | m | extra |
| 30+n+m | | compressed data |

### Cases that must be rejected, not guessed

| Condition | Why | Action |
|-----------|-----|--------|
| Bad/missing signature | not a ZIP (often a JSON error body) | `NAI_ZIP_INVALID` |
| Flag bit 0 set | encrypted | `NAI_ZIP_UNSUPPORTED` |
| Flag bit 3 set | sizes live in a trailing data descriptor, not the header | `NAI_ZIP_UNSUPPORTED` |
| Size `0xffffffff` | ZIP64 | `NAI_ZIP_UNSUPPORTED` |
| Method not 0 or 8 | unsupported codec | `NAI_ZIP_UNSUPPORTED` |
| Declared size past buffer end | truncated/hostile | `NAI_ZIP_INVALID` |
| Uncompressed size > 50MB | resource guard, matches MiniMax cap | `NAI_ZIP_TOO_LARGE` |

Explicit rejection beats silent best-effort: a wrong guess here produces a
corrupt "image" saved as `.png`, which is far harder to diagnose than an error.

### Critical detail

Use `inflateRawSync`, **not** `inflateSync`. ZIP stores raw DEFLATE with no
2-byte zlib header; `inflateSync` fails on it.

## Validation after extraction

Extracted bytes are checked for the PNG magic `89 50 4E 47` before being
returned, reusing `detectImageMimeFromB64` from `lib/refs.ts` the way
`minimaxImageAdapter` does. Magic bytes are authoritative over any header,
because downstream storage defaults unknown MIME to `.png` and would otherwise
persist an error body as a broken image.

## Activation concern (C-ACTIVATION-GROUNDING-01)

Neither the ZIP path nor the error-mapping path runs on the default happy path,
because both require an upstream response and the repo has no NAI token. They
are therefore dead-by-default code unless tests drive them explicitly.

Planned activation scenarios, each with an observable effect:

| Path | Trigger | Observable proof |
|------|---------|------------------|
| Stored (method 0) entry | synthetic ZIP built in-test with a stored PNG | returned buffer equals the PNG bytes |
| Deflated (method 8) entry | synthetic ZIP built with `deflateRawSync` | returned buffer equals the original PNG bytes |
| Bad signature | `Buffer.from("{\"statusCode\":401}")` | throws `NAI_ZIP_INVALID` |
| Encrypted / data-descriptor / ZIP64 | crafted header flags | throws `NAI_ZIP_UNSUPPORTED` |
| Oversize | header declaring > 50MB uncompressed | throws `NAI_ZIP_TOO_LARGE` |
| 401/402/429/500 upstream | stubbed `fetch` | throws the matching `NAI_*` code |

Building the fixture with `zlib.deflateRawSync` inside the test means the test
proves the real decoder against a real archive, with no committed binary.

## Adapter contract to satisfy (verified)

From `lib/providers/adapters/types.ts`:

```
interface ProviderAdapterV1 {
  readonly laneId: CoreProviderId;
  validateAuth(): AuthResult;
  listModels(): readonly CoreProviderModel[];
  normalizeError(error: unknown): ProviderError;
  generateImage?(input): Promise<JobHandle>;  // optional
  editImage?(input): Promise<JobHandle>;      // optional
}
```

MiniMax implements only the three required members and leaves generation in the
sibling `lib/minimaxImageAdapter.ts`. NAI follows that split exactly:
`lib/providers/adapters/nai.ts` is the thin lane descriptor,
`lib/naiImageAdapter.ts` does the HTTP work.

`listModels()` must return `getProvider("nai").models` — reading the registry,
never a hand-written list, or the lane drifts from the generated UI catalog.

## Error-code convention (verified)

Adapters throw `Error & { status, code, isOperational: true }` where `code` is
`PREFIX + SUFFIX`. `lib/generationErrors.ts` `errorCodeFrom()` passes a string
`err.code` through unchanged, and `lib/errors/providerMap.ts`
`providerErrorClass()` maps it to a UI error class. Every new `NAI_*` code must
be added to `PROVIDER_ERROR_MAP`, or it degrades to an unclassified failure.

## Build/commit convention (verified)

`lib/**/*.js` is gitignored and regenerated by `npm run build:server`
(`tsc -p tsconfig.build.json`, `outDir: "."`). Commit `.ts` only. TypeScript
imports still use the `.js` specifier (`from "./naiImageAdapter.js"`) under
NodeNext resolution.
