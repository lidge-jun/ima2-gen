# Grok视频 T2V/I2V 研究

日期：2026-05-30
分支：`feat/grok-video-i2v`

> 历史快照：本研究记录了2026年5月30日的上游表面。
> 对于当前默认值，请使用`config.ts`, `docs/API.md`，以及最新的xAI模型文档。

## 官方的xAI视频规格

检查来源：

- https://docs.x.ai/developers/model-capabilities/video/generation
- https://docs.x.ai/developers/model-capabilities/video/image-to-video
- https://docs.x.ai/developers/model-capabilities/video/reference-to-video
- https://docs.x.ai/developers/rest-api-reference/inference/videos
- https://docs.x.ai/developers/models/grok-imagine-video

### 模型

|场地|价值|
|---|---|
|视频模型| `grok-imagine-video` |
|地区| `us-east-1`, `eu-west-1` |
| API终点| `POST /v1/videos/generations` |
|投票端点| `GET /v1/videos/{request_id}` |
|结果|暂时的`.mp4` URL |

### 生成请求

```json
{
  "model": "grok-imagine-video",
  "prompt": "A concise video prompt",
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

### 图像转视频请求

```json
{
  "model": "grok-imagine-video",
  "prompt": "Animate the still image with a slow camera push-in",
  "image": { "url": "https://example.com/source.png" },
  "duration": 5,
  "resolution": "480p"
}
```

这`image`价值可以是公众形象URL或 base64 数据 URI。对于 I2V，xAI
默认输出为输入图像的长宽比。供应`aspect_ratio`
覆盖它并可以拉伸图像。

### 视频参考请求

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

参考视频限制：

- 非空`prompt`必需的
- 最多 7 张参考图像
- 最长持续时间 10 秒
- 不能与 I2V 结合使用`image`或在同一请求中进行视频编辑

### 民意调查回应

待办的：

```json
{
  "status": "pending",
  "progress": 88
}
```

完毕：

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

要处理的状态值：

- `pending`
- `done`
- `failed`
- `expired`

### 约束条件

|范围|允许/行为|
|---|---|
| `duration` |T2V/I2V 1-15 秒|
| `duration`带有参考图像|1-10秒|
| `aspect_ratio` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` |
|默认宽高比| `16:9`对于 T2V，对于 I2V 源图像比率|
| `resolution` | `480p`, `720p` |
|默认分辨率| `480p` |
|视频编辑最大输入|8.7秒|
|视频扩展输入|2-15秒|
|延长期限|2-10秒|
|生成的URL |暂时的;及时下载|

### 观察/记录的定价

模型页面文档：

- 图像输入：`$0.002`
- 视频输入/扩展输入：`$0.01`每秒
- 发电输出：
- `480p`: `$0.05`每秒
- `720p`: `$0.07`每秒

现场实验使用：

- I2V 1s 480p 带图像输入：`cost_in_usd_ticks = 520000000`
- T2V 1s 480p: `cost_in_usd_ticks = 500000000`

## 居住Progrok实验

环境：

- progrok聆听：`127.0.0.1:18645`
- 型号列表包括`grok-imagine-video`

### I2V

要求：

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

结果：

- 请求编号：`5c5a7702-afbd-91e0-9535-3396f995cf5f`
- 地位：`done`
- 期间：`1`
- 下载的文件：`/tmp/ima2-grok-video-e2e/i2v.mp4`
- ffprobe：H.264，`768x384`, `1.041667s`, `795537`字节

观察：

- I2V 输出遵循源图像比例，而不是正方形或默认值
16:9 比例因为`aspect_ratio`被省略了。

### T2V

要求：

```json
{
  "model": "grok-imagine-video",
  "prompt": "A 1-second clean product-style shot of a small glass cube rotating slowly on a white studio background.",
  "duration": 1,
  "aspect_ratio": "1:1",
  "resolution": "480p"
}
```

结果：

- 请求编号：`33200de3-7bc0-98b4-b66f-1d5510d17a57`
- 地位：`done`
- 期间：`1`
- 下载的文件：`/tmp/ima2-grok-video-e2e/t2v.mp4`
- ffprobe：H.264，`480x480`, `1.041667s`, `93795`字节

观察：

- T2V可以保留`pending`以相同的进度值持续几分钟。
将轮询作为一项长期运行的运行中作业来实现，而不是短暂的路由超时。
