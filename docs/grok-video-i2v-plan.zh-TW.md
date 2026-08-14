# Grok視訊T2V/I2V實施方案

日期：2026-05-30
分支：`feat/grok-video-i2v`

> 歷史快照：本計畫記錄了2026年5月30日的實施目標。
> 當前運行時預設值是`grok-4.5`用於規劃和
> `grok-imagine-video-1.5`用於視頻生成；看`config.ts`和`docs/API.md`.

## 目標

添加Grok影片生成到ima2-gen作為一流的一代表面
`grok`和`grok+`.

支援的模式：

- **T2V**：文字提示->視頻
- **I2V**：目前圖片/所選資產/節點圖片+提示->視頻

影片提示必須經過相同的Grok計劃層作為當前層Grok
影像生成：

1. xAI網頁搜尋透過`/v1/responses`
2. `grok-4.3`使用強製本地工具進行規劃器調用
3. 伺服器執行xAI `/v1/videos/generations`
4. 伺服器輪詢`/v1/videos/{request_id}`
5. 伺服器下載並儲存已完成的內容`.mp4`

不要將原始使用者提示從產品流直接傳送到視訊端點。

## 截圖分析

用戶提供的截圖：

- 可見層是產生的影像結果操作行。
- 目前操作：下載、複製圖像、複製提示、在此處繼續、第一個節點、
展開/打開、刪除等等。
- 影片的自然放置是相同的工件動作層：
**影片/動畫**應該住在旁邊`Continue Here`和`First Node`，不在
一個獨立的僅設置表面。

## 研究總結

完整的官方規格說明和現場progrok請求/回應日誌位於：

`docs/grok-video-i2v-research.md`

研究的實施事實：

- 模型：`grok-imagine-video`
- 端點：`POST /v1/videos/generations`
- 輪詢端點：`GET /v1/videos/{request_id}`
- T2V 和 I2V 皆透過progrok在`127.0.0.1:18645`
- I2V接受`image.url`並遵循來源影像比例`aspect_ratio`
被省略
- 決議 v1 範圍：`480p`和`720p`
- 持續時間 v1 範圍：T2V/I2V 1-15 秒
- 輪詢狀態來處理：`pending`, `done`, `failed`, `expired`
- 完成的影片 URL 是臨時的，必須下載到本地歷史記錄中

## 產品整合

### UI放置

在螢幕截圖所示的工件動作圖層中新增影片動作：

- `Video` / `Animate`旁邊的按鈕`Continue Here`
- 對於影像結果卡：預設模式是 I2V，使用該影像作為來源
- 對於僅提示的作曲家：允許來自視訊模式下拉清單或分段的 T2V
控制在相同的提供者/模型層`grok`和`grok+`
- 對於節點模式：節點結果操作 -> 動畫節點
- 對於代理模式：當前圖像動作 -> 動畫，加上代理工具
`ima2.generate_video`

### 提供者/模型層

保持模型圖層與目前影像模型平行：

| UI標籤|模型|模式|
|---|---|---|
| `grok` | `grok-imagine-image` |影像|
| `grok+` | `grok-imagine-image-quality` |影像|
| `video` | `grok-imagine-video` |影片|

視訊生成仍然使用`provider: "grok"`因為progrok是運行時間。
不要建立名為`video`.

請勿添加`grok-imagine-video`影像模型聯合或影像模型助手。
目前影像助手分類`grok-`帶有前綴的字串作為圖像模型，所以
影片需要單獨的生成類型：

- `provider: "grok"`
- `generationKind: "image" | "video"`
- `GrokImageModel = "grok-imagine-image" | "grok-imagine-image-quality"`
- `GrokVideoModel = "grok-imagine-video"`

### 即時管道

使用新的規劃工具而不是直接的視訊端點提示：

工具名稱：`generate_video`

計劃參數：

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

對於 I2V：

```json
{
  "prompt": "English final video prompt",
  "model": "grok-imagine-video",
  "mode": "image-to-video",
  "duration": 5,
  "resolution": "480p"
}
```

提示要求：

- 最終影片提示必須是英文
- 逐字保留明確要求的可見文本
- 包括運動/相機/動作指導
- 包括 I2V 的連續性約束：
- 保留主體身份
- 除非另有要求，否則保留成分
- 使用來源影像作為第一個畫面/起點

產品政策：

- 始終運行Grok產品流規劃器，即使上游 I2V 可以
技術上省略`prompt`.
- 規劃者可以細化`prompt`並推斷`mode`， 但UI/請求設定 win
為了`duration`, `resolution`， 和`aspect_ratio`.
- 始終發送明確的`duration`;不要依賴上游預設值。
- 在 I2V 中，將來源影像包含在規劃器視覺負載中，以便規劃器
可以寫出實際影像的連續性約束。
- 保持網路搜尋強制 v1 與現有版本一致Grok形象行為。
未來的優化可以跳過對純本地 I2V 動畫的搜尋。

