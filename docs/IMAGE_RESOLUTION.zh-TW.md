# 影像解析度（OAuth路徑）——臨時限制

OAuth (ChatGPT訂閱 /Codex後端）影像生成具有後端強加的
決議行為。這是在這裡記錄的，因為它是**暫時限制
且未來方向未定**.

## 行為

- **縱橫比**會完全依照要求的`size`。提示中帶有一個
  指示（`You MUST generate this image at exactly WxH resolution as a TALL vertical
  PORTRAIT / WIDE horizontal LANDSCAPE / SQUARE canvas`），因此直向／橫向／正方形
  會得到正確的方向。
- **總像素上限約 157 萬**(≈ 1024×1536) 由OAuth後端。 1K 預設
是準確的；較大的請求會保持縱橫比，但會縮小。

|要求的`size` |實際的PNG (OAuth) |筆記|
|---|---|---|
|1024×1536（肖像）| 1024×1536 |精確的|
|1536×1024（橫向）| 1536×1024 |精確的|
| 2048×1152 (16:9) | 1672×941 |保留縱橫比，縮放至 ~1.57M|
|2048×2048（正方形）| 1254×1254 |保持縱橫比，縮放|

## 如果您需要精確的大像素

使用**API-關鍵路徑** (`/images/generations`, `gpt-image`— 任意分辨率
至 3840×2160）。這OAuth路徑是自由的（ChatGPT訂閱）但有像素上限。

> 由伺服器驗證`/api/generate`2026 年 6 月 27 日 E2E。
> **這是暫時的限制；未來的方向尚未確定。**
