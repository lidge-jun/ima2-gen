# Research: Responses API retry semantics with input_image references (001)

Source: sol-high explorer dispatch with cxc-search skill (2026-07-15, agent "Bernoulli").
Verdict feeds accept criterion c4 (final-attempt policy).

## Bottom line

Public evidence supports preserving `referenceInputs` on retries unless an explicit
error identifies the images themselves as invalid/unsupported/oversized/moderation-
blocked. Dropping them turns reference-conditioned generation into prompt-only
generation — a degraded fallback, not an equivalent retry.

## Key Tier-2 proven findings (source opened)

- Image inputs/multiple references are a documented normal Responses image_generation
  workflow: https://developers.openai.com/api/docs/guides/image-generation ,
  https://developers.openai.com/api/docs/guides/images-vision#image-input-requirements
- Moderation blocks surface as `image_generation_user_error` (`moderation_blocked`,
  optional `moderation_stage`), not a silent empty success:
  https://developers.openai.com/api/docs/guides/image-generation#handling-blocked-requests-and-other-errors
- Official retry guidance: retry transient 429/5xx with the same operation; payload
  mutation is for user-correctable errors. openai-node auto-retries connection/408/409/
  429/5xx with identical payload: https://github.com/openai/openai-node#retries
- Codex/ChatGPT-backend empty `output: []` envelopes are a known backend/assembly
  shape issue unrelated to image inputs (community reports):
  https://github.com/openai/openai-python/issues/3313 ,
  hermes-agent#5678; Codex source strips images only when the model lacks image
  support, never retry-specific: codex-rs context_manager/normalize.rs
- No public source recommends dropping image inputs merely because the prior
  response was empty.

## Candidate-unverified

- No source directly shows valid `input_image` parts increasing empty-output
  probability (supports: references are not the culprit for empty streams).

## Decision for this fix

1. Developer-prompt retries (attempts 1..MAX_RETRIES): keep `referenceInputs` —
   matches official "retry the same operation" guidance for transient empties.
2. Final instruction-free attempt: keep it prompt-only as a separately labeled
   degraded last resort (research point 5), with truthful per-attempt
   `referencesDroppedOnRetry` telemetry.
