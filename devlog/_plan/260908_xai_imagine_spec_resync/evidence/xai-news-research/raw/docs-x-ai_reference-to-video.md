#### Model Capabilities

# Reference-to-Video

Provide reference images, a preset voice, or both to guide the generated video. Images incorporate specific people, objects, clothing, or other visual elements without locking the first frame (unlike [image-to-video](/developers/model-capabilities/video/image-to-video)). This is useful for virtual try-on, product placement, character-consistent storytelling, and voice identity. On `grok-imagine-video-1.5`, you can also pick the voice your subject speaks in (see [Reference audio](#reference-audio)).

Each reference image can be provided as a public HTTPS URL, a base64-encoded data URI, or a `file_id` from the [Files API](/developers/files) — and you can mix kinds within a single request. See [Imagine → Files API Integration](/developers/model-capabilities/imagine/files/inputs) for `file_id` details and examples.

In the Vercel AI SDK, set `providerOptions.xai.mode` to `"reference-to-video"` and pass the images with `providerOptions.xai.referenceImageUrls`.

> [!WARNING]

```python customLanguage="pythonXAI"
import os
import xai_sdk

client = xai_sdk.Client(api_key=os.getenv("XAI_API_KEY"))

response = client.video.generate(
    prompt="slow zoom in on the white fashion runway stage. then, the model from <IMAGE_1> walks in from the back of the shot from the white opening, and gracefully walk out onto the front of the white stage platform. they wear the shirt from <IMAGE_2> and black flared jeans. they look dramatically at the camera. high quality slow motion shot. fun, playful. skin pores. highly detailed faces. perfect shot. they reach the end of the runway and look at the camera as the camera slowly zooms. subtle smile.",
    model="grok-imagine-video-1.5",
    reference_image_urls=[
        "<IMAGE_URL_1>",
        "<IMAGE_URL_2>",
        "<IMAGE_URL_3>",
    ],
    duration=10,
    aspect_ratio="16:9",
    resolution="720p",
)

print(response.url)
```

```python customLanguage="pythonRequests"
import os
import time
import requests

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
}

response = requests.post(
    "https://api.x.ai/v1/videos/generations",
    headers=headers,
    json={
        "model": "grok-imagine-video-1.5",
        "prompt": "slow zoom in on the white fashion runway stage. then, the model from <IMAGE_1> walks in from the back of the shot from the white opening, and gracefully walk out onto the front of the white stage platform. they wear the shirt from <IMAGE_2> and black flared jeans. they look dramatically at the camera. high quality slow motion shot. fun, playful. skin pores. highly detailed faces. perfect shot. they reach the end of the runway and look at the camera as the camera slowly zooms. subtle smile.",
        "reference_images": [
            {"url": "<IMAGE_URL_1>"},
            {"url": "<IMAGE_URL_2>"},
            {"url": "<IMAGE_URL_3>"},
        ],
        "duration": 10,
        "aspect_ratio": "16:9",
        "resolution": "720p",
    },
)

request_id = response.json()["request_id"]

while True:
    result = requests.get(
        f"https://api.x.ai/v1/videos/{request_id}",
        headers={"Authorization": headers["Authorization"]},
    )
    data = result.json()
    if data["status"] == "done":
        print(data["video"]["url"])
        break
    elif data["status"] == "expired":
        print("Request expired")
        break
    time.sleep(5)
```

```javascript customLanguage="javascriptAISDK"
import { xai } from "@ai-sdk/xai";
import { experimental_generateVideo as generateVideo } from "ai";

const result = await generateVideo({
    model: xai.video("grok-imagine-video-1.5"),
    prompt: "slow zoom in on the white fashion runway stage. then, the model from <IMAGE_1> walks in from the back of the shot from the white opening, and gracefully walk out onto the front of the white stage platform. they wear the shirt from <IMAGE_2> and black flared jeans. they look dramatically at the camera. high quality slow motion shot. fun, playful. skin pores. highly detailed faces. perfect shot. they reach the end of the runway and look at the camera as the camera slowly zooms. subtle smile.",
    duration: 10,
    aspectRatio: "16:9",
    providerOptions: {
        xai: {
            mode: "reference-to-video",
            referenceImageUrls: [
                "<IMAGE_URL_1>",
                "<IMAGE_URL_2>",
                "<IMAGE_URL_3>",
            ],
            resolution: "720p",
            pollTimeoutMs: 600000,
        },
    },
});

const videoUrl = result.providerMetadata?.xai?.videoUrl;
console.log(videoUrl);
```

```bash
# Start the reference-to-video request
REQUEST_ID=$(curl -s -X POST https://api.x.ai/v1/videos/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-video-1.5",
    "prompt": "slow zoom in on the white fashion runway stage. then, the model from <IMAGE_1> walks in from the back of the shot from the white opening, and gracefully walk out onto the front of the white stage platform. they wear the shirt from <IMAGE_2> and black flared jeans. they look dramatically at the camera. high quality slow motion shot. fun, playful. skin pores. highly detailed faces. perfect shot. they reach the end of the runway and look at the camera as the camera slowly zooms. subtle smile.",
    "reference_images": [
      {"url": "<IMAGE_URL_1>"},
      {"url": "<IMAGE_URL_2>"},
      {"url": "<IMAGE_URL_3>"}
    ],
    "duration": 10,
    "aspect_ratio": "16:9",
    "resolution": "720p"
  }' | jq -r '.request_id')

# Poll until the video is ready
while true; do
  RESULT=$(curl -s https://api.x.ai/v1/videos/$REQUEST_ID \
    -H "Authorization: Bearer $XAI_API_KEY")
  STATUS=$(echo "$RESULT" | jq -r '.status')
  if [ "$STATUS" = "done" ]; then
    echo "$RESULT" | jq -r '.video.url'
    break
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "expired" ]; then
    echo "Request $STATUS"; echo "$RESULT" | jq .
    break
  fi
  sleep 5
done
```

## Reference audio

> [!WARNING]
>
> Preset voices are generally available. Voice references with your own audio files are available to trusted partners, on request. .

On `grok-imagine-video-1.5`, give your subject a voice by passing up to **3** preset voices with `reference_audios`. Each entry names a voice by `voice_id`, drawn from the same built-in roster as [Text to Speech](/developers/model-capabilities/audio/text-to-speech#voices), so `{"voice_id": "eve"}` speaks in Eve's voice. Identifiers are case-insensitive; an unknown one returns `400` with the list of available voices. You can hear every voice in the [flagship voices announcement](https://x.ai/news/new-flagship-voices).

`reference_audios` accepts preset voices; voice references with your own audio files are available to trusted partners [on request](https://x.ai/contact-sales?interest=imagine). Use a voice alongside reference images or on its own, and tag voices in the prompt as `<AUDIO_0>`, `<AUDIO_1>`, and `<AUDIO_2>` (with `<IMAGE_0>`… when you also pass images).

```python customLanguage="pythonXAI"
import os
import xai_sdk

client = xai_sdk.Client(api_key=os.getenv("XAI_API_KEY"))

response = client.video.generate(
    prompt="The person from <IMAGE_1> presents the product from <IMAGE_2> on the set from <IMAGE_3>, speaking with the voice from <AUDIO_0>. A second speaker with the voice from <AUDIO_1> replies.",
    model="grok-imagine-video-1.5",
    reference_image_urls=[
        "<IMAGE_URL_1>",
        "<IMAGE_URL_2>",
        "<IMAGE_URL_3>",
    ],
    reference_audios=[
        {"voice_id": "eve"},
        {"voice_id": "leo"},
    ],
    duration=8,
    aspect_ratio="9:16",
    resolution="720p",
)

print(response.url)
```

```python customLanguage="pythonRequests"
import os
import time
import requests

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ['XAI_API_KEY']}",
}

response = requests.post(
    "https://api.x.ai/v1/videos/generations",
    headers=headers,
    json={
        "model": "grok-imagine-video-1.5",
        "prompt": "The person from <IMAGE_1> presents the product from <IMAGE_2> on the set from <IMAGE_3>, speaking with the voice from <AUDIO_0>. A second speaker with the voice from <AUDIO_1> replies.",
        "reference_images": [
            {"url": "<IMAGE_URL_1>"},
            {"url": "<IMAGE_URL_2>"},
            {"url": "<IMAGE_URL_3>"},
        ],
        "reference_audios": [
            {"voice_id": "eve"},
            {"voice_id": "leo"},
        ],
        "duration": 8,
        "aspect_ratio": "9:16",
        "resolution": "720p",
    },
)

request_id = response.json()["request_id"]

while True:
    result = requests.get(
        f"https://api.x.ai/v1/videos/{request_id}",
        headers={"Authorization": headers["Authorization"]},
    )
    data = result.json()
    if data["status"] == "done":
        print(data["video"]["url"])
        break
    elif data["status"] == "expired":
        print("Request expired")
        break
    time.sleep(5)
```

```bash
REQUEST_ID=$(curl -s -X POST https://api.x.ai/v1/videos/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -d '{
    "model": "grok-imagine-video-1.5",
    "prompt": "The person from <IMAGE_1> presents the product from <IMAGE_2> on the set from <IMAGE_3>, speaking with the voice from <AUDIO_0>. A second speaker with the voice from <AUDIO_1> replies.",
    "reference_images": [
      {"url": "<IMAGE_URL_1>"},
      {"url": "<IMAGE_URL_2>"},
      {"url": "<IMAGE_URL_3>"}
    ],
    "reference_audios": [
      {"voice_id": "eve"},
      {"voice_id": "leo"}
    ],
    "duration": 8,
    "aspect_ratio": "9:16",
    "resolution": "720p"
  }' | jq -r '.request_id')

while true; do
  RESULT=$(curl -s https://api.x.ai/v1/videos/$REQUEST_ID \
    -H "Authorization: Bearer $XAI_API_KEY")
  STATUS=$(echo "$RESULT" | jq -r '.status')
  if [ "$STATUS" = "done" ]; then
    echo "$RESULT" | jq -r '.video.url'
    break
  elif [ "$STATUS" = "failed" ] || [ "$STATUS" = "expired" ]; then
    echo "Request $STATUS"; echo "$RESULT" | jq .
    break
  fi
  sleep 5
done
```

## Related

* [Video Generation](/developers/model-capabilities/video/generation) — Generate videos from text prompts
* [Image-to-Video](/developers/model-capabilities/video/image-to-video) — Animate a still image
* [Video Editing](/developers/model-capabilities/video/editing) — Edit existing videos
* [API Reference](/developers/rest-api-reference) — Full endpoint documentation
* [Imagine API Landing Page](https://x.ai/api/imagine) — Showcase of the Imagine API in action