## 後端實施方案

### 第一階段：類型/配置/功能

文件：

- `config.ts`
- `lib/imageModels.ts`
- `ui/src/lib/imageModels.ts`
- `ui/src/types.ts`
- `routes/capabilities.ts`

添加：

- `grokProvider.defaultVideoModel = "grok-imagine-video"`
- `grokProvider.videoPollIntervalMs = 5_000`
- `grokProvider.videoTimeoutMs = 900_000`
- `grokProvider.videoDownloadTimeoutMs = 120_000`
- `VideoModel = "grok-imagine-video"`
- `VideoDuration = 1..15`
- `VideoResolution = "480p" | "720p"`
- `VideoAspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3" | "auto"`
- 分離`GrokVideoModel` / `isGrokVideoModel()`幫手
- 不延長`VALID_GROK_IMAGE_MODELS`有視頻

### 第二階段：Grok視訊適配器

新文件：

- `lib/grokVideoAdapter.ts`

職責：

- 運行搜尋 +`grok-4.3`計劃者被迫`generate_video`
- 建造`/v1/videos/generations`有效負載
- 驗證 T2V/I2V/參考視訊互斥模式
- 啟動非同步請求並接收`request_id`
- 輪詢`/v1/videos/{request_id}`
- 下載最終mp4
- 返回`{ videoB64? | videoBuffer, url, duration, usage, revisedPrompt, requestId }`

投票合約：

- 與總輪詢預算分開使用較短的啟動請求逾時
- 總投票預算預設為 15 分鐘
- 輪詢間隔預設為 5 秒
- 幾分鐘內未更改的進度應發出警告/進度事件，
不是錯誤
- 用戶端取消會停止本機輪詢並標記正在進行的作業已取消；
xAI可以繼續處理上游作業
- 將名稱規範化為`clientRequestId`和`xaiVideoRequestId`

錯誤代碼：

|程式碼|意義|
|---|---|
| `GROK_VIDEO_REQUEST_FAILED` |非 2xx 啟動回應|
| `GROK_VIDEO_POLL_FAILED` |非 2xx 輪詢回應|
| `GROK_VIDEO_FAILED` |地位`failed` |
| `GROK_VIDEO_EXPIRED` |地位`expired` |
| `GROK_VIDEO_TIMEOUT` |投票預算超出|
| `GROK_VIDEO_EMPTY_RESPONSE` |沒有影片就完成了URL |
| `GROK_VIDEO_MODERATION_BLOCKED` |完成了但是`respect_moderation`是假的或者URL被壓制|
| `GROK_VIDEO_DOWNLOAD_FAILED` |mp4 下載失敗|
| `GROK_VIDEO_INVALID_MODE` |混合影像/參考/視訊模式|
| `GROK_VIDEO_REF_TOO_MANY` |影片參考超過 7 條|

xAI `failed.error.code`映射：

| xAI程式碼| ima2代碼/回應|
|---|---|
| `invalid_argument` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 400 |
| `permission_denied` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 403 |
| `failed_precondition` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 412 |
| `service_unavailable` | `GROK_VIDEO_POLL_FAILED`, HTTP502 帶重試提示|
| `internal_error` | `GROK_VIDEO_FAILED`, HTTP 502 |

### 第三階段：儲存/歷史

新增視訊工件儲存：

- 寫`.mp4`到生成的目錄
- 寫`.mp4.json`邊車
- 添加`mediaType: "image" | "video"`元數據
- 添加`video.duration`, `video.resolution`, `video.aspectRatio`, `sourceImageId`
- 圖庫/歷史有效負載應包含足夠的資料來渲染視訊卡
- 更新歷史掃描以包括`.mp4`
- 使用影片的 sidecar 元資料；不要嘗試影像 XMP 嵌入
- 稍後可以選擇新增海報縮圖，但 v1 可以渲染`<video controls>`

不要依賴xAI應用程式歷史記錄的臨時 URL。

歷史行新增：

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

### 第四階段：API路線

新路線：

- `POST /api/video/generate`

身體:

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

響應應該使用SSE對於長期運作的進展：

- `phase: planning`
- `phase: submitted`和`xaiVideoRequestId`
- `progress`隨著民調的進展
- `done`帶本地mp4神器
- `error`帶有標準化錯誤代碼

飛行中測繪：

| SSE階段|飛行階段|意義|
|---|---|---|
| `planning` | `planning` |網路搜尋+`grok-4.3`規劃師|
| `submitted` | `submitted` | xAI已接受作業並返回請求 ID|
| `progress` | `polling` |非同步影片渲染進度|
| `done` | `decoding`-> 終端|下載/寫入本機mp4|
| `error` |終端|標準化誤差|

