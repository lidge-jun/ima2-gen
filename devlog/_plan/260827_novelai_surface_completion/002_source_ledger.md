# NovelAI source ledger

Research only. Accessed 2026-08-27.

## Tier-2 primary evidence

- https://journal.novelai.net/image-generation-novelai-diffusion-v5-is-here-c2df7c6b8d2d/
  - Official NovelAI Journal, published 2026-08-21.
  - V5 Full and Curated available; natural-language/tag prompting; official English
    and Japanese prompt support; native alpha; longer prompts; Character Positioning;
    V5 Full inpainting; Precise Reference and Vibe Transfer still in progress.
  - `agbrowse fetch --browser never` returned HTTP 200, `strong_ok`.
- https://docs.novelai.net/en/image/sampling/
  - Official sampler and Auto SMEA behavior.
  - HTTP 200; page is current but documentation shell yields `weak_ok`.
- https://docs.novelai.net/en/image/stepsguidance/
  - Steps, guidance, Guidance Rescale, and Decrisper behavior.
  - HTTP 200.
- https://docs.novelai.net/en/image/qualitytags/
  - V5 Light/Standard quality-tag behavior and V4.5 tags.
  - HTTP 200.
- https://docs.novelai.net/en/image/seed/
  - Seed reproducibility contract and numeric input.
  - HTTP 200.
- https://docs.novelai.net/en/faq/
  - V5 usage-limit and subscription context; free trial is 30 images up to 1024x1024.
  - HTTP 200.

## Known documentation drift

https://docs.novelai.net/en/image/models/ still calls V4.5 the latest model even
though the newer official Journal and FAQ describe V5 as launched. The 2026-08-21
Journal is newer and product-specific, so it is authoritative for model availability.

## Repository evidence

- CLIsu `src/ts/process/stableDiff.ts:340-419`: core request shape, negative prompt,
  cfg rescale, SMEA fields, noise schedule, seed, Variety+ coefficient.
- CLIsu `src/ts/process/stableDiff.ts:422-565`: vibe/director references and img2img
  demonstrate why generic ima2 refs cannot be silently reinterpreted.
- CLIsu `src/ts/storage/databaseTypes.ts:966-1026`: persisted NAI option shape.
- ima2 `lib/naiImageAdapter.ts:106-259`: live text-to-image adapter and ZIP path.
- ima2 `ui/src/lib/naiPayload.ts:23-48`: sparse/effective-lane payload gate.
- Prior live receipt: `devlog/_fin/260825_novelai_provider_lane/004_live_api_probe.md`.
