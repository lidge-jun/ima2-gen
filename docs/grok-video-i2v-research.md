# Grok Video T2V/I2V Research

Date: 2026-05-30
Branch: `feat/grok-video-i2v`

> Historical snapshot: this research records the 2026-05-30 upstream surface.
> For current defaults, use `config.ts`, `docs/API.md`, and the latest xAI model docs.

## Official xAI Video Spec

Sources checked:

- https://docs.x.ai/developers/model-capabilities/video/generation
- https://docs.x.ai/developers/model-capabilities/video/image-to-video
- https://docs.x.ai/developers/model-capabilities/video/reference-to-video
- https://docs.x.ai/developers/rest-api-reference/inference/videos
- https://docs.x.ai/developers/models/grok-imagine-video

### Model

| Field | Value |
|---|---|
| Video model | `grok-imagine-video` |
| Regions | `us-east-1`, `eu-west-1` |
| API endpoint | `POST /v1/videos/generations` |
| Poll endpoint | `GET /v1/videos/{request_id}` |
| Result | temporary `.mp4` URL |

### Generation Request

```json
{
  "model": "grok-imagine-video",
  "prompt": "A concise video prompt",
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

### Image-to-Video Request

```json
{
  "model": "grok-imagine-video",
  "prompt": "Animate the still image with a slow camera push-in",
  "image": { "url": "https://example.com/source.png" },
  "duration": 5,
  "resolution": "480p"
}
```

The `image` value can be a public image URL or a base64 data URI. For I2V, xAI
defaults the output to the input image's aspect ratio. Supplying `aspect_ratio`
overrides that and can stretch the image.

### Reference-to-Video Request

```json
{
  "model": "grok-imagine-video",
  "prompt": "Use <IMAGE_1> as the subject and <IMAGE_2> as wardrobe guidance",
  "reference_images": [
    { "url": "https://example.com/ref-1.png" },
    { "url": "https://example.com/ref-2.png" }
  ],
  "duration": 10,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

Reference-to-video constraints:

- non-empty `prompt` required
- maximum 7 reference images
- maximum duration 10 seconds
- cannot be combined with I2V `image` or video edit in the same request

### Poll Response

Pending:

```json
{
  "status": "pending",
  "progress": 88
}
```

Done:

```json
{
  "status": "done",
  "video": {
    "url": "https://vidgen.x.ai/.../video.mp4",
    "duration": 1,
    "respect_moderation": true
  },
  "model": "grok-imagine-video",
  "usage": {
    "cost_in_usd_ticks": 500000000
  },
  "progress": 100
}
```

Status values to handle:

- `pending`
- `done`
- `failed`
- `expired`

### Constraints

| Parameter | Allowed / behavior |
|---|---|
| `duration` | 1-15 seconds for T2V/I2V |
| `duration` with reference images | 1-10 seconds |
| `aspect_ratio` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` |
| default aspect ratio | `16:9` for T2V, source image ratio for I2V |
| `resolution` | `480p`, `720p` |
| default resolution | `480p` |
| video edit input max | 8.7 seconds |
| video extension input | 2-15 seconds |
| extension duration | 2-10 seconds |
| generated URL | temporary; download promptly |

### Pricing Observed / Documented

Model page documents:

- image input: `$0.002`
- video input/extension input: `$0.01` per second
- generation output:
  - `480p`: `$0.05` per second
  - `720p`: `$0.07` per second

Live experiment usage:

- I2V 1s 480p with image input: `cost_in_usd_ticks = 520000000`
- T2V 1s 480p: `cost_in_usd_ticks = 500000000`

## Live Progrok Experiments

Environment:

- progrok listening: `127.0.0.1:18645`
- model list includes `grok-imagine-video`

### I2V

Request:

```json
{
  "model": "grok-imagine-video",
  "prompt": "Animate this still image into a calm 1-second cinematic shot with a slow camera push-in and subtle star shimmer. Keep the composition stable.",
  "image": {
    "url": "https://docs.x.ai/assets/api-examples/video/milkyway-still.png"
  },
  "duration": 1,
  "resolution": "480p"
}
```

Result:

- request id: `5c5a7702-afbd-91e0-9535-3396f995cf5f`
- status: `done`
- duration: `1`
- downloaded file: `/tmp/ima2-grok-video-e2e/i2v.mp4`
- ffprobe: H.264, `768x384`, `1.041667s`, `795537` bytes

Observation:

- I2V output followed the source image ratio rather than a square or default
  16:9 ratio because `aspect_ratio` was omitted.

### T2V

Request:

```json
{
  "model": "grok-imagine-video",
  "prompt": "A 1-second clean product-style shot of a small glass cube rotating slowly on a white studio background.",
  "duration": 1,
  "aspect_ratio": "1:1",
  "resolution": "480p"
}
```

Result:

- request id: `33200de3-7bc0-98b4-b66f-1d5510d17a57`
- status: `done`
- duration: `1`
- downloaded file: `/tmp/ima2-grok-video-e2e/t2v.mp4`
- ffprobe: H.264, `480x480`, `1.041667s`, `93795` bytes

Observation:

- T2V can remain `pending` at the same progress value for several minutes.
  Implement polling as a long-running in-flight job, not a short route timeout.
