# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **他の言語で読む**: [English](../README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md)

`ima2-gen` は ChatGPT/Codex OAuth 経路で OpenAI 画像生成を実行するローカル CLI + Web Studio です。React UI、ヘッドレス CLI、永続履歴、参照画像アップロード、開発用ノード分岐モード、安全なリクエストログを備えています。

現在の画像生成は **OAuth only** です。API key は billing/status 確認や style-sheet 抽出などの補助的な開発経路には使えますが、画像生成エンドポイントは `provider: "api"` を `APIKEY_DISABLED` として明示的に拒否します。API key 生成を使うにはコード上の provider policy を意図的に変更する必要があります。

![ima2-gen スクリーンショット](../assets/screenshot.png)

---

## クイックスタート

```bash
npx ima2-gen serve

# またはグローバルインストール
npm install -g ima2-gen
ima2 serve
```

初回起動時に設定が開きます:

```text
1) API Key  — サポート済み補助経路用に OpenAI API key を保存
2) OAuth    — 画像生成用に ChatGPT/Codex アカウントでログイン
```

現在のリリースでは画像生成に OAuth を使ってください。Codex に未ログインの場合:

```bash
npx @openai/codex login
ima2 serve
```

既定の Web UI は `http://localhost:3333` です。

---

## 現在の機能

### OAuth 画像生成

- `/api/generate` テキストから画像生成
- `/api/edit` 画像編集 / 画像から画像生成
- ルート生成リクエストあたり最大 5 枚の参照画像
- Quality: `low`, `medium`, `high`
- Moderation: `low`, `auto`
- PNG/JPEG/WebP 出力
- UI の並列数: 1、2、4。CLI/server の上限は 8
- `gpt-image-2` 制約に合わせたサイズプリセット

### UI ワークフロー

- プロンプト入力でドラッグ&ドロップと Cmd/Ctrl+V 画像貼り付け
- 現在の画像を次の生成の参照として再利用
- 下部ギャラリーストリップとフルギャラリーモーダル
- 生成物の削除/復元
- ヘッダーの歯車から開く設定ワークスペース
- アカウント/テーマ設定を混雑したサイドバーから分離
- 右サイドバーは生成詳細オプションのみ表示
- リロード後も進行中ジョブを自動 reconcile

### ノードモード

ノードモードは `npm run dev` で有効になる開発用画面です。

- SQLite ベースのグラフセッション
- 子ノード分岐生成
- Duplicate branch / New from here フロー
- ノード単位のローカル参照画像
- session style sheet による classic/node prompt への house style 自動付与
- ギャラリーは raw session id ではなく session title を優先表示

### オブザーバビリティ

- generate/edit/node/OAuth/session/history/inflight のライフサイクル構造化ログ
- `requestId` による追跡
- 既定の `/api/inflight` は active-only
- `/api/inflight?includeTerminal=1` のみ最近の完了/失敗/キャンセル job を返す
- raw prompt、effective/revised prompt、token、auth header、cookie、request body、reference data URL、generated base64、raw upstream body はログに出しません

---

## CLI コマンド

### サーバーコマンド

| コマンド | エイリアス | 説明 |
|---|---|---|
| `ima2 serve` | — | ローカル Web サーバーを起動 |
| `ima2 setup` | `login` | 保存済み認証を再設定 |
| `ima2 status` | — | 設定と OAuth セッション状態を表示 |
| `ima2 doctor` | — | Node/package/config/auth 状態を診断 |
| `ima2 open` | — | Web UI を開く |
| `ima2 reset` | — | 保存済み設定を削除 |
| `ima2 --version` | `-v` | バージョン表示 |
| `ima2 --help` | `-h` | ヘルプ表示 |

### クライアントコマンド

`ima2 serve` が実行中である必要があります。

| コマンド | 説明 |
|---|---|
| `ima2 gen <prompt>` | CLI から画像生成 |
| `ima2 edit <file> --prompt <text>` | 既存画像を編集 |
| `ima2 ls` | 履歴一覧、table または `--json` |
| `ima2 show <name>` | 生成物を表示/reveal |
| `ima2 ps` | 進行中 jobs を一覧 |
| `ima2 ping` | 実行中サーバーの health check |

サーバーは `~/.ima2/server.json` にポートを広告します。CLI は自動検出し、`--server <url>` または `IMA2_SERVER=http://localhost:3333` で上書きできます。

### 終了コード

`0` 成功 · `2` 不正な引数 · `3` サーバー到達不能 · `4` `APIKEY_DISABLED` · `5` 4xx · `6` 5xx · `7` safety refusal · `8` timeout。

---

## API エンドポイント

