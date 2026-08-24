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

