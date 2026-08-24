# WP4 evidence — NovelAI lane UI / doctor / i18n

Recorded 2026-08-25 on `dev`, after the WP4 audit round (reviewer verdict FAIL → blockers folded in).

## The "Invalid provider" screenshot was a stale process, not a source bug

The user saw `Not configured` + `Invalid provider` on the NovelAI key row. Root cause: the
running server was started **before** `nai` landed in `routes/keys.js`.

| Fact | Value |
| --- | --- |
| Process seen in the screenshot | PID 29044, started `Mon Aug 24 19:44` |
| `routes/keys.js` rebuild time | `Aug 25 00:43` |
| Effect | `isKeyProvider("nai")` false → `routes/keys.ts:218` `INVALID_PROVIDER`, and `/api/keys/status` omitted `nai` so the row fell through to `configured ?? false` |

After rebuild + restart, against the live server on `127.0.0.1:3333`:

```
GET /api/keys/status
… "nai":{"configured":false,"source":"none","valid":false,"maskedKey":null} …

PUT /api/keys/nai  {"apiKey":"pst-…"}
{"ok":true,"provider":"nai","source":"config","valid":true}

GET /api/keys/status   (after save + server restart)
nai: {"configured":true,"source":"config","valid":true,"maskedKey":"pst-..8r"}
```

The token validates against the real NovelAI account endpoint, so this is a live credential
round-trip, not a local format check.

## Live v5 generation

```
POST /api/generate {"provider":"nai","model":"nai-diffusion-5-full","count":1}
→ image/png, 832x1216, PNG tEXt Source = "NovelAI Diffusion V5 0ADF9AB7"
```

Saved as `wp4-nai-v5-live-generation.png`. The prompt asked for a visible open palm; the
render returns five correctly separated fingers, which is the hand-quality question that
motivated the check.

## AC3 — render grounding (C-RENDER-GROUNDING-01)

Captured from the **built** frontend served by `node server.js` on port 3333, not from source.

- `wp4-ac3-provider-dropdown.png` — the open provider selector listing `NovelAI` alongside
  GPT / GPT API / Grok / MiniMax.
- `wp4-ac3-nai-selected.png` — after selecting it: provider chip reads `NovelAI`, the model
  chip auto-coerces to `nai v5`, the readiness panel reads `NovelAI API / STATUS: READY /
  API ACTIVE`, and the reference-attach button is disabled because the lane refuses
  reference images.

Both were read back and described rather than merely written to disk.

## Audit blockers folded in

| Blocker | Disposition |
| --- | --- |
| High — only `NAI_REF_UNSUPPORTED` / `NAI_EDIT_UNSUPPORTED` were registered, so auth, subscription, rate-limit, zip, mask and upstream failures collapsed into generic cards | All 13 `NAI_*` codes registered in `ui/src/lib/errorCodes.ts` with 040's copy, in all four locales |
| High — auth/billing class cards overrode NovelAI copy and told the user to "sign in again", wrong for a pasted token | `SELF_DESCRIBING_AUTH_CODES` keeps NovelAI copy while every other code still defers to the class card |
| High — AC3 screenshot missing | Captured, resized to the 1280 wide the plan asks for, and stored here |
| Medium — readiness popup labelled NovelAI as "GPT API" | Replaced the ternary chain with an exhaustive `PROVIDER_READINESS_LABELS` map |
| Medium — doctor printed MiniMax-specific copy for nai | Message is now vocabulary-neutral |
| Medium — contract test could stay green while adapter codes drifted | `tests/nai-ui-registration-contract.test.ts` now enumerates every `NAI_*` throw site and asserts registry coverage plus class-override behaviour |

## Gates

```
npm run typecheck          clean
npm run typecheck:tests    clean
npm test                   2544 pass / 0 fail / 2 skipped
npm run test:provider-registry  10 pass / 0 fail
cd ui && npm run build     built in 1.30s
```

## Known non-blocker

`routes/keys.ts:225` caps keys at 512 chars. Persistent `pst-` tokens are ~68 chars and fine;
a NovelAI *session JWT* can exceed the cap. The UI placeholder steers to persistent tokens,
so this is documented rather than changed here.

## Round-2 audit residuals (all closed)

Reviewer verdict on `fc3057b6`: **GO-WITH-FIXES (blockers=0)**. Three residuals, all fixed here:

