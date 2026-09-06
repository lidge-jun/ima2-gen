# Docker部署

ima2-gen運送多級`Dockerfile`（問題＃114）。該圖像建構了
網路UI和伺服器從來源並直接運行 Express 伺服器。

## 快速啟動

```bash
docker build -t ima2-gen .
docker run -d --name ima2 \
  -p 3333:3333 \
  -e IMA2_LAN_TOKEN \
  -v ima2-data:/data \
  ima2-gen
```

或使用 compose：

```bash
docker compose up -d
```

請先在環境中設定自行產生的強隨機 `IMA2_LAN_TOKEN`，不要使用範例權杖。
然後開啟 `http://localhost:3333/`，在工作室登入表單輸入權杖。
瀏覽器使用 HttpOnly 工作階段存取 API、圖片、影片與 SSE；權杖不會存入瀏覽器儲存空間。

變更發布連接埠或使用代理時，設定 `IMA2_PUBLIC_ORIGINS` JSON 陣列，
例如 `["http://localhost:8080"]`。TLS 代理須保留 Host/Origin 並轉送 Set-Cookie。
HTTP 不會加密憑證，僅適用可信網路；不可信網路請使用 TLS/VPN。
生成檔案現在需要授權且不快取，但無法撤回舊快取或已下載的副本。
重新啟動會使工作階段失效，不會刪除檔案。詳見 [存取協定](API.md#local-and-lan-access) 與 [CLI 認證](CLI.md#lan-server-authentication)。

## 為什麼`IMA2_LAN_TOKEN`是必須的

伺服器必須在容器內綁定`0.0.0.0`可以透過
連接埠映射。ima2-gen故意拒絕綁定非環回主機
沒有訪問令牌（`server.ts`保安），所以容器設置
`IMA2_HOST=0.0.0.0`並且你必須提供`IMA2_LAN_TOKEN`。沒有它
容器在啟動時退出並出現明顯錯誤 - 這是設計使然，而不是錯誤。

## 環境

|多變的|預設（圖像）|目的|
|---|---|---|
| `IMA2_LAN_TOKEN` |- （必需的）| API非環回綁定的存取令牌|
| `IMA2_PORT` | `3333` |伺服器連接埠|
| `IMA2_HOST` | `0.0.0.0` |綁定主機|
| `IMA2_CONFIG_DIR` | `/data` |配置+產生的輸出+憑證|
| `OPENAI_API_KEY` | — |選修的：API-關鍵圖像提供者|
| `GEMINI_API_KEY` | — |選修的：Gemini API提供者|

狀態（配置、產生的影像/影片、OAuth憑證）生活在`/data`
— 在那裡掛載一個磁碟區來保存它。

## 提供者設定

容器在沒有配置任何提供者的情況下啟動。配置提供者
網路UI（設定），或透過API透過環境變數的鍵。OAuth
從網路發起的裝置/瀏覽器串流UI照常工作；令牌持續存在
在`/data`.

## 限制

- 該映像僅運行伺服器。CLI工作流程（`ima2 gen`等）可以執行
放入容器中（`docker exec -it ima2 node bin/ima2.js …`）但是是
主要為主機安裝而設計。
- 鏡像建置尚未在 CI 中進行。 Dockerfile 映像npm
打包合約（`package.json` `files[]`）；如果你遇到了建置/運行時
問題，請使用日誌開啟問題。
