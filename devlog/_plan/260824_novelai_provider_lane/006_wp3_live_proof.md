# 006 — wp3 live evidence

Full-stack verification of the routing phase against a booted server on
`127.0.0.1:10877` with the user's real Opus token. The token was supplied via
the API, exercised, then removed through the DELETE route; nothing persists.

## Lane served keyless

`GET /api/models` → `lanes.nai`:

```
status: key-missing | NovelAI API token missing
default: nai-diffusion-5-full
models: nai-diffusion-5-full, nai-diffusion-5-curated,
        nai-diffusion-4-5-full, nai-diffusion-4-5-curated
video:  []
lane order: oauth, api, grok, grok-api, agy, gemini-api, atlascloud,
            minimax, nai, comfy, runway, higgsfield
```

`GET /api/keys/status` → `nai`:
`{"configured":false,"source":"none","valid":false,"maskedKey":null}`

That row only appears if all nine sites of the `KeyProvider` chain and the
`server.ts` loader are wired, so it is the activation evidence for wp1.

### Defect found and fixed here

The first probe returned `inputRoles: ["text","image_references"]` for every
NAI model. `entries()` in `routes/models.ts` defaults to that pair, so the
catalog was advertising reference support the routes answer with
`NAI_REF_UNSUPPORTED`. Added `textOnlyCapabilities()`; the lane now reports
`inputRoles: ["text"]`. An API that lies about its own capabilities is worse
than one that lacks them.

## Key lifecycle through the real routes

| Call | Result |
|------|--------|
| `PUT /api/keys/nai` | `{"ok":true,"provider":"nai","source":"config","valid":true}` |
| `GET /api/models` | `nai` lane flips to `ready` |
| `GET /api/keys/status` | `{"configured":true,"source":"config","maskedKey":"pst-..8r"}` |
| `DELETE /api/keys/nai` | `{"ok":true,"removed":true}`, status back to `source:"none"` |

Validation hits `image.novelai.net/user/data` and really discriminates: 200 for
the live token, 401 for a fabricated one. Masking shows four leading and two
trailing characters only.

## End-to-end generation

`POST /api/generate` with `provider:"nai"`, `model:"nai-diffusion-5-full"`,
`straightAlpha:true`:

```
elapsed:  7.2s
provider: nai   model: nai-diffusion-5-full   size: 832x1216
filename: nai-diffusion-5-full_13x19_20260824_chibi-fox-mascot,-tr_0_2.png
returned: png 832x1216 hasAlpha=true
```

### Alpha survives to disk — the whole thesis, measured

| Stage | Transparent pixels |
|-------|--------------------|
| HTTP response payload | 32.5% |
| **file on disk** (`~/.ima2/generated/…png`) | **32.5%** |

And the counterfactual, run directly against `embedImageMetadata`:

| Format argument | Transparent pixels |
|-----------------|--------------------|
| `"png"` (what routing selects for nai) | 42.1% |
| `"jpeg"` (what a JPEG-forcing list would select) | **0.0%** |

The audit round spent on the alpha table bought exactly this. Routing `nai`
into `providerForcesJpeg` would have flattened every transparent generation to
an opaque background, with the entire test suite still green — nothing else in
the repo asserts on transparency.

## Gate sweep at this phase

```
typecheck=0  typecheck:tests=0  generate-provider-types --check=0
test:inventory=0
npm test = 2531 pass / 2 fail
```

Both failures are the recorded pre-existing `cli-models-command-contract`
cases. Zero new failures, which is the c8 bar as amended after audit B5.

## Credential hygiene

Token held only in a `0600` file outside the repo. Post-run scan: 0 matches in
the working tree, 0 in `~/.ima2/config.json`, and `naiApiKey` absent from the
config object.
