# OAuth Fallback Reference Retention — Plan (000)

## Problem

DC gallery user report (2026-07-15): reference images are frequently ignored since
GPT-5.6 Sol/Luna. Log analysis pointed at the OAuth fallback retry path; patching the
retry to keep `referenceInputs` nearly eliminated the reference loss.

Root cause (confirmed by reading code):

- `lib/responsesImageAdapter.ts` `generateViaResponses` builds the initial request with
  `referenceInputs` (normalized `input_image` parts) in the user content.
- When the stream yields no image and `allowPromptOnlyOAuthFallback === true`
  (set by `lib/generatePipeline.ts:266` for every non-API provider), it calls
  `retryPromptOnlyJsonImage` in `lib/responsesFallback.ts`.
- Every retry attempt there rebuilds `input` as developer prompt + text-only user
  content. References are dropped on ALL attempts; `referencesDroppedOnRetry` is
  telemetry-only. A transient empty stream therefore silently degrades a
  reference-guided generation into a no-reference generation — the user sees "my
  reference was ignored" with no error.

## Loop-spec

- Archetype: spec-satisfaction repair.
- Trigger: OAuth no-image stream fallback with references present.
- Goal: fallback retries carry the same references as the initial request; only the
  true last-resort attempt may drop them.
- Non-goals: provider=api behavior, multimode/edit fallback (they have none), UI,
  Grok/Gemini, web-search retry policy (stays dropped on retry).
- Verifier: `npm run typecheck`, `npm run typecheck:tests`, `npm test` (>=1094 cases),
  plus new payload-asserting unit tests (activation evidence per
  C-ACTIVATION-GROUNDING-01: mocked fetch drives the fallback and the test reads the
  retry request bodies).
- Stop: tests green + release shipped (wp2).
- Escalation: release credential/branch-policy problems -> NEEDS_HUMAN.

## Diff-level plan

### MODIFY lib/responsesFallback.ts

- Signature: replace `referencesDroppedOnRetry: boolean` param with
  `referenceInputs: Array<{ type: string; image_url: string }>` (the already-normalized
  parts from the adapter). Keep `webSearchDroppedOnRetry`.
- Attempt plans:
  - Attempts 1..MAX_RETRIES (developer prompt kept): INCLUDE `referenceInputs` in user
    content — `[...referenceInputs, { type: "input_text", text: buildUserTextPrompt(...) }]`
    when refs exist, plain string otherwise. `retryKind` becomes
    `references_with_developer` when refs are kept, `prompt_only_with_developer` when
    there were none. `referencesDroppedOnRetry: false`.
  - Final attempt (developer prompt dropped, "clean last word"): stays truly
    prompt-only — refs dropped as last resort (censorship-relief escape hatch when the
    reference itself causes refusal/empty output).
    `retryKind: "prompt_only_json_image_tool"`, `referencesDroppedOnRetry: refs > 0`.
- Meta: `referencesDroppedOnRetry` moves from baseMeta into per-attempt plan (truthful
  per attempt); add `hadReferences` to baseMeta. Keep field names consumed by
  `lib/generatePipeline.ts` (~311-320) intact.
- Final `emptyResponseError` diag: `refsCount`/`inputImageCount` describe the last
  attempt (0 refs) — keep, plus `hadReferences` arrives via retryMeta spread.

### MODIFY lib/responsesImageAdapter.ts

- Call site: pass `referenceInputs` (array) instead of
  `referencesDroppedOnRetry: referenceInputs.length > 0`.

### MODIFY tests/responses-empty-taxonomy.test.ts

- Update "OAuth no-image stream retries once with prompt-only non-stream image tool":
  with refs, call 2 must now include the `input_image` part; `retryKind`
  `references_with_developer`; `referencesDroppedOnRetry` false.
- ADD test: all developer-prompt retries fail -> final attempt payload has NO
  `input_image`, no developer role, `referencesDroppedOnRetry` true,
  `developerPromptDroppedOnRetry` true (activation scenario for the last-resort drop).
- ADD/keep test: no-references path keeps `prompt_only_with_developer` kind.

### Audit fold-back (A-phase amendments, reviewer verdict GO-WITH-FIXES blockers=2)

Blocker 1 — CORRECTION + IN SCOPE: `lib/oauthProxy/generators.ts` `generateViaOAuth`
(~lines 141-204) contains a SECOND live refs-dropping fallback: a single prompt-only
non-stream retry (`input: [{ role: "user", ... }]`), exercised by card news
(`lib/cardNewsGenerator.ts:210,230` passes `[templateB64, ...card.references]`).
Decision: fix it with the same policy — keep `referenceInputs` in the retry user
content (`[...referenceInputs, input_text]` when refs exist), set
`referencesDroppedOnRetry: false` / truthful, `retryKind` becomes
`references_json_image_tool` when refs are kept (else stays `prompt_only`). NO extra
prompt-only last-resort attempt is added in this path: card news without its template
is useless output, and the single-retry shape is preserved (minimal behavior delta).

Blocker 2 — telemetry propagation: `hadReferences` would be stripped by three
allowlists. Fix: add `hadReferences` to `EmptyResponseMeta`
(`lib/responsesErrors.ts:15-37`), `copyEmptyResponseMetadata`
(`lib/generationErrors.ts:149-175`), `upstreamErrorFields`
(`lib/routeHelpers.ts:31-54`), and `firstRetryMeta` (`lib/generatePipeline.ts:315-323`).

### Unchanged callers (re-verified by reviewer)

- `lib/generatePipeline.ts:266` only toggles `allowPromptOnlyOAuthFallback`; consumers
  of retry meta are value-agnostic allowlist copies (no branching on retryKind values).
- Edit/multimode adapter paths have no fallback; nodes/video never set
  `allowPromptOnlyOAuthFallback`.
- `lib/oauthProxy/multimodeGenerators.ts` builds its own requests, no prompt-only
  fallback contract.

## Accept criteria

1. Retry payloads 1..MAX_RETRIES contain the exact `input_image` parts of the initial
   request (unit-test asserted from mocked fetch bodies).
2. Final attempt remains instruction-free prompt-only; telemetry truthful per attempt.
3. typecheck + typecheck:tests + full test suite green.
4. Sol-high cxc-search research verdict on final-attempt policy recorded in 001 doc.
5. wp2: commit on dev, push, promote/release per existing repo flow.
6. (fold-back) `generateViaOAuth` retry keeps references; card-news retry no longer
   drops the template (test or payload assertion where feasible).
7. (fold-back) `hadReferences` survives the three allowlists into error payloads and
   retry meta.
