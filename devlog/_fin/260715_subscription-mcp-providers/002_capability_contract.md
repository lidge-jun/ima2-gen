# 002 — ima2 MCP capability 계약

## 원칙

MCP tool 이름을 UI나 route가 직접 알지 않는다. adapter가 원격 tool schema를 아래 capability로 정규화한다. 지원 여부는 연결 시점 `tools/list`와 provider adapter 버전의 교집합이다.

## Capability map

| Capability | 최소 입력 | 표준 출력 | local fallback |
|---|---|---|---|
| `image.generate` | prompt, model?, size/ratio?, references? | image URL/bytes, model, upstream job id | 없음 |
| `image.edit` | prompt, source image, references/mask? | image URL/bytes | 기존 edit provider 또는 unsupported |
| `image.background.remove` | source image | alpha image | asset-gen local keying은 AI remover와 별도 capability |
| `image.upscale` | source image, target/mode? | image URL/bytes | 없음 |
| `image.vectorize` | source image | SVG URL/text | 없음 |
| `video.generate` | prompt, model?, duration?, ratio?, start/end/reference media? | video URL/bytes, job id | 없음 |
| `video.edit` | source video, prompt/settings | video URL/bytes | 기존 Grok V2V 가능 시 명시적 provider switch만 허용 |
| `video.extend.native` | source video, direction/target/prompt | combined or extension video | `video.continue.frame` |
| `video.continue.frame` | source video, prompt | child video + lineage | 기존 last-frame extraction→I2V |
| `video.stitch` | ordered clips, transition? | combined video | local ffmpeg concat; transition은 별도 지원 |
| `video.reframe` | source video, ratio, prompt? | reframed video | crop/resize와 generative expand를 구분 |
| `video.upscale` | source video, target resolution | video URL/bytes | 없음 |
| `video.caption` | source video, style/language | rendered video/project | local caption pipeline 없음 |
| `video.translate` | source video, target language/voice | translated video | 없음 |
| `media.history.list` | cursor/filter | provider asset refs | local history와 merge하지 않고 import action 제공 |
| `account.usage.read` | 없음 | credits/plan/limits | 없음 |

## 이어붙이기 용어 분리

- Native extend: 원본 영상 문맥을 provider가 읽고 앞/뒤 프레임을 생성해 자연스럽게 길이를 늘린다.
- Frame continuation: ima2가 마지막 프레임을 뽑아 새 I2V clip을 생성한다. 같은 shot처럼 보일 수 있지만 원본 전체 motion을 provider가 읽는 native extend와 다르다.
- Stitch/concat: 이미 존재하는 clip들을 순서대로 한 container로 합친다. AI 연장이 아니다.
- Multi-shot generation: provider가 한 요청에서 여러 shot을 생성한다. 기존 clip 합치기와 다르다.

UI copy와 metadata는 이 네 가지를 섞지 않는다.

## Provider 공개 근거별 현재 매핑

| Provider | 확정 capability | 인증 후 확인할 capability |
|---|---|---|
| Higgsfield | image/video generate, history, reframe, image/video upscale, character training | native extend, stitch, loop, exact tool names/params |
| Runway | image/video generate, reference inputs | AI edit, native extend, Workflow Stitch, Apps, task/cancel tool |
| Magnific | image/video generate, image edit/extend/upscale, video project/clip edit/upscale/relight, batch, video concat, usage/history | exact input schema, async/status/cancel, concat transition options |
| Krea | image/video generate, enhance/upscale, custom workflow | video edit/extend/reframe, tool names |
| Recraft | image generate/edit, background remove/replace, upscale, vectorize, style, usage | batch/async behavior |
| Ideogram | image generate/bulk/edit/reframe/background/upscale, collections, train | result retention/async/cancel |
| BFL FLUX | image generate/edit/multi-ref/style/inpaint/outpaint/variations, history, usage | live schema drift와 batch result 계약 |
| Pika experimental | image/video/audio generate/edit, video extend/re-cut/modify/trim/stitch/overlay/transition, captions/lip-sync | 안정성, billing, exact schema, retention/cancel; production capability는 기본 off |
| HeyGen | avatar/video-agent/template video, voices, lip-sync, translation, status/stop | ima2 generic video 설정과 HeyGen scene/avatar 계약의 손실 없는 교집합 |
| Rendley | project/timeline edit, trim/caption/transition/music/export | deterministic stitch tool vs natural-language agent tool 경계 |
| Canva | design generate/edit transaction, assets/templates/resize/export | MP4 export를 video generation/stitch로 오인하지 않는 product boundary; terms 승인 전 capability registry 미등록 |
| fal | model discovery/schema/pricing/run/async/status/cancel/upload | model별 capability는 runtime schema에서 파생 |
| Replicate | model discovery/run/prediction status | model별 capability는 runtime schema에서 파생 |

## Capability negotiation

1. MCP initialize가 성공한다.
2. `tools/list` 전체 페이지를 수집한다.
3. adapter는 필요한 tool 이름 후보와 `inputSchema` shape를 모두 검사한다.
4. 필수 field가 없거나 type이 바뀌면 capability를 unavailable로 내리고 diagnostic을 남긴다.
5. 이전 cache와 schema hash가 다르면 `schema_changed` 상태를 기록한다.
6. UI는 unavailable action을 호출하지 않는다.
7. server는 stale client가 보낸 요청도 capability guard에서 409/422로 거부한다.

### 활성화 검증 시나리오

- Tool rename: fixture에서 기존 tool을 제거하고 새 이름만 제공했을 때 capability가 false가 되고 upstream call이 0회인지 확인한다.
- Schema drift: required parameter type을 바꾼 fixture에서 provider가 `schema_changed`가 되는지 확인한다.
- Native extend 없음: `video.extend.native`가 false인 provider에서 사용자가 이어가기를 누르면 last-frame fallback 안내 후 `video.continue.frame`만 실행되는지 확인한다.
- Stitch 없음: local ffmpeg가 enabled인 경우에만 concat action을 노출하고, disabled 환경에서는 명확히 unavailable로 남는지 확인한다.
