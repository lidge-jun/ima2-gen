#### Key Information

# Models

### Text API Pricing

| Model | Context | Input / 1M tokens | Cached input / 1M tokens | Output / 1M tokens |
| --- | --- | --- | --- | --- |
| grok-4.6 (< 200k prompt tokens) | 500k | $2.00 | $0.50 | $6.00 |
| grok-4.6 (≥ 200k prompt tokens) | 500k | $4.00 | $1.00 | $12.00 |
| grok-4.5 (< 200k prompt tokens) | 500k | $2.00 | $0.30 | $6.00 |
| grok-4.5 (≥ 200k prompt tokens) | 500k | $4.00 | $0.60 | $12.00 |
| grok-4.3 (< 200k prompt tokens) | 1M | $1.25 | $0.20 | $2.50 |
| grok-4.3 (≥ 200k prompt tokens) | 1M | $2.50 | $0.40 | $5.00 |
| grok-4.20-0309-reasoning (< 200k prompt tokens) | 1M | $1.25 | $0.20 | $2.50 |
| grok-4.20-0309-reasoning (≥ 200k prompt tokens) | 1M | $2.50 | $0.40 | $5.00 |
| grok-4.20-0309-non-reasoning (< 200k prompt tokens) | 1M | $1.25 | $0.20 | $2.50 |
| grok-4.20-0309-non-reasoning (≥ 200k prompt tokens) | 1M | $2.50 | $0.40 | $5.00 |
| grok-build-0.1 (< 200k prompt tokens) | 256k | $1.00 | $0.20 | $2.00 |
| grok-build-0.1 (≥ 200k prompt tokens) | 256k | $2.00 | $0.40 | $4.00 |
| grok-4.20-multi-agent-0309 (< 200k prompt tokens) | 1M | $1.25 | $0.20 | $2.50 |
| grok-4.20-multi-agent-0309 (≥ 200k prompt tokens) | 1M | $2.50 | $0.40 | $5.00 |

*Prices shown per million tokens. Models listed with two rows use long context pricing: requests whose prompt reaches the listed token threshold are billed at the higher rate for all tokens in the request.*

### Imagine Pricing

| Model | Cost |
| --- | --- |
| grok-imagine-image | $0.02 / image |
| grok-imagine-image-quality | $0.05 / image |
| grok-imagine-image-2.0 | $0.04 / image |
| grok-imagine-video-1.5 | $0.080 / sec |
| grok-imagine-video | $0.050 / sec |

### Voice Pricing

| Mode | Cost |
| --- | --- |
| Speech to Speech (grok-voice-think-fast-2.0) | $0.08 / min ($4.80 / hr) audio<br />$0.004 / text input |
| Speech to Speech (grok-voice-think-fast-1.0) — Deprecated | $0.05 / min ($3.00 / hr) audio<br />$0.004 / text input |
| Speech to Text | $0.10 / hr (REST), $0.20 / hr (Streaming) |
| Text to Speech | $15.00 / 1M chars |

## Which model should I choose?

Your choice depends on your use case. We have dedicated models and APIs for audio, image, and video capabilities. For everything else, including code, use Grok 4.6. It is the most intelligent and fastest model we’ve built.

Code: [Grok 4.6](/developers/models/grok-4.6)

Chat: [Grok 4.6](/developers/models/grok-4.6)

Images: [Grok Imagine Image 2.0](/developers/models/grok-imagine-image-2.0)

Videos: [Grok Imagine Video 1.5](/developers/models/grok-imagine-video-1.5)

Voice: [Grok Voice API](/developers/model-capabilities/audio/voice)

## Additional Information Regarding Models

* **No access to realtime events without search tools enabled**
  * Grok has no knowledge of current events or data beyond what was present in its training data.
  * To incorporate realtime data with your request, enable server-side search tools (Web Search / X Search). See [Web Search](/developers/tools/web-search) and [X Search](/developers/tools/x-search).
* **Chat models**
  * No role order limitation: You can mix `system`, `user`, or `assistant` roles in any sequence for your conversation context.
  * `logprobs` and `top_logprobs` are not supported by models `grok-4.20` and newer. These fields will be silently ignored if set.
* **Image input models**
  * Maximum image size: `20MiB`
  * Maximum number of images: No limit
  * Supported image file types: `jpg/jpeg` or `png`.
  * Any image/text input order is accepted (e.g. text prompt can precede image prompt)
* **Batch API**
  * Not every model accepts [Batch API](/developers/advanced-api-usage/batch-api) requests. See Details on each model page.

> [!NOTE]
>
> The knowledge cut-off date of Grok 4.6 is February 1, 2026.

## Model Aliases

Some models have aliases to help users automatically migrate to the next version of the same model. In general:

* `<modelname>` is aliased to the latest stable version.
* `<modelname>-latest` is aliased to the latest version. This is suitable for users who want to access the latest features.
* `<modelname>-<date>` refers directly to a specific model release. This will not be updated and is for workflows that demand consistency.

For most users, the aliased `<modelname>` or `<modelname>-latest` are recommended, as you would receive the latest features automatically.
