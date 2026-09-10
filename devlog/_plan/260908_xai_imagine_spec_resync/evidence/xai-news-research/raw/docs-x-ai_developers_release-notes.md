#### Release Notes

# Release Notes

## September

### grok-imagine-image-quality retirement on November 2

On November 2, 2026, `grok-imagine-image-quality` is retired. Requests to the slug will be served by `grok-imagine-image-2.0` with `quality` set to `low`, with no change to the request or response shape and at a lower per-image price. `grok-imagine-image` (1.0) is not affected. See the [migration guide](/developers/migration/imagine-image-quality-nov-2).

## August

### Imagine image API updates

* **Auto quality.** The `quality` parameter on `grok-imagine-image-2.0` now accepts `auto`, and the default when `quality` is omitted has moved from `medium` to `auto`. Auto currently uses `low` for image generation and `medium` for image editing. Images are billed at the quality they are served at. Pass `low` or `medium` explicitly to pin a specific quality. See [Image Generation](/developers/model-capabilities/images/generation#quality).
* **Five reference images.** Image editing now accepts up to 5 source images per request (was 3). See [Multi-Image Editing](/developers/model-capabilities/images/multi-image-editing).
* **New aspect ratios.** Image generation and editing accept `21:9` (cinematic widescreen) and `5:2` (wide banners). See [Image Generation](/developers/model-capabilities/images/generation#aspect-ratio).

### Grok 4.6

Grok 4.6, SpaceXAI's frontier model for coding, agentic tasks, and knowledge work, is now available on the xAI API. It has a 500k context window, text and image inputs with text-only output, and no text output limit. Pricing is $2 / $0.50 / $6 per 1M tokens (input / cached input / output) below 200k prompt tokens, and $4 / $1 / $12 above. Reasoning effort supports low, medium, high (default), and xhigh. See the [Grok 4.6 overview](/developers/grok-4-6) and the [announcement](https://x.ai/news/grok-4-6).

### Grok Bot

Grok Bot is now available. Durable AI teammates that work on a persistent cloud computer, with messaging, approvals, connectors, and routines. See the [Grok Bot overview](/grok-bot/overview) and [Get started](/grok-bot/get-started).

## July

### grok-imagine-video-1.5 modalities

`grok-imagine-video-1.5` now supports text-to-video, image-to-video, and reference-to-video (including optional preset voices), with native 1080p for T2V and I2V. Text-to-video on this model runs as text-to-image then image-to-video under the hood. See [Video Generation](/developers/model-capabilities/video/generation), [Image-to-Video](/developers/model-capabilities/video/image-to-video), and [Reference-to-Video](/developers/model-capabilities/video/reference-to-video).

### Grok Voice Think Fast 2.0 is available

`grok-voice-think-fast-2.0` is now available with Speech to Speech. `grok-voice-latest` will route to this model starting August 5, 2026. To get started, see the [Speech to Speech docs](/developers/model-capabilities/audio/speech-to-speech). For more details, see our [announcement](https://x.ai/news/grok-voice-think-fast-2).

### Adjustable VAD threshold for Speech to Text

Speech to Text now accepts a `vad_threshold` parameter (streaming query param and batch multipart field) to tune the voice-activity gate that skips non-speech audio. Lower values transcribe quieter or noisier speech — useful for narrowband telephony — and `0` disables the gate. See the [Speech to Text docs](/developers/model-capabilities/audio/speech-to-text).

### Grok 4.5 available in the EU

Grok 4.5 is now available in the API console for EU users. See the [Grok 4.5 overview](/developers/grok-4-5).

### Grok 4.5

Grok 4.5, SpaceXAI's model for coding, agentic tasks, and knowledge work, is now available on the xAI API. Priced at $2 / 1M input tokens and $6 / 1M output tokens, with configurable reasoning effort (low, medium, or high; default high). See the [Grok 4.5 overview](/developers/grok-4-5) and the [announcement](https://x.ai/news/grok-4-5).

## June

### Priority Processing

You can now request higher scheduling priority per request by setting `service_tier: "priority"` on text inference endpoints (Chat Completions and Responses). The response's `service_tier` field reports the tier actually applied, and priority rates are billed only when priority is used. For more details, see the [Priority Processing docs](/developers/advanced-api-usage/priority-processing).

### Public URLs and Files API ↔ Imagine integration

* **Public URLs for Files** — turn any file in your [Files API](/developers/files) storage into a permanent, unauthenticated URL that anyone can open, embed, or share. Revocable at any time, or set an auto-expiry between 1 hour and 30 days. See the [Public URLs docs](/developers/files/public-urls).
* **Reference stored files as Imagine inputs** — substitute `image_file_id`, `video_file_id`, or `reference_image_file_ids` for URL inputs across every Imagine endpoint, with no need to re-upload bytes or make the file public. See [Imagine → Files API Integration](/developers/model-capabilities/imagine/files/inputs).
* **Persist Imagine outputs to Files** — set `storage_options` on any Imagine request to save the generated asset to your Files storage; pair with `storage_options.public_url` to publish a shareable link in one round trip. See [Imagine → Files API Integration](/developers/model-capabilities/imagine/files/outputs).

## May

### Smart Turn for Streaming STT

The streaming Speech to Text API now supports Smart Turn end-of-turn detection. When enabled via the `smart_turn` query parameter, an ML model predicts whether the speaker has finished their thought at silence boundaries — reducing false endpointing during dictation, number sequences, and mid-sentence pauses. Use `smart_turn_timeout` to set a maximum silence fallback. For more details, see the [Smart Turn docs](/developers/model-capabilities/audio/speech-to-text#smart-turn).

### Context Compaction

The Context Compaction API is now available. You can shrink long conversations into a shorter context and reuse it in follow-up requests for lower cost, faster time-to-first-token, and sharper responses on long agent loops. For more details, see the [Context Compaction docs](/developers/advanced-api-usage/context-compaction).

### WebSocket Responses API Mode

WebSocket Responses API mode is now available. Drive the Responses API over a single, long-lived WebSocket connection for lower end-to-end latency on tool-heavy agent workloads. For more details, see the [WebSocket Mode docs](/developers/advanced-api-usage/websocket-mode).

### Image Search in Web Search

Web Search now supports explicitly searching for images. Enable `enable_image_search` to let Grok search directly for relevant images; responses can include returned images as Markdown image embeds. For details, see [Enable Image Search](/developers/tools/web-search#enable-image-search).

### Grok Build 0.1

xAI's coding model, trained specifically for agentic coding workflows. Currently in early access.

The model slug is [`grok-build-0.1`](/developers/models/grok-build-0.1).

### Grok Build

Grok Build is now available in beta. Use the interactive TUI, run headlessly in scripts, or build apps and orchestrators with the Agent Client Protocol.

Install with a single command:

```bash customLanguage="bash"
curl -fsSL https://x.ai/cli/install.sh | bash
```

For more details, see the [Grok Build docs](/build/overview).

### Custom Voices

You can now clone a voice from a short audio clip and use it across the Text-to-Speech and Speech to Speech APIs. Create and manage your voice catalog from the xAI console. For more details, check out the [Custom Voices docs](/developers/model-capabilities/audio/custom-voices) and our [blog post](https://x.ai/news/grok-custom-voices).

## April

### Cost Tracking

Every API response now includes the exact cost of the request via a `cost_in_usd_ticks` field in the `usage` object. Works across chat completions, Responses API, image generation, video generation, and streaming. For more details, see the [Cost Tracking docs](/developers/cost-tracking).

### Files API TTL

You can now set an expiration policy on uploaded files using `expires_after` or an explicit `expires_at` timestamp. Expired files are automatically deleted. For more details, see the [Files API docs](/developers/files).

### Grok Voice Think Fast 1.0 is available

You can now use `grok-voice-think-fast-1.0` with the Speech to Speech API. To get started, check out the [Speech to Speech docs](/developers/model-capabilities/audio/speech-to-speech). For more details, see our [blog post](https://x.ai/news/grok-voice-think-fast-1).

### Speech to Text is available

The xAI Speech to Text API is now generally available. Transcribe audio to text in 25 languages with batch and streaming modes. For more details, check out the [Speech to Text docs](/developers/model-capabilities/audio/speech-to-text).

## March

### Text-to-Speech is available

The Text-to-Speech API is now generally available. Generate natural-sounding speech from text with Grok. For more details, check out the [Text-to-Speech docs](/developers/model-capabilities/audio/text-to-speech).

### Batch API supports Image and Video generation

The [Batch API](/developers/advanced-api-usage/batch-api) now supports [image generation](/developers/model-capabilities/images/generation), [image editing](/developers/model-capabilities/images/editing), and [video generation](/developers/model-capabilities/video/generation) in addition to chat completions. Both [server-side tools](/developers/tools/overview) and client-side function tools are also now supported in batch requests. Image and video URLs in batch results expire after 1 hour.

### Batch API JSONL file upload

You can now create batches by uploading a [JSONL file](/developers/advanced-api-usage/batch-api#jsonl-file-upload) via the Files API. Supports all batch endpoints including chat, image, and video in a single file.

### Grok 4.20 and Grok 4.20 Multi-agent are live

* For more details on Grok 4.20 Multi-agent, check out the [docs](/developers/model-capabilities/text/multi-agent)

## January

### Video Generation & Next-Gen Image Generation

[Video Generation](/developers/model-capabilities/video/generation) and a revamped [Image Generation](/developers/model-capabilities/images/generation) are now available.

### Batch API is released

[Batch API](/developers/advanced-api-usage/batch-api) is available for all customers. It enables efficient batch processing of multiple requests, providing a better experience for users who need to submit large volumes of requests at once.

## December 2025

### Grok Speech to Speech API is released

Grok Speech to Speech API is generally available. Visit [Grok Speech to Speech API](/developers/model-capabilities/audio/voice) for guidance on using the API.

## November 2025

### Grok 4.1 Fast is available in Enterprise API

You can now use Grok 4.1 Fast in the [xAI Enterprise API](https://x.ai/api). For more details, check out [our blogpost](https://x.ai/news/grok-4-1-fast).

### Agent tools adapt to Grok 4.1 Fast models and tool prices dropped

* You can now use Grok 4.1 Fast models with the agent tools, check out the [documentation of agent tools](/developers/tools/overview) to get started.
* The price of agent tools drops by up to 50% to no more than $5 per 1000 successful calls, see the new prices at [the pricing page](/developers/pricing#tools-pricing).

### Files API is generally available

You can now upload files and use them in chat conversations with the Files API. For more details, check out [our guide on Files](/developers/files).

### New Tools Available

* **Collections Search Tool**: You can now search through uploaded knowledge bases (collections) in chat conversations via the API. For more details, check out the [docs](/developers/tools/collections-search).
* **Remote MCP Tools**: You can now use tools from remote MCP servers in chat conversations via the API. For more details, check out the [docs](/developers/tools/remote-mcp).
* **Mixing client-side and server-side tools**: You can now mix client-side and server-side tools in the same chat conversation. For more details, check out the [docs](/developers/tools/advanced-usage#mixing-server-side-and-client-side-tools).

## October 2025

### Tools are now generally available

New agentic server-side tools including `web_search`, `x_search`, and `code_execution` are available. For more details, check out [our guide on using Tools](/developers/tools/overview).

## September 2025

### Responses API is generally available

You can now use our stateful Responses API to process requests.

## August 2025

### Collections API is released

You can upload files, create embeddings, and use them for inference with our Collections API.

## July 2025

### Grok 4 is released

You can now use Grok 4 via our API or on https://grok.com.

## June 2025

### Management API is released

You can manage your API keys via Management API at
`https://management-api.x.ai`.

## May 2025

### Cached prompt is now available

You can now use cached prompt to save on repeated prompts. For
more info, see [models](/developers/models).

### Live Search is available on API

Live search is now available on API. Users can generate
completions with queries on supported data sources.

## April 2025

### Grok 3 models launch on API

Our latest flagship `Grok 3` models are now generally available via
the API. For more info, see [models](/developers/models).

## March 2025

### Image Generation Model available on API

The image generation model is available on API. Visit
[Image Generations](/developers/model-capabilities/images/generation) for more details on using the model.

## February 2025

### Audit Logs

Team admins can now view audit logs on [console.x.ai](https://console.x.ai?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-release-notes\&utm_content=console-home).

## January 2025

### Docs Dark Mode

Released dark mode support on docs.x.ai

### Status Page

Check service statuses across all SpaceXAI products at
[status.x.ai](https://status.x.ai/).

## December 2024

### Replit & xAI

Replit Agents can now integrate with xAI! Start empowering your agents with Grok.
Check out the [announcement](https://x.com/Replit/status/1874211039258333643) for more information.

### Tokenizer Playground

Understanding tokens can be hard. Check out
[console.x.ai](https://console.x.ai?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-release-notes\&utm_content=console-home) to get a better understanding of what counts as a token.

### Structured Outputs

We're excited to announce that Grok now supports structured outputs. Grok can
now format responses in a predefined, organized format rather than free-form text. 1. Specify the
desired schema

```
{
    "name": "movie_response",
    "schema": {
        "type": "object",
        "properties": {
            "title": { "type": "string" },
            "rating": { "type": "number" }
        },
        "required": [ "title", "rating" ],
        "additionalProperties": false
    },
    "strict": true
}
```

2. Get the desired data

```
{
  "title": "Star Wars",
  "rating": 8.6
}
```

Start building more reliable applications. Check out the [docs](/developers/model-capabilities/text/structured-outputs) for more information.

### Released the new grok-2-1212 and grok-2-vision-1212 models

A month ago, we launched the public
beta of our enterprise API with grok-beta and grok-vision-beta. We’re adding [grok-2-1212 and
grok-2-vision-1212](/developers/models), offering better accuracy, instruction-following,
and multilingual capabilities.

## November 2024

### LangChain & xAI

Our API is now available through LangChain!

* Python Docs: https://python.langchain.com/integrations/providers/xai/
* Javascript Docs: https://js.langchain.com/integrations/chat/xai/

What are you going to build?

### API Public Beta

We are happy to announce the immediate availability of our API, which
gives developers programmatic access to our Grok series of foundation models. To get started, head
to [console.x.ai](https://console.x.ai/?utm_source=docs\&utm_medium=referral\&utm_campaign=developers-release-notes\&utm_content=console-home) and sign up to create an account. We are excited to see
what developers build using Grok.
