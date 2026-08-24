# 001 — NovelAI image API surface (research)

Research only. No diffs here (LEXICO-SPLIT-01).
Gathered 2026-08-24 via web research subagent (grok-4.6) plus direct source
verification of working client code by the main agent.

## Source ranking and provenance

| Rank | Source | What it settles | Verified how |
|------|--------|-----------------|--------------|
| 1 | `zhulinyv/Auto-NovelAI-Refactor` `utils/models/nai_diffusion_5_full.py`, `nai_diffusion_5_curated.py`, `utils/variable.py`, `src/generate_images.py` | V5 request body, V5 model ids, V5-only fields, endpoint | `curl` of raw.githubusercontent, read directly |
| 2 | `caru-ini/novelai-sdk` `src/novelai/constants/models.py`, `utils/anlas.py` | Independent confirmation of both V5 ids + inpaint variants | `curl`, read directly |
| 3 | NovelAI Journal 2026-08-21 (V5 announcement) | Feature set: alpha, positioning, languages, Max enhance | subagent report |
| 4 | `api.novelai.net/docs/swagger-ui-init.js` | Host/auth/error contract | `curl` HTTP 200, 137817 bytes |
| 5 | `Aedial/novelai-api` | V3/V4/V4.5 parameters, ZIP parsing behavior | subagent report |

**Swagger is stale.** Direct grep of the fetched swagger payload returns only
`nai-diffusion-2`, `nai-diffusion-3`, `nai-diffusion-3-inpainting`,
`nai-diffusion-furry`, `nai-diffusion-inpainting`. It has no V4 or V5 entry.
Use it for host/auth/errors, never for the model enum.

`https://image.novelai.net/docs/swagger-ui-init.js` returns **HTTP 404** — the
image host publishes no OpenAPI document. (An interactive browser session
initially claimed both doc URLs were reachable and then that both 404'd; the
`curl` status codes above are the authority.)

## Endpoint

| Role | Host | Path |
|------|------|------|
| Image generation | `https://image.novelai.net` | `POST /ai/generate-image` |
| Account / login / persistent token / subscription | `https://api.novelai.net` | `/user/*` |

CONFIRMED by `src/generate_images.py`:
`Generator("https://image.novelai.net/ai/generate-image")`.

Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.

## Authentication

Bearer token, two acceptable kinds:

1. **Persistent API token** — created at `POST /user/create-persistent-token`,
   what a user pastes into a tool. No documented prefix.
2. **Session JWT** — from `POST /user/login` with a derived 64-char access key.

Both go in the same `Authorization: Bearer` header. **Implication for ima2-gen:
no key-prefix validation is possible.** `keyPrefix` must be omitted for this
lane, exactly as MiniMax omits it, or valid tokens get rejected.

## Response format

Success is a **ZIP archive containing PNG file(s)**, not JSON.

- Content-Type observed by clients: `application/x-zip-compressed` or
  `binary/octet-stream`.
- `n_samples=1` yields one PNG entry.
- Entry filename is server-chosen. Clients read the archive's own name list
  rather than hardcoding `image_0.png`; ima2-gen will do the same and simply
  take the first entry.
- Accept both **200 and 201** as success. Swagger documents 201; the reference
  client treats 200 as success.

## Model identifiers (the decisive finding)

Both V5 strings are confirmed by two independent clients:

| Product | API id | Confirmation |
|---------|--------|--------------|
| V5 Full | `nai-diffusion-5-full` | `nai_diffusion_5_full.py` literal + novelai-sdk `V5_FULL` |
| V5 Curated | `nai-diffusion-5-curated` | `nai_diffusion_5_curated.py` literal + novelai-sdk `V5_CURATED` |
| V4.5 Full | `nai-diffusion-4-5-full` | both |
| V4.5 Curated | `nai-diffusion-4-5-curated` | both |
| V4 Full | `nai-diffusion-4-full` | both |
| V4 Curated | `nai-diffusion-4-curated-preview` | Auto-NovelAI `MODELS` list |
| V3 | `nai-diffusion-3` | swagger + both |

Inpaint variants exist (`nai-diffusion-5-full-inpainting`) but are out of scope
for this unit.

ima2-gen ships the four modern ids: V5 Full, V5 Curated, V4.5 Full, V4.5
Curated. V4/V3 are omitted deliberately — they are superseded and would widen
the UI model list without user value.

## Request body

```
{ "input": <prompt>, "model": <id>, "action": "generate", "parameters": {...} }
```