| Residual | Fix |
| --- | --- |
| Medium — live `ima2 doctor` still printed the MiniMax sentence because `bin/lib/doctor-providers.js` is gitignored and was stale | Ran `npm run build:cli`; `ima2 doctor` now prints `✓ nai: api-key present (no prefix check; this lane has no fixed key prefix)`. Same stale-artifact class as the original screenshot. |
| Medium — the new copy was not in the i18n oracle, so deleting it stayed green | Added the seven `errorCard.nai*` roots and five `toast.nai*` keys to `tests/i18n-dictionary-contract.test.ts`, and added a case to the nai contract test that follows each spec to the leaves it actually reads, in all four locales. |
| Low — AC3 never photographed the four model labels | `wp4-ac3-model-list.png`: with NovelAI selected, the model list shows `nai v5`, `nai v5 cur`, `nai v4.5`, `nai v4.5 cur`. |
| Low — `cta: "dismiss"` made the "Open settings" string dead, since Toast only draws a CTA for reauth/reload | `NAI_API_KEY_MISSING` and `NAI_AUTH_FAILED` now use `cta: "reauth"`, which opens Settings → providers, exactly where the token is pasted. Node retry action follows to `auth`. |

Final gates: typecheck clean, typecheck:tests clean, `npm test` 2545 pass / 0 fail / 2 skipped, provider registry 10 pass.

## WP5 — full verification, SoT sync, push

Audit round on the WP5 plan (same discipline, fresh reviewer): **GO-WITH-FIXES (blockers=0)**.
It expanded my SoT scope from 6 sites to 24 and corrected two assumptions I had made.

### What the audit changed about the plan

I had recorded `structure/01-file-function-map.md` as already current. It was not: the file map
had no row for `lib/naiImageAdapter.ts`, `lib/naiZip.ts`, `lib/providers/adapters/nai.ts`, or the
three `lib/providers/` modules that every derived catalog reads. Six rows added, then
`docs:refresh-line-counts` pinned the counts.

The audit also caught that `docs/API.md`, `docs/CLI.md` and `README.md` enumerate lanes in prose
that no route test guards, and that `_plan` → `_fin` must wait until after push proof rather than
happen at the start of the phase.

### SoT sites patched

| File | What was stale |
| --- | --- |
| `structure/00-structure-hub.md` | "ninth core provider lane" with no tenth; lib blurb and mermaid had no NovelAI |
| `structure/01-file-function-map.md` | six missing module rows |
| `structure/02-command-reference.md` | `--provider` enums stopped at `gemini-api`; override semantics had no nai |
| `structure/03-server-api.md` | keys row said "openai / xai / gemini"; no NAI error rows, no `.lanes.nai` contract, no provider-lane Sync Checklist row |
| `structure/04-frontend-architecture.md` | no provider-selection row; error-UX row predated the NAI codes |
| `structure/06-infra-operations.md` | env table had no `NOVELAI_API_KEY` or `IMA2_NAI_*`; provider paragraph said "OAuth, API-key, and Grok" |
| `structure/07-devlog-map.md` | unit still read "wp3-wp5 remain" |
| `docs/API.md` | keys status and "six core lanes" (registry has ten) |
| `docs/CLI.md` | `gen` enum and legacy surface omitted nai |
| `README.md` | provider list and env table |

### A correction the tests caught

My first pass added `comfy` to the legacy `edit`/`multimode`/`node` provider list.
`tests/comfy-cli-contract.test.ts:73` rejects exactly that, because those routes answer
`COMFY_SURFACE_UNSUPPORTED`, and documenting a refused capability is worse than omitting it.
I checked whether `nai` has the same problem and it does not — both routes really serve it:

```
POST /api/generate/multimode {"provider":"nai"} → event: image, data:image/png...
POST /api/node/generate      {"provider":"nai"} → {"nodeId":"n_f0ecebcfd9","image":"data:image/png..."}
```

So `nai` is documented on the legacy surface and `comfy` is not, and the two pinned regexes were
widened for nai only.

### Live proof on this head

```
GET /api/models        .lanes.nai = {status:"ready", defaults.image:"nai-diffusion-5-full",
                       4 image models, every entry inputRoles:["text"] only}
GET /api/capabilities  imageModels.naiSupported = the four ids
GET /api/keys/status   nai = {configured:true, source:"config", valid:true, maskedKey:"pst-..8r"}
ima2 models --lane nai --json   4 models, status ready, executable true
ima2 gen "..." --provider nai --model nai-diffusion-5-full   exit 0, 2.4s
```

The CLI-generated PNG carries a NovelAI tEXt comment (`steps:23, scale:5.0, noise_schedule:karras`),
so the command-line path is genuinely reaching NovelAI rather than a cached local result.

`wp5-render-grounding.png` is a fresh capture on this head, not a reused WP4 shot: NovelAI selected,
the model list open showing all four labels, readiness reading `NovelAI API / READY / API ACTIVE`.

### Gates

```
npm run typecheck                      clean
npm run typecheck:tests                clean
npm run test:inventory                 clean
generate-provider-types.mjs --check    clean
npm run test:provider-registry         10 pass
npm test                               2545 pass / 0 fail / 2 skipped
cd ui && npm run build                 built in 1.34s
chained exit code                      0
```