### 第五階段：節點模式

使用案例：

- 為選取的節點設定動畫
- 將當前/生成的圖像結果動畫化為視頻
- 將生成的影片儲存為連結到節點/會話的工件

合約:

- v1 不會將節點圖模式轉變為視訊節點
- 父/當前節點影像變為`image`用於I2V
- 提示透過`grok-4.3`影片策劃師
- 結果成為連結到會話/歷史的視訊工件
- 節點工具列顯示`Animate`圖示/操作時`d.imageUrl`存在
- 更高版本的 v2 可以添加`videoUrl` / `mediaKind`如果需要視訊節點，則到節點數據

### 第六階段：代理模式

新增工具：

- `ima2.generate_video`

代理行為：

- 如果目前影像存在：預設I2V
- 如果沒有目前影像：T2V
- 工具轉動應顯示影片產生進度
- 完成的影片出現在聊天工件清單和右側影像/視訊窗格中

代理合約：

- 擴充允許的工具`ima2.generate_video`
- 工具參數：`{ prompt, mode?, duration?, resolution?, aspectRatio? }`
- 當目前影像偽影存在時，運行時自動選擇 I2V
- 將視訊工件 ID 或通用媒體工件 ID 新增至佇列/工具摘要中
- 功能應將最終工件報告為混合圖像/視頻，而不是僅圖像
- 代理人UI應顯示相同的進度階段`/api/video/generate`

### 第七階段：UI

可觸摸的零件：

- 結果行動行
- `ResultActions`
- 歷史/畫廊卡
- 節點畫布選定的節點工具列
- 代理工具折疊和工件窗格
- 右側面板型號/提供者控件

UX:

- `grok`, `grok+`, `video`位於相同模式/提供者層
- 在內部，視訊是一種生成類型，而不是圖像模型
- 影片設定很緊湊：
- 持續時間步進/選擇
- 分辨率分段控制
- 縱橫比下拉式選單
- 源模式標誌：T2V/I2V/參考
- 影片產生顯示真實的非同步進度
- 產生的視訊卡有播放/下載/複製提示/繼續操作
- 圖像結果卡得到`Animate`旁邊的行動`Continue Here`
- 節點模式僅包含圖標`Animate`選定節點工具列中的操作
- 代理圖像窗格獲得標題`Animate`針對目前影像的操作

### 第 8 階段：測試

在實施前添加合約測試：

- 適配器建構 T2V 有效負載
- 適配器建構 I2V 有效負載`image`
- 適配器拒絕混合`image` + `reference_images`
- 適配器輪詢待定 -> 完成
- 適配器處理失敗/過期/逾時
- 路線流進度和完成
- 路線保存`.mp4`+ 邊車
- 歷史掃描器包括`.mp4`視訊行
- 適度抑制的完成反應映射到`GROK_VIDEO_MODERATION_BLOCKED`
- 投票失敗`error.code`映射到標準化錯誤代碼
- UI/請求設定覆蓋計劃器持續時間/解析度/方面字段
- 飛行中`kind=video`記錄相變
- 節點操作發送父圖像作為 I2V 來源
- 代理工具轉包括`ima2.generate_video`
- UI暴露`video`旁邊`grok` / `grok+`
- 不`partial`影像事件假設洩漏到視訊路徑中

### 第九階段：端到端

使用progrok僅在合約測試通過後才產生煙霧：

- T2V 1 秒，480p
- I2V 1秒，480p，生成影像來源
- UI結果卡中的行動
- 來自節點結果的節點操作
- 當前影像中的代理動作

## 開放決策

1. 標籤：`video`, `grok video`， 或者`animate`
- 受到推崇的：`Video`在模型/提供者層，`Animate`在圖像卡上。

2. 預設持續時間
- 建議：5 秒UI，測試/冒煙 1 秒。

3. 預設解析度
- 建議：480p，以控製成本和速度；允許 720p。

4. I2V寬高比
- 受到推崇的：`auto`預設情況下，來源影像比例會被保留。

5. 參考影片 v1
- 建議：延後第一次實施，除非已經有參考文獻
存在於選定的上下文中。需要T2V/I2V；參考影片可以
共享適配器原語。

## 驗證已完成

- 建立分支：`feat/grok-video-i2v`
- xAI審查的文檔
- progrok型號清單包括`grok-imagine-video`
- I2V即時請求成功
- T2V 直播請求成功
- 下載並檢查兩個 mp4 文件`ffprobe`
- Ryo 後端審查：需要_實施前修復；上面合併的修復
- Nijika 前端評論：需要_實施前修復；上面合併的修復
