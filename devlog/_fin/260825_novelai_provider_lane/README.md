# NovelAI (`nai`) provider lane

Landed on `dev` 2026-08-25 across `ed1e7d1a` → `6e95d812`. Closed as the tenth core provider
lane in `lib/providers/registry.ts`.

## What shipped

A full text-to-image provider lane for NovelAI, selectable from the web UI, the CLI, multimode
and node mode, authenticated with a pasted persistent token (`pst-...`) rather than a sign-in
session. Four models: `nai-diffusion-5-full`, `nai-diffusion-5-curated`, `nai-diffusion-4-5-full`,
`nai-diffusion-4-5-curated`.

Two things made this lane unlike its siblings. NovelAI answers with a **ZIP archive** rather than
JSON or a raw image, so `lib/naiZip.ts` is a purpose-built entry reader with ZIP64 and encryption
refusal and a 50MB cap. And its account endpoints have **moved to the image host** — `api.novelai.net`
now answers every `/user/*` call with a 400 telling third-party tools to use the image URL, so
validating there would reject every valid token. That was found by live probe, not by reading docs.

## Work phases

| Phase | Unit | Outcome |
| --- | --- | --- |
| wp0 | `000`-`004` | Docs-first roadmap plus a live V5 probe that corrected two roadmap assumptions |
| wp1 | `010` | Registry manifest, type widening, config/runtimeContext/keys plumbing |
| wp2 | `020` | `naiImageAdapter`, `naiZip`, `NAI_*` error mapping |
| wp3 | `030`, `005`, `006` | Server routing: imageModels, providerOptions, generatePipeline, models, capabilities, edit refusals |
| wp4 | `040`, `007` | UI, doctor, i18n — provider selectable end-to-end in the built frontend |
| wp5 | `050` | Full gate sweep, SoT sync across 24 enumeration sites, push |

## Deliberate limits

Text-to-image only. References are refused with `NAI_REF_UNSUPPORTED` and edits with
`NAI_EDIT_UNSUPPORTED` rather than silently downgraded, the catalog declares `inputRoles: ["text"]`
so it never advertises what the routes reject, and the UI caps the reference tray at zero so the
affordance never appears. Agent Mode does not dispatch the lane.

`NAI_UNKNOWN` stays an unregistered fallback by design: unmapped adapter errors become the generic
UNKNOWN toast, while all 15 real operational codes carry NovelAI-specific copy in four locales.

## Two bugs worth remembering

Both were **stale build artifacts**, not source defects, and both cost real debugging time.

The user reported "Invalid provider" when saving a NovelAI key. The source was correct; the running
server had been started before `nai` existed in `routes/keys.js`. Later, `ima2 doctor` printed
MiniMax-specific copy for the nai lane after the TypeScript was already fixed, because
`bin/lib/doctor-providers.js` is gitignored and needed `npm run build:cli`.

If a provider change looks absent at runtime, check artifact mtime against the source before
suspecting the code.

## Evidence

`evidence/` holds the live key round-trip, a real V5 generation with its PNG provenance, and
built-UI render grounding. Verified against a live NovelAI account, not a mock.

