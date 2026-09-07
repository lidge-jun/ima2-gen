# WP04 P — current execution ownership revalidation

Baseline d039b5875f511bdfe103ee8444f63b90308f4369, branchcodex/prod-wp04-openai.
WP03 closed through real D: PR202 over201; CI33953798297 fully successful;
Node22/24 each2923 tests/0fail; frontend39/39; focused169cases; manualHTTP13
scenarios/14requests; two independent visualPASS covering70uniquePNG. Previous
guard/radius/nav-occlusion findings were repaired and recorded in036. Do not
reopen WP03 or claim the larger release goal is complete. No WP04 code edits yet.

## Inherited contracts and initial source findings

Read responsesImageAdapter.ts and responsesFallback.ts completely at this head,
plus current execution/index/legacy and relevant helpers. Current operation and
transport bodies are unchanged since WP03; the four callers now delegate through
the seam. The old040 selector pseudocode called a nonexistent prepareLegacyExecution;
actual symbol is prepareLegacyImageExecution. Keep index's current credential
checks before prepare/each execute around either selected implementation.

ExecutionOptions.reasoningEffort is string-or-undefined, not mandatory string:
WP03 corrected this to preserve the normalizer's actual inferred return without
adding defaults. Family options pass it through; the existing operation still
uses its own low fallback. Single providerUrl is nullable; sequence/progress URL
is string-or-undefined. Preserve exact-optional omission/null conventions.

The transport extraction also needs the private UpstreamError interface, which
was omitted from040's symbol list. Keep the marker string/known-error identity,
safe upstream wording/redaction, endpoint wait-readiness and timeout ordering.

## Retry fixture correction

Empty Responses SSE produces an emptyResponseError with status422. Classic's
existing finite4xx guard does not retry it. An HTTP503 fixture response reaches
the second outer attempt without violating the strict fixture exception ledger. The fresh
WP03 tests distinguish these cases. O04-3 now specifies those reachable inputs,
not a fictitious retryable-empty/API two-call path. isNonRetryableGenerationError
deliberately treats safety codes differently; this phase changes no retry policy.

OAuth's classic opt-in fallback remains one initial request plus up to three
fallback attempts. First two keep references/developer, final one drops them;
metadata names/values and total request count are part of O04-2. API is refused
inside retryPromptOnlyJsonImage even if called with fallback optiontrue; preserve
both the family opt-in distinction and the fallback's own provider check.

## Same-object narrowing proof

Virtual CompilerHost/noEmit probe included all server roots and this shape:

```ts
type OpenaiRequest = ImageExecutionRequest & { provider: "oauth" | "api" };
type LegacyRequest = ImageExecutionRequest & {
  provider: Exclude<ImageExecutionRequest["provider"], "oauth" | "api">
};
function isOpenaiRequest(r: ImageExecutionRequest): r is OpenaiRequest {
  return r.provider === "oauth" || r.provider === "api";
}
function isLegacyRequest(r: ImageExecutionRequest): r is LegacyRequest {
  return r.provider !== "oauth" && r.provider !== "api";
}
```

Generic public overload plus an implementation returning the surface union
dispatches through these guards without data copies or any casts. Assigning the
function to canonical PrepareImageExecution and a classic result to
Promise<PreparedImageExecution<"classic">> produced zero diagnostics, exit0,
no emitted/source files. Place OpenaiRequest/guard with the OpenAI owner and
LegacyExecutionRequest/guard in legacy.ts; leaf helpers import legacy type only.
Keep narrowed internal types separate from the public all-provider request.

## Refreshed baseline

Owned empty config, separate synthetic DB/generated paths, env-i and dotenv off:

```sh
node --import tsx --test --test-concurrency=1 \
  tests/responses-adapter-safety.test.ts \
  tests/provider-execution-classic.test.ts \
  tests/provider-execution-node.test.ts \
  tests/provider-execution-edit.test.ts \
  tests/provider-execution-multimode.test.ts
```

Observed44 substantive cases (38 child surface cases +6 direct safety), fail0,
skip0; parent reports10 including four child wrappers. No provider traffic or
full local suite. All new helpers preserve prior strict aborted-reason matching,
real detached-writer drain and test-child environment isolation.

## Resource boundaries

Same authorized repo/owned stack/GitHub CI, zero paid provider requests, no user
proxy/browser/credentials or data writes. Four-hour WP reassessment,72-hour goal
bound; no new numerical token budget. Full suites only exact-head hosted CI;
focused local fixtures/build/typecheck allowed. Explicit Astra/high workers only;
priority remains user runtime setting, not an independently proven spawn field.

Independent test-impact findings and complete disjoint B ownership/fixture
activation plan are recorded in042. No WP04 implementation starts before A.

## Independent parity findings folded into040

Singer01a0709a-3170-76f2-8f48-3c75b2e53d4c confirmed the retry correction and
identified additional precision requirements, all accepted:

- Transport499/504 identity differs from classic's existing normalization
  (INVALID_REQUEST499 / UNKNOWN504 after two timeout attempts). Preserve both
  layers and real canceled-route behavior instead of asserting one code everywhere.
- Edit uses rawPrompt with Responses usage/search defaults; node partial callback
  forwarding is independent of partialImages. No new callback enablement gate.
- Keep classic prepare-time scalar capture versus execute-time refs/signal/ctx,
  and other surfaces' execute-time request/callback reads.
- Preserve current index credential wrapper, replace selection only. Both main
  and reviewer no-emit probes validated same-object generic narrowing; single
  type guard with a still-wide legacy argument was explicitly rejected by TS.
- SSE final callbacks are awaited and byte-deduped; JSON parser and OAuth fallback
  do not have those callback/dedupe semantics. O04-6 now makes this distinction.
- API fallback has two guards, so a one-flag mutation may survive legitimately.
  Mutation proof must remove actual prevention of extra transport calls.

Reviewer native assignments for three result types, refs and final callback had
zero diagnostics. No source writes/tests/provider calls by this P reviewer.
