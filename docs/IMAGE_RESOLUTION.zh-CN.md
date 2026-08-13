# 图像分辨率（OAuth路径）——临时限制

OAuth (ChatGPT订阅 /Codex后端）图像生成具有后端强加的
决议行为。这是在这里记录的，因为它是**暂时限制
且未来方向未定**.

## 行为

- **宽高比**会完全按照要求的`size`处理。提示中带有一条
  指示（`You MUST generate this image at exactly WxH resolution as a TALL vertical
  PORTRAIT / WIDE horizontal LANDSCAPE / SQUARE canvas`），因此纵向／横向／正方形
  都会得到正确的方向。
- **总像素上限约为 157 万**(≈ 1024×1536) 由OAuth后端。 1K 预设
是准确的；较大的请求会保持纵横比，但会缩小。

|要求的`size` |实际的PNG (OAuth) |笔记|
|---|---|---|
|1024×1536（肖像）| 1024×1536 |精确的|
|1536×1024（横向）| 1536×1024 |精确的|
| 2048×1152 (16:9) | 1672×941 |保留纵横比，缩放至 ~1.57M|
|2048×2048（正方形）| 1254×1254 |保持纵横比，缩放|

## 如果您需要精确的大像素

使用**API-关键路径** (`/images/generations`, `gpt-image`— 任意分辨率
至 3840×2160）。这OAuth路径是自由的（ChatGPT订阅）但有像素上限。

> 由服务器验证`/api/generate`2026 年 6 月 27 日 E2E。
> **这是暂时的限制；未来的方向尚未确定。**
