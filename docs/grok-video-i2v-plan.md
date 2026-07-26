# Grok Video T2V/I2V Implementation Plan

Date: 2026-05-30
Branch: `feat/grok-video-i2v`

> Historical snapshot: this plan records the 2026-05-30 implementation target.
> The current runtime defaults are `grok-4.5` for planning and
> `grok-imagine-video-1.5` for video generation; see `config.ts` and `docs/API.md`.

## Goal

Add Grok video generation to ima2-gen as a first-class generation surface beside
`grok` and `grok+`.

Supported modes:

- **T2V**: text prompt -> video
- **I2V**: current image / selected asset / node image + prompt -> video

The video prompt must go through the same Grok planning layer as current Grok
image generation:

1. xAI Web Search through `/v1/responses`
2. `grok-4.3` planner call with a forced local tool
3. server executes xAI `/v1/videos/generations`
4. server polls `/v1/videos/{request_id}`
5. server downloads and persists the completed `.mp4`

Do not send raw user prompts directly to the video endpoint from product flows.

## Screenshot Analysis

User-provided screenshot:

- The visible layer is a generated image result action row.
- Current actions: download, copy image, copy prompt, continue here, first node,
  expand/open, delete, more.
- The natural placement for video is the same artifact action layer:
  **Video / Animate** should live beside `Continue Here` and `First Node`, not in
  a detached settings-only surface.

## Research Summary

Full official-spec notes and live progrok request/response logs are in:

`docs/grok-video-i2v-research.md`

Implementation facts from the research:

- model: `grok-imagine-video`
- endpoint: `POST /v1/videos/generations`
- poll endpoint: `GET /v1/videos/{request_id}`
- T2V and I2V both work through progrok at `127.0.0.1:18645`
- I2V accepts `image.url` and follows source image ratio when `aspect_ratio`
  is omitted
- resolution v1 scope: `480p` and `720p`
- duration v1 scope: 1-15 seconds for T2V/I2V
- poll statuses to handle: `pending`, `done`, `failed`, `expired`
- completed video URLs are temporary and must be downloaded into local history

## Product Integration

### UI Placement

Add video actions at the artifact action layer shown in the screenshot:

- `Video` / `Animate` button beside `Continue Here`
- For image result cards: default mode is I2V using that image as source
- For prompt-only composer: allow T2V from a video mode dropdown or segmented
  control in the same provider/model layer as `grok` and `grok+`
- For Node Mode: node result action -> Animate node
- For Agent Mode: current image action -> Animate, plus Agent tool
  `ima2.generate_video`

### Provider / Model Layer

Keep the model layer parallel to current image models:

| UI label | model | mode |
|---|---|---|
| `grok` | `grok-imagine-image` | image |
| `grok+` | `grok-imagine-image-quality` | image |
| `video` | `grok-imagine-video` | video |

Video generation still uses `provider: "grok"` because progrok is the runtime.
Do not create a separate provider named `video`.

Do not add `grok-imagine-video` to image model unions or image model helpers.
The current image helpers classify `grok-` prefixed strings as image models, so
video needs a separate generation kind:

- `provider: "grok"`
- `generationKind: "image" | "video"`
- `GrokImageModel = "grok-imagine-image" | "grok-imagine-image-quality"`
- `GrokVideoModel = "grok-imagine-video"`

### Prompt Pipeline

Use a new planner tool rather than direct video endpoint prompts:

Tool name: `generate_video`

Planner args:

```json
{
  "prompt": "English final video prompt",
  "model": "grok-imagine-video",
  "mode": "text-to-video",
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "480p"
}
```

For I2V:

```json
{
  "prompt": "English final video prompt",
  "model": "grok-imagine-video",
  "mode": "image-to-video",
  "duration": 5,
  "resolution": "480p"
}
```

Prompt requirements:

- final video prompt must be English
- preserve explicitly requested visible text verbatim
- include motion/camera/action guidance
- include continuity constraints for I2V:
  - preserve subject identity
  - preserve composition unless asked otherwise
  - use source image as first frame / starting point

Product policy:

- Always run the Grok planner for product flows, even though upstream I2V can
  technically omit `prompt`.
- The planner may refine `prompt` and infer `mode`, but UI/request settings win
  for `duration`, `resolution`, and `aspect_ratio`.
- Always send explicit `duration`; do not rely on upstream defaults.
- In I2V, include the source image in the planner vision payload so the planner
  can write continuity constraints from the actual image.
