# 004 — Live API probe (first-party evidence)

Date: 2026-08-25. The user supplied a real NovelAI persistent token, which
closed the one question the roadmap could not settle by research and corrected
two things the plan had wrong. The token was written to a 0600 file outside the
repo, never echoed, and never committed.

## Account: Opus, active

`tier: 3` (Opus), `active: true`, `unlimitedMaxPriority: true`,
`fixedTrainingStepsLeft: 10000`. Free-tier image rules therefore apply at
<= 1024x1024, <= 28 steps, `n_samples: 1` — exactly the request the adapter
builds, so probing cost no Anlas.

## CORRECTION 1 — account endpoints moved to the image host

The roadmap had key validation pointed at `api.novelai.net/user/data`, taken
from the published OpenAPI. Live, that host answers **every** `/user/*` call:

```
HTTP 400 {"statusCode":400,"message":"Please refresh NovelAI.net. If using a
third-party tool, update to the image URL."}
```

`image.novelai.net/user/data` returns 200 with the subscription payload.
Behavior on the corrected host:

| Token | Status |
|-------|--------|
| valid | 200 |
| invalid | 401 |
| absent | 401 |

Clean discrimination, so it is a correct validator. **Had this shipped
unverified, every valid token would have been rejected at save time** — the
lane would have looked completely broken while being otherwise correct.

Fixed in `lib/providers/registry.ts`, `routes/keys.ts`, and `config.ts`
(`accountBaseUrl`).

## CORRECTION 2 — NovelAI streams its ZIP (data-descriptor)

`002` reasoned that flag bit 3 "is usually not set" for a single-PNG archive
and had the parser reject it. The live response sets it on every request:

| Field | Local header | Central directory |
|-------|--------------|-------------------|
| flags | `0x8` (data descriptor) | — |
| method | 8 (deflate) | 8 |
| CRC-32 | 0 | — |
| compressed size | **0** | 734414 |
| uncompressed size | **0** | 735841 |
| name | `image_0.png` | `image_0.png` |

That is ordinary streaming behavior: sizes are unknown when the header is
written, so they are emitted afterwards and recorded authoritatively in the
central directory. `lib/naiZip.ts` now scans back for the EOCD, reads the
first central-directory entry, and uses those sizes when bit 3 is set. The
50MB cap and every other rejection still apply, now against trustworthy values.

Regression tests build the real streaming shape rather than the idealized one
(`tests/nai-zip-decode.test.ts`), including a trailer-less archive and an
oversize central-directory declaration.

## CLOSED — the msgpack question

`020` §Open risk asked whether the host requires `stream: "msgpack"`, since
the reference client sends it. **It does not.** Omitting it returns a plain ZIP:

```
HTTP 200, content-type: binary/octet-stream, 734550 bytes, first four bytes 504b0304
```

`NAI_RESPONSE_NOT_ZIP` stays as a guard, but it is no longer covering an
unknown.

## End-to-end results through `generateViaNai`

| Model | Result |
|-------|--------|
| `nai-diffusion-5-full` | 832x1216 RGBA PNG, 1745874 bytes |
| `nai-diffusion-5-curated` | 832x1216 RGBA PNG, 1519005 bytes |
| `nai-diffusion-5-full` + `straight_alpha` | 832x1216 RGBA PNG, 340970 bytes |

### Alpha is real

Measured with sharp over the decoded pixels:

| Request | Transparent pixels |
|---------|--------------------|
| `straight_alpha: true` + transparency prompt tags | **426401 / 1011712 (42.1%)** |
| normal generation | 4189 / 1011712 (0.4%) |

This is the capability the whole lane exists for, and it confirms the `030`
alpha decision was worth the audit round it cost: routing NAI into the
JPEG-forcing group would have flattened 42% of the image onto black.

## Verified request shape

The exact body `generateViaNai` builds was accepted as-is by V5: `input`,
`model`, `action: "generate"`, and `parameters` with `params_version: 3`,
`ucPresetId`, `qualityPresetId`, `straight_alpha`, the `v4_prompt` /
`v4_negative_prompt` caption blobs, and the sampler-gated
`prefer_brownian` / `deliberate_euler_ancestral_bug` pair. No field was
rejected.

## Still open

Nothing blocking. The user's own first generation through the UI remains the
final confirmation of the full pipeline (storage, metadata, gallery), which
this probe deliberately bypassed by calling the adapter directly.