```text
GET    /api/health
GET    /api/providers
GET    /api/oauth/status
GET    /api/billing
GET    /api/inflight
GET    /api/inflight?includeTerminal=1
POST   /api/generate
POST   /api/edit
GET    /api/history
GET    /api/history?groupBy=session
DELETE /api/history/:filename
POST   /api/history/:filename/restore
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:id
PATCH  /api/sessions/:id
DELETE /api/sessions/:id
PUT    /api/sessions/:id/graph
GET    /api/node/:nodeId
POST   /api/node/generate
```

### OAuth 生成リクエスト

```bash
curl -X POST http://localhost:3333/api/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "a shiba in space",
    "quality": "medium",
    "size": "1024x1024",
    "moderation": "low",
    "provider": "oauth"
  }'
```

### API key 設定と有効化メモ

現在の挙動:

- サポート済み生成経路は `provider: "oauth"` です。
- `provider: "api"` は `routes/generate.js`、`routes/edit.js`、`routes/nodes.js` で `403` / `APIKEY_DISABLED` を返します。
- `OPENAI_API_KEY` または `~/.ima2/config.json` の API key は billing probe、style-sheet extraction など非生成の補助経路に利用できます。

補助経路用 API key の設定:

```bash
export OPENAI_API_KEY="sk-..."
ima2 serve
```

または `~/.ima2/config.json`:

```json
{
  "provider": "api",
  "apiKey": "sk-..."
}
```

開発者が API-key 画像生成を意図的に再度有効化する場合は、以下の `provider === "api"` guard を監査して変更してください。

- `routes/generate.js`
- `routes/edit.js`
- `routes/nodes.js`

guard を削除するだけでは不十分です。OpenAI SDK ベースの生成/編集実装、OAuth/API 両経路テスト、billing/error テスト、README 更新を同時に行ってください。

---

## 設定

優先順位:

```text
環境変数 > ~/.ima2/config.json > 既定値
```

| 変数 | 既定値 | 説明 |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | Web サーバーポート |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth プロキシポート |
| `IMA2_SERVER` | — | CLI 対象サーバー上書き |
| `IMA2_CONFIG_DIR` | `~/.ima2` | 設定と SQLite の場所 |
| `IMA2_GENERATED_DIR` | `generated/` | 生成画像ディレクトリ |
| `IMA2_NO_OAUTH_PROXY` | — | `1` で OAuth proxy 自動起動を無効化 |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | opt-in terminal inflight job 保持時間 |
| `OPENAI_API_KEY` | — | サポート済み補助経路用 API key |

---

## アーキテクチャ

```text
ima2 serve
  ├── Express server (:3333)
  │   ├── routes/ route modules
  │   ├── lib/oauthProxy.js OAuth image calls
  │   ├── generated/ image + sidecar JSON
  │   ├── better-sqlite3 session DB
  │   └── ui/dist React app
  ├── openai-oauth proxy (:10531)
  └── ~/.ima2/server.json for CLI discovery
```

---

## 開発

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev
npm test
npm run build
```

`npm run dev` は `VITE_IMA2_DEV=1` で UI をビルドし、`server.js` を `--watch` で起動します。ノードモードはこの dev build で表示されます。

現在のテストは CLI、config、history delete/restore/pagination、reference validation、OAuth parameter normalization、prompt fidelity、inflight tracking、safe logging、route health checks を含みます。

---

## トラブルシューティング

**`ima2 ping` がサーバーに接続できない**
`ima2 serve` を起動し、`~/.ima2/server.json` を確認してください。`ima2 ping --server http://localhost:3333` で直接指定できます。

**OAuth ログインできない**
`npx @openai/codex login` を実行し、`ima2 status` を確認してから `ima2 serve` を再起動してください。

**画像生成が `APIKEY_DISABLED` で失敗する**
API key provider で生成しようとしています。現在のリリースでは OAuth を使ってください。

**API key を設定したのに生成は OAuth のまま**
これは想定どおりです。API key は現在、補助 status/extraction 経路用であり、画像生成用ではありません。

**ポートが突然 `3457` になる**
他のローカルツールから `PORT=3457` を継承している可能性があります。`unset PORT` または `IMA2_PORT=3333 ima2 serve` を使ってください。

---

## 最近の変更

- ノード単位の参照画像と branch duplication
- アカウント/テーマ設定ワークスペース
- Prompt fidelity と revised prompt capture
- OAuth quality `low`, `medium`, `high` の保持
- 安全な構造化ログと terminal inflight debug snapshot
- session title ベースのギャラリーグルーピング
- Windows spawn 関連 CLI 修正

## ライセンス

MIT
