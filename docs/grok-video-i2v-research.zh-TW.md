# Grok影片 T2V/I2V 研究

日期：2026-05-30
分支：`feat/grok-video-i2v`

> 歷史快照：本研究記錄了2026年5月30日的上游表面。
> 對於當前預設值，請使用`config.ts`, `docs/API.md`，以及最新的xAI模型文檔。

## 官方的xAI視訊規格

檢查來源：

- https://docs.x.ai/developers/model-capabilities/video/generation
- https://docs.x.ai/developers/model-capabilities/video/image-to-video
- https://docs.x.ai/developers/model-capabilities/video/reference-to-video
- https://docs.x.ai/developers/rest-api-reference/inference/videos
- https://docs.x.ai/developers/models/grok-imagine-video

### 模型

|場地|價值|
|---|---|
|視訊模型| `grok-imagine-video` |
|地區| `us-east-1`, `eu-west-1` |
| API終點| `POST /v1/videos/generations` |
|投票端點| `GET /v1/videos/{request_id}` |
|結果|暫時的`.mp4` URL |

### 產生請求

```json
{
  "model": "grok-imagine-video",
  "prompt": "A concise video prompt",
  "duration": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p"
}
```

### 圖像轉視頻請求

```json
{
  "model": "grok-imagine-video",
  "prompt": "Animate the still image with a slow camera push-in",
  "image": { "url": "https://example.com/source.png" },
  "duration": 5,
  "resolution": "480p"
}
```

這`image`價值可以是公眾形象URL或 base64 資料 URI。對於 I2V，xAI
預設輸出為輸入影像的長寬比。供應`aspect_ratio`
覆蓋它並可以拉伸圖像。

### 視訊參考請求

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

參考影片限制：

- 非空`prompt`必需的
- 最多 7 張參考影像
- 最長持續時間 10 秒
- 不能與 I2V 結合使用`image`或在同一請求中進行影片編輯

### 民調回應

待辦的：

```json
{
  "status": "pending",
  "progress": 88
}
```

完畢：

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

要處理的狀態值：

- `pending`
- `done`
- `failed`
- `expired`

### 約束條件

|範圍|允許/行為|
|---|---|
| `duration` |T2V/I2V 1-15 秒|
| `duration`附有參考影像|1-10秒|
| `aspect_ratio` | `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `3:2`, `2:3` |
|預設寬高比| `16:9`對於 T2V，對於 I2V 來源影像比率|
| `resolution` | `480p`, `720p` |
|預設解析度| `480p` |
|影片編輯最大輸入|8.7秒|
|視訊擴充輸入|2-15秒|
|延長期限|2-10秒|
|產生的URL |暫時的;及時下載|

### 觀察/記錄的定價

模型頁文檔：

- 影像輸入：`$0.002`
- 視訊輸入/擴充輸入：`$0.01`每秒
- 發電輸出：
- `480p`: `$0.05`每秒
- `720p`: `$0.07`每秒

現場實驗使用：

- I2V 1s 480p 附影像輸入：`cost_in_usd_ticks = 520000000`
- T2V 1s 480p: `cost_in_usd_ticks = 500000000`

## 居住Progrok實驗

環境：

- progrok聆聽：`127.0.0.1:18645`
- 型號清單包括`grok-imagine-video`

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

結果：

- 請求編號：`5c5a7702-afbd-91e0-9535-3396f995cf5f`
- 地位：`done`
- 期間：`1`
- 下載的檔案：`/tmp/ima2-grok-video-e2e/i2v.mp4`
- ffprobe：H.264，`768x384`, `1.041667s`, `795537`位元組

觀察：

- I2V 輸出遵循來源影像比例，而不是正方形或預設值
16:9 比例因為`aspect_ratio`被省略了。

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

結果：

- 請求編號：`33200de3-7bc0-98b4-b66f-1d5510d17a57`
- 地位：`done`
- 期間：`1`
- 下載的檔案：`/tmp/ima2-grok-video-e2e/t2v.mp4`
- ffprobe：H.264，`480x480`, `1.041667s`, `93795`位元組

觀察：

- T2V可以保留`pending`以相同的進度值持續幾分鐘。
將輪詢作為一項長期運行的運行中作業來實現，而不是短暫的路由逾時。