`input` max length 40000 characters (swagger).

### V5 parameters, from the V5 client source

V5 changed several field names versus V4.x. These are the V5 shapes:

| Field | Type | Note |
|-------|------|------|
| `params_version` | int | 3 |
| `width`, `height` | int | multiples of 64 |
| `scale` | number | prompt guidance |
| `sampler` | string | see enum below |
| `steps` | int | Opus free tier requires <= 28 |
| `n_samples` | int | 1 for free-tier eligibility |
| `ucPresetId` | string | **V5 replaces V4's numeric `ucPreset`**: `heavy`, `light`, `furryFocus`, `humanFocus`, `none` |
| `qualityPresetId` | string | **V5-only**: `standard`, `light`, `none` |
| `autoSmea` | bool | V5 uses auto SMEA; no `sm`/`sm_dyn` |
| `straight_alpha` | bool | **V5-only, the native alpha switch** |
| `dynamic_thresholding` | bool | decrisper |
| `controlnet_strength` | number | 1 |
| `legacy`, `legacy_v3_extend`, `legacy_uc` | bool | false |
| `add_original_image` | bool | true |
| `cfg_rescale` | number | 0 |
| `noise_schedule` | string | `native` \| `karras` \| `exponential` \| `polyexponential` |
| `use_coords` | bool | false |
| `normalize_reference_strength_multiple` | bool | true |
| `inpaintImg2ImgStrength` | number | 1 |
| `seed` | int | 9-10 digits; 0 lets the backend choose |
| `negative_prompt` | string | undesired content |
| `v4_prompt` / `v4_negative_prompt` | object | caption structure, still `v4_`-named in V5 |
| `characterPrompts` | array | `{prompt, uc, center:{x,y}, enabled}` |
| `skip_cfg_above_sigma` | null for V5 | commented out in the V5 client |
| `deliberate_euler_ancestral_bug`, `prefer_brownian` | bool | **only sent when sampler is `k_euler_ancestral`** |

`v4_prompt` shape (unchanged name in V5):

```
"v4_prompt": {
  "caption": { "base_caption": <prompt>, "char_captions": [ {"char_caption": str, "centers": [{"x": f, "y": f}]} ] },
  "use_coords": bool, "use_order": bool
}
```

### Sampler enum (V5 client list)

`k_euler`, `k_euler_ancestral`, `k_dpmpp_2s_ancestral`, `k_dpmpp_2m`,
`k_dpmpp_sde`, `k_dpmpp_2m_sde`, `ddim_v3`.

### Resolutions offered by the reference client

`832x1216`, `1216x832`, `1024x1024`, `1024x1536`, `1536x1024`, `1472x1472`,
`1088x1920`, `1920x1088`, `512x768`, `768x768`, `640x640`.

## V5 alpha transparency

Two cooperating mechanisms:

1. **Parameter** `straight_alpha: true` — the V5 client sets this literally.
2. **Prompt tags** — `transparent background`, `has alpha`,
   `alpha transparency`, optionally weighted (`2.1::transparent background::`).

ima2-gen exposes `straight_alpha` as a provider option; prompt tags remain the
user's to type.

## Errors

| HTTP | Meaning |
|------|---------|
| 400 | validation error |
| 401 | token incorrect |
| 402 | active subscription required |
| 409 | conflict |
| 429 | rate limited (NOT in swagger; handled defensively) |
| 500 | unknown upstream error |

Body shape: `{ "statusCode": number, "message": string }`. Clients also see
bare `{ "error": ... }` / `{ "message": ... }`.

Note: a ZIP-returning endpoint means an error body is JSON while success is
binary — the adapter must branch on content, not assume one shape.

## Anlas / Opus economics (informational)

Opus free generation requires all of: `n_samples=1`, no source image, at least
"Normal" size, `steps <= 28`, and up to 1024x1024. Official footnote: *"Usage
limits will apply when using models higher than V4.5"* — so V5 free generations
are metered by the Opus usage limit. Exact V5 quota is not published in
extractable form; ima2-gen does not attempt cost estimation.

## Open/unconfirmed items

- Exact V5 prompt-token ceiling ("more space" announced, no number).
- `Max` enhance API surface.
- Free-float coordinate bounds for V5 character positioning (assumed 0..1).
- Whether `stream: "msgpack"` (present in the V5 client body) is required.
  ima2-gen omits it and relies on the ZIP response, matching the documented
  attachment behavior.