- Keep web search mandatory for v1 parity with existing Grok image behavior.
  A future optimization can skip search for pure local I2V animation.

## Backend Implementation Plan

### Phase 1: Types / Config / Capabilities

Files:

- `config.ts`
- `lib/imageModels.ts`
- `ui/src/lib/imageModels.ts`
- `ui/src/types.ts`
- `routes/capabilities.ts`

Add:

- `grokProvider.defaultVideoModel = "grok-imagine-video"`
- `grokProvider.videoPollIntervalMs = 5_000`
- `grokProvider.videoTimeoutMs = 900_000`
- `grokProvider.videoDownloadTimeoutMs = 120_000`
- `VideoModel = "grok-imagine-video"`
- `VideoDuration = 1..15`
- `VideoResolution = "480p" | "720p"`
- `VideoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "auto"`
- separate `GrokVideoModel` / `isGrokVideoModel()` helpers
- do not extend `VALID_GROK_IMAGE_MODELS` with video

### Phase 2: Grok Video Adapter

New file:

- `lib/grokVideoAdapter.ts`

Responsibilities:

- run search + `grok-4.3` planner with forced `generate_video`
- build `/v1/videos/generations` payload
- validate T2V/I2V/reference-to-video mutually exclusive modes
- start async request and receive `request_id`
- poll `/v1/videos/{request_id}`
- download final mp4
- return `{ videoB64? | videoBuffer, url, duration, usage, revisedPrompt, requestId }`

Polling contract:

- use a short start-request timeout separately from the total poll budget
- total poll budget defaults to 15 minutes
- polling interval defaults to 5 seconds
- unchanged progress for several minutes should emit a warning/progress event,
  not an error
- client cancellation stops local polling and marks the inflight job canceled;
  xAI may continue processing the upstream job
- normalize names as `clientRequestId` and `xaiVideoRequestId`

Error codes:

| Code | Meaning |
|---|---|
| `GROK_VIDEO_REQUEST_FAILED` | non-2xx start response |
| `GROK_VIDEO_POLL_FAILED` | non-2xx poll response |
| `GROK_VIDEO_FAILED` | status `failed` |
| `GROK_VIDEO_EXPIRED` | status `expired` |
| `GROK_VIDEO_TIMEOUT` | poll budget exceeded |
| `GROK_VIDEO_EMPTY_RESPONSE` | done without video URL |
| `GROK_VIDEO_MODERATION_BLOCKED` | done but `respect_moderation` is false or URL is suppressed |
| `GROK_VIDEO_DOWNLOAD_FAILED` | mp4 download failed |
| `GROK_VIDEO_INVALID_MODE` | mixed image/reference/video modes |
| `GROK_VIDEO_REF_TOO_MANY` | reference-to-video over 7 refs |

xAI `failed.error.code` mapping:

| xAI code | ima2 code / response |
|---|---|
| `invalid_argument` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 400 |
| `permission_denied` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 403 |
| `failed_precondition` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 412 |
| `service_unavailable` | `GROK_VIDEO_POLL_FAILED`, HTTP 502 with retry hint |
| `internal_error` | `GROK_VIDEO_FAILED`, HTTP 502 |

### Phase 3: Storage / History

Add video artifact storage:

- write `.mp4` to generated dir
- write `.mp4.json` sidecar
- add `mediaType: "image" | "video"` metadata
- add `video.duration`, `video.resolution`, `video.aspectRatio`, `sourceImageId`
- gallery/history payload should include enough data to render video cards
- update history scanning to include `.mp4`
- use sidecar metadata for video; do not attempt image XMP embedding
- optionally add a poster thumbnail later, but v1 can render `<video controls>`

Do not rely on xAI temporary URLs for app history.

History row additions:

```ts
type GeneratedMediaItem = {
  mediaType: "image" | "video";
  url: string;
  video?: {
    duration: number | null;
    resolution: "480p" | "720p";
    aspectRatio: VideoAspectRatio;
    sourceImageFilename?: string;
    xaiVideoRequestId?: string;
  };
};
```

### Phase 4: API Routes

New route:

- `POST /api/video/generate`

Body:

```json
{
  "prompt": "animate this image",
  "provider": "grok",
  "model": "grok-imagine-video",
  "mode": "image-to-video",
  "sourceImage": "data:image/png;base64,...",
  "sourceFilename": "optional existing generated file",
  "duration": 5,
  "aspectRatio": "auto",
  "resolution": "480p",
  "clientRequestId": "client-id"
}
```

Response should use SSE for long-running progress:

