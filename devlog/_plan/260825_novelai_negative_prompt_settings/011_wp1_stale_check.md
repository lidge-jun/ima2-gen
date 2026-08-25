# 011 — wp1 stale check (P-phase)

Re-verified `010`'s change map against the tree at `16de4118` before writing
any code (LOOP-CONTINUITY-01).

| Claim in `010` | Tree | Status |
|---|---|---|
| `lib/generatePipeline.ts:478-484` seven-field ladder | present | current |
| `lib/multimodePipeline.ts:416-424` nai branch forwards model/size/signal/requestId only | present, confirmed verbatim | current |
| `lib/nodeGeneration.ts:338-344` same | present | current |
| `lib/nodeHelpers.ts` `NodeGenerateBody` has no NAI fields | confirmed — 22 members, none NAI | current |
| `lib/capabilities.ts:76` `defaults` object with `oauth`/`api`/`grok` | present, uses `appConfig` binding | current |
| `lib/generatePipeline.ts:351-352, 684-685` history metadata | `composerPrompt` + `composerInsertedPrompts` at both sites | current |
| `lib/multimodePipeline.ts:321-322` same | present | current |
| `lib/naiImageAdapter.ts:127-128, 142` unguarded V5 fields | present | current |
| `lib/agentImageVideoGen.ts:130-139` fourth caller | present | current |

No amendment needed. `010` executes as written.

## Metadata field naming

`010` says `composerNegativePrompt`. The neighbouring fields are
`composerPrompt` and `composerInsertedPrompts`, so the name is consistent with
the local convention and needs no change.

