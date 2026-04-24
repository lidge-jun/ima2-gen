# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **他の言語で読む**: [English](../README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md)

`ima2-gen` は、ChatGPT/Codex OAuth の画像生成ワークフローをローカルの小さなデスクトップアプリのように使える画像生成スタジオです。

`npx` で起動し、Codex OAuth でログインして、プロンプトを書きながら履歴、参照画像、スタイルシート、ノード分岐で反復できます。通常の画像生成には OpenAI API key は不要です。

![プロンプト入力、生成画像、モデル表示、結果メタデータが見える ima2-gen classic 画面](../assets/screenshots/classic-generate-light.png)

## Quick Start

```bash
npx ima2-gen serve
```

その後、`http://localhost:3333` を開きます。

Codex にまだログインしていない場合:

```bash
npx @openai/codex login
npx ima2-gen serve
```

グローバルインストールもできます。

```bash
npm install -g ima2-gen
ima2 serve
```

## できること

- **Classic mode**: すばやく生成し、編集し、現在の画像を次の参照として使えます。
- **Node mode**: 良い画像を起点に、複数の方向へ分岐して試せます。
- **Local gallery**: 生成物をローカルに保存し、セッションごとの履歴として確認できます。
- **Reference images**: 参照画像を drag/drop、paste、file picker で追加できます。大きな画像は送信前に圧縮されます。
- **Style sheets**: 一度決めた見た目の方向性を classic/node プロンプトに再利用できます。
- **Observable jobs**: 進行中の生成と最近の生成を request ID で追跡できます。

## 画像生成は OAuth 専用です

現在の画像生成は、ローカルの Codex/ChatGPT OAuth 経路で実行されます。

API key が env/config に存在していても、billing 確認や style-sheet 抽出などの補助機能に使われるだけです。生成エンドポイントで `provider: "api"` を送ると `APIKEY_DISABLED` が返ります。

Settings に **Configured but disabled** と表示される場合、API key は検出されていますが、画像生成は OAuth で動いているという意味です。

![OAuth active と API key disabled の状態を示す settings 画面](../assets/screenshots/settings-oauth-generation.png)

## モデルの選び方

安定したバランスを重視するなら、まず **`gpt-5.4`** をおすすめします。

- `gpt-5.4` — 推奨のバランス型モデル。
- `gpt-5.4-mini` — 現在のアプリ既定値で、速い下書き向きです。
- `gpt-5.5` — 対応環境では最も高品質な選択肢です。ただし使用量の消費が大きくなる場合があり、Codex CLI の更新やアカウント/バックエンド側の image capability が必要になることがあります。

Quality は `low`, `medium`, `high`、moderation は `auto`, `low` をサポートします。

## ワークフロー

### Classic mode

1枚をすばやく作って調整したいときに使います。

1. プロンプトを書きます。
2. 必要なら参照画像を追加します。
3. モデル、quality、size、format、moderation を選びます。
4. 生成後、copy、download、continue を選べます。

### Node mode

アイデアを枝分かれさせながら比較したいときに使います。

![接続された生成カードとノードごとのメタデータが見える Node mode 画面](../assets/screenshots/node-graph-branching.png)

各ノードは独自のプロンプトと結果を持ちます。ルートノードにはローカル参照画像を付けられ、子ノードは親画像をソースとして使います。完了した生成は request ID で再接続されるため、リロードや graph version conflict の後でも結果を復元できます。

### Settings と Style sheets

Settings workspace は、アカウント、モデル、テーマ、言語設定を生成パネルから分離します。

![Account と Generation model controls が見える Settings workspace](../assets/screenshots/settings-workspace.png)

Style sheet は、繰り返し使いたい視覚方向を保存するための機能です。

![medium, composition, mood, subject, palette, negative fields を持つ style sheet editor](../assets/screenshots/style-sheet-editor.png)

## CLI commands

### Server

| Command | Description |
|---|---|
| `ima2 serve` | ローカル Web サーバーを起動 |
| `ima2 setup` | 認証設定を再構成 |
| `ima2 status` | config と OAuth 状態を表示 |
| `ima2 doctor` | Node、package、config、auth を診断 |
| `ima2 open` | Web UI を開く |
| `ima2 reset` | 保存済み config を削除 |

### Client

以下は `ima2 serve` が起動しているときに使えます。

| Command | Description |
|---|---|
| `ima2 gen <prompt>` | CLI から画像生成 |
| `ima2 edit <file> --prompt <text>` | 既存画像を編集 |
| `ima2 ls` | ローカル履歴を表示 |
| `ima2 show <name>` | 生成ファイルを開く |
| `ima2 ps` | 進行中ジョブを表示 |
| `ima2 ping` | 実行中サーバーを確認 |

サーバーポートは `~/.ima2/server.json` に保存されます。`--server <url>` または `IMA2_SERVER=http://localhost:3333` で上書きできます。

## Configuration

優先順位:

```text
environment variables > ~/.ima2/config.json > built-in defaults
```

| Variable | Default | Description |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | Web server port |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth proxy port |
| `IMA2_SERVER` | — | CLI target override |
| `IMA2_CONFIG_DIR` | `~/.ima2` | Config and SQLite location |
| `IMA2_GENERATED_DIR` | `~/.ima2/generated` | Generated image directory |
| `IMA2_NO_OAUTH_PROXY` | — | `1` で OAuth proxy の自動起動を無効化 |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | デバッグ用の recent job retention |
| `OPENAI_API_KEY` | — | 補助機能用。画像生成用ではありません |

## API Reference

Endpoint 一覧は [API Reference](API.md) に分離しました。

## Troubleshooting

**`ima2 ping` が server unreachable になる**
まず `ima2 serve` を起動し、`~/.ima2/server.json` を確認してください。`ima2 ping --server http://localhost:3333` も使えます。

**OAuth login がうまくいかない**
`npx @openai/codex login` を実行し、`ima2 status` を確認してから `ima2 serve` を再起動してください。

**画像生成が `APIKEY_DISABLED` で失敗する**
この build では OAuth で生成してください。API-key image generation は意図的に無効化されています。

**大きな参照画像が失敗する**
JPEG/PNG は送信前に自動圧縮されます。それでも失敗する場合は、解像度を下げた JPEG/PNG に変換してください。HEIC/HEIF は browser path ではサポートしていません。

**`gpt-5.5` だけ失敗する**
まず Codex CLI を最新版に更新してから再試行してください。それでも失敗する場合は、現在のアカウントやバックエンド経路で `gpt-5.5` の image capability または使用量枠がまだ異なる可能性があります。安定した代替として `gpt-5.4` を使ってください。

**Port が突然 `3457` になる**
別のローカルツールから `PORT=3457` が引き継がれている可能性があります。`unset PORT` するか、`IMA2_PORT=3333 ima2 serve` で起動してください。

## Development

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev
npm test
npm run build
```

## License

MIT