- `phase: planning`
- `phase: submitted` with `xaiVideoRequestId`
- `progress` with poll progress
- `done` with local mp4 artifact
- `error` with normalized error code

Inflight mapping:

| SSE phase | inflight phase | Meaning |
|---|---|---|
| `planning` | `planning` | web search + `grok-4.3` planner |
| `submitted` | `submitted` | xAI accepted job and returned request id |
| `progress` | `polling` | async video rendering progress |
| `done` | `decoding` -> terminal | download/write local mp4 |
| `error` | terminal | normalized error |

### Phase 5: Node Mode

Use cases:

- Animate selected node
- Animate current/generated image result into video
- Save resulting video as an artifact linked to the node/session

Contract:

- v1 does not mutate node graph schema into video nodes
- parent/current node image becomes `image` for I2V
- prompt goes through `grok-4.3` video planner
- result becomes a video artifact linked to the session/history
- node toolbar shows an `Animate` icon/action when `d.imageUrl` exists
- a later v2 can add `videoUrl` / `mediaKind` to node data if video nodes are needed

### Phase 6: Agent Mode

Add tool:

- `ima2.generate_video`

Agent behavior:

- if current image exists: default I2V
- if no current image: T2V
- tool turn should display video generation progress
- completed video appears in chat artifact list and right image/video pane

Agent contract:

- extend allowed tools with `ima2.generate_video`
- tool args: `{ prompt, mode?, duration?, resolution?, aspectRatio? }`
- runtime auto-selects I2V when a current image artifact exists
- add video artifact ids or generic media artifact ids to queue/tool summaries
- capabilities should report final artifacts as mixed image/video, not image-only
- Agent UI should show the same progress phases as `/api/video/generate`

### Phase 7: UI

Components to touch:

- result action row
- `ResultActions`
- history/gallery cards
- Node canvas selected node toolbar
- Agent tool folding and artifact pane
- right panel model/provider controls

UX:

- `grok`, `grok+`, `video` live in the same model/provider layer
- internally, video is a generation kind, not an image model
- video settings are compact:
  - duration stepper/select
  - resolution segmented control
  - aspect ratio dropdown
  - source mode badge: T2V / I2V / Reference
- video generation shows real async progress
- generated video card has play/download/copy prompt/continue actions
- image result cards get an `Animate` action beside `Continue Here`
- Node Mode gets an icon-only `Animate` action in the selected node toolbar
- Agent image pane gets a header `Animate` action for the current image

### Phase 8: Tests

Add contract tests before implementation:

- adapter builds T2V payload
- adapter builds I2V payload with `image`
- adapter rejects mixed `image` + `reference_images`
- adapter polls pending -> done
- adapter handles failed/expired/timeout
- route streams progress and done
- route saves `.mp4` + sidecar
- history scanner includes `.mp4` video rows
- moderation-suppressed done responses map to `GROK_VIDEO_MODERATION_BLOCKED`
- failed poll `error.code` maps to normalized error codes
- UI/request settings override planner duration/resolution/aspect fields
- inflight `kind=video` phase transitions are recorded
- Node action sends parent image as I2V source
- Agent tool turn includes `ima2.generate_video`
- UI exposes `video` alongside `grok` / `grok+`
- no `partial` image event assumptions leak into video path

### Phase 9: E2E

Use progrok live smoke only after contract tests pass:

- T2V 1 second, 480p
- I2V 1 second, 480p, generated image source
- UI action from result card
- Node action from node result
- Agent action from current image

## Open Decisions

1. Label: `video`, `grok video`, or `animate`
   - Recommended: `Video` in model/provider layer, `Animate` on image cards.

2. Default duration
   - Recommended: 5 seconds in UI, 1 second in tests/smokes.

3. Default resolution
   - Recommended: 480p to control cost and speed; allow 720p.

4. I2V aspect ratio
   - Recommended: `auto` by default so source image ratio is preserved.

5. Reference-to-video v1
   - Recommended: defer from first implementation unless references already
     exist in the selected context. T2V/I2V are required; reference-to-video can
     share adapter primitives.

## Verification Already Completed

- Branch created: `feat/grok-video-i2v`
- xAI docs reviewed
- progrok model list includes `grok-imagine-video`
- I2V live request succeeded
- T2V live request succeeded
- Both mp4 files downloaded and inspected with `ffprobe`
- Ryo backend review: NEEDS_FIX before implementation; fixes incorporated above
- Nijika frontend review: NEEDS_FIX before implementation; fixes incorporated above
