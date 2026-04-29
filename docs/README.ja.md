# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> 🌐 **Live site**: [lidge-jun.github.io/ima2-gen](https://lidge-jun.github.io/ima2-gen/) · [한국어](https://lidge-jun.github.io/ima2-gen/ko/)
>
> **他の言語で読む**: [English](../README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md)

`ima2-gen` は、ChatGPT/Codex OAuth の画像生成ワークフローをローカルの小さなデスクトップアプリのように使える画像生成スタジオです。

`npx` で起動し、Codex OAuth でログインして、プロンプトを書きながら履歴や参照画像、ノード分岐、multimode batch、Canvas Mode cleanup を活用して試行錯誤（イテレーション）が可能です。通常の画像生成には OpenAI API key は不要です。

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

`3333` がすでに使われている場合、次に空いているポートで起動し、実際の URL は `~/.ima2/server.json` に書き込まれます。ポートを決め打ちせず、terminal に表示された URL または `ima2 open` を使ってください。

グローバルインストールもできます。

```bash
npm install -g ima2-gen
ima2 serve
```

## できること

- **Classic mode**: すばやく生成し、編集し、現在の画像を次の参照として使えます。
- **Node mode**: 良い画像を起点に、複数の方向へ分岐して試せます。
- **Multimode batches**: 1つのプロンプトから複数候補を同時に走らせ、slot ごとの進行を見ながら最も良い結果から作業を継続できます。
- **Canvas Mode**: zoom/pan、annotation、eraser、background cleanup、transparent checkerboard preview、alpha/matte export をサポートします。
- **Local gallery**: 生成物をローカルに保存し、セッションごとの履歴として確認できます。
- **Reference images**: 参照画像を drag/drop、paste、file picker で追加できます。大きな画像は送信前に圧縮されます。
- **Prompt library imports**: local prompt pack、GitHub folder、curated GPT-image hint を built-in prompt library に取り込めます。
- **Mobile shell**: 小さい画面では app bar、compose sheet、compact settings toggle で操作できます。
- **Observable jobs**: 進行中の生成と最近の生成を request ID で追跡できます。

## 画像生成は OAuth 専用です

現在の画像生成は、ローカルの Codex/ChatGPT OAuth 経路で実行されます。

API key が env/config に存在していても、billing 確認などの補助機能に使われるだけです。生成エンドポイントで `provider: "api"` を送ると `APIKEY_DISABLED` が返ります。

Settings に **Configured but disabled** と表示される場合、API key は検出されていますが、画像生成は OAuth で動いているという意味です。

![OAuth active と API key disabled の状態を示す settings 画面](../assets/screenshots/settings-oauth-generation.png)

## モデルの選び方

アプリの既定値は、高速なローカルでの試行錯誤に適した **`gpt-5.4-mini`** です。安定したバランスを重視するなら **`gpt-5.4`** に切り替えることをおすすめします。

- `gpt-5.4` — 推奨のバランス型モデル。
- `gpt-5.4-mini` — 現在のアプリ既定値で、素早いドラフト作成に向いています。
- `gpt-5.5` — 対応環境では最も高品質な出力が得られる選択肢です。ただし使用量の消費が大きくなる場合があり、Codex CLI の更新やアカウント/バックエンド側の image capability が必要になることがあります。

Quality は `low`, `medium`, `high`、moderation は `auto`, `low` をサポートします。

## ワークフロー

### Classic mode

1枚をすばやく作って調整したいときに使います。

1. プロンプトを書きます。
2. 必要なら参照画像を追加します。
3. モデル、quality、size、format、moderation を選びます。
4. 1枚を生成するか、multimode で同じプロンプトから複数候補を出します。
5. 生成後、copy、download、continue、Canvas Mode cleanup を選べます。

![1つのプロンプトから4つの candidate slot が生成中で、sidebar に active job history が見える multimode sequence 画面](../assets/screenshots/multimode-sequence.png)

### Node mode

アイデアを枝分かれさせながら比較したいときに使います。

![接続された生成カードとノードごとのメタデータが見える Node mode 画面](../assets/screenshots/node-graph-branching.png)

各ノードは独自のプロンプトと結果を持ちます。ルートノードにはローカル参照画像を付けられ、子ノードは親画像をソースとして使います。完了した生成は request ID で再接続されるため、リロードや graph version conflict の後でも結果を復元できます。

### Canvas Mode

生成結果がほぼ良いが、部分的な修正や背景整理が必要なときに使います。

- ズーム状態でのビューポート移動（Pan）と選択ツールが分離されているため、アノテーションを誤操作することなく画面を移動できます。
- annotation、eraser、multiselect、group、undo/redo、sticky note を使えます。
- background cleanup seed を選び、mask preview を確認して canvas version として保存できます。
- 透明画像は checkerboard preview で確認でき、export は alpha 保持または matte color 合成を選べます。
- 保存された canvas version は Gallery/HistoryStrip には表示されませんが、Canvas Mode では再利用したり次の reference として添付できます。

![zoom controls, annotation marks, sticky note, canvas toolbar が見える Canvas Mode 画面](../assets/screenshots/canvas-mode-cleanup.png)

### Prompt library と import

Prompt library は local files、GitHub folders、curated sources、GPT-image hint packs から取り込めます。取り込んだ prompt は local index に保存され、毎セッション再 import しなくても検索と ranking に使えます。

![Prompt library に取り込む前に GitHub folder、curated sources、検索候補 prompt を確認する prompt import dialog](../assets/screenshots/prompt-import-dialog.png)

### Experimental Card News Mode

Card News はまだ開発用の実験機能です。既定の公開ランタイムでは、開発用途として明示的に有効化しない限り非表示であり、安定した公開機能として扱うべきではありません。

### Settings

Settings ワークスペースでは、アカウント、モデル、テーマ、言語設定が生成パネルから独立しています。

![Account と Generation model controls が見える Settings workspace](../assets/screenshots/settings-workspace.png)

## CLI commands

### Server

| Command | Description |
|---|---|
| `ima2 serve [--dev]` | ローカル Web サーバーを起動。`--dev` は詳細な server diagnostics を表示 |
| `ima2 setup` | 認証設定を再構成 |
| `ima2 status` | config と OAuth 状態を表示 |
| `ima2 doctor` | Node、package、config、auth を診断 |
| `ima2 open` | Web UI を開く |
| `ima2 reset` | 保存済み config を削除 |

### Client

以下は `ima2 serve` が起動しているときに使えます。CLI はサーバーのすべてのルートを ラップしています。よく使うコマンドのみ抜粋しました。完全なリストは [CLI リファレンス（英語）](CLI.md) を参照してください（generation、history、sessions、prompt library、annotations、Card News、observability、config を網羅）。

| Command | Description |
|---|---|
| `ima2 gen <prompt>` | CLI から画像生成 |
| `ima2 edit <file> --prompt <text>` | 既存画像を編集 |
| `ima2 multimode <prompt>` | マルチイメージ SSE 生成 |
| `ima2 ls [--session <id>] [--favorites]` | ローカル履歴を表示 |
| `ima2 show <name> [--metadata]` | 生成ファイルを開く |
| `ima2 prompt ls -q <検索>` | プロンプトライブラリ検索 |
| `ima2 inflight ls [--terminal]` | 進行中 / 直近完了ジョブ（`ps` のエイリアス）|
| `ima2 config set <key> <value>` | `~/.ima2/config.json` に書き込み |
| `ima2 ping` | サーバー疎通確認 |

サーバーポートは `~/.ima2/server.json` に保存されます。`3333` が埋まっている場合は `3334+` に fallback するため、terminal に表示された URL または `ima2 open` を優先してください。`--server <url>` または `IMA2_SERVER=http://localhost:3333` で上書きできます。

完全なコマンド一覧とフラグは [docs/CLI.md](CLI.md) にあります。

## Configuration

優先順位:

```text
environment variables > ~/.ima2/config.json > built-in defaults
```

| Variable | Default | Description |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | Web server port |
| `IMA2_HOST` | `127.0.0.1` | Web server bind host |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth proxy port |
| `IMA2_SERVER` | — | CLI target override |
| `IMA2_CONFIG_DIR` | `~/.ima2` | Config and SQLite location |
| `IMA2_ADVERTISE_FILE` | `~/.ima2/server.json` | Runtime discovery file |
| `IMA2_GENERATED_DIR` | `~/.ima2/generated` | Generated image directory |
| `IMA2_IMAGE_MODEL_DEFAULT` | `gpt-5.4-mini` | Server fallback image model |
| `IMA2_NO_OAUTH_PROXY` | — | `1` で OAuth proxy の自動起動を無効化 |
| `IMA2_LOG_LEVEL` | `warn` | 通常の `serve` は `warn`、dev mode は `debug`。`debug`, `info`, `warn`, `error`, `silent` をサポート |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | デバッグ用の recent job retention |
| `OPENAI_API_KEY` | — | 補助機能用。画像生成用ではありません |

### Logging modes

`ima2 serve` は通常ユーザー向けに terminal output を静かに保ちます。起動 URL、warning、error は表示されますが、request/node/OAuth structured logs は既定で隠されます。

request ID、Node generation phases、OAuth stream diagnostics、inflight state transitions を確認したい場合は、`ima2 serve --dev`、`npm run dev`、または `IMA2_LOG_LEVEL=debug ima2 serve` を使ってください。

## API Reference

Endpoint 一覧は [API Reference](API.md) に分離しました。

詳しいFAQは [FAQ](FAQ.md) にまとめています。アップデート後に以前のギャラリー画像が見えない場合は、まず [Recover Old Generated Images](RECOVER_OLD_IMAGES.md) を確認してください。

## Troubleshooting

**`ima2 ping` が server unreachable になる**
まず `ima2 serve` を起動し、`~/.ima2/server.json` を確認してください。`ima2 ping --server http://localhost:3333` も使えます。

**OAuth login がうまくいかない**
`npx @openai/codex login` を実行し、`ima2 status` を確認してから `ima2 serve` を再起動してください。

**画像生成が `APIKEY_DISABLED` で失敗する**
この build では OAuth で生成してください。API-key image generation は意図的に無効化されています。

**大きな参照画像が失敗する**
JPEG/PNG は送信前に自動圧縮されます。それでも失敗する場合は、解像度を下げた JPEG/PNG に変換してください。HEIC/HEIF は browser path ではサポートしていません。

**更新後に以前のギャラリー画像が見えない**
最近のバージョンでは、生成画像の保存先がインストール済みパッケージ内から `~/.ima2/generated` に移動しました。`ima2 doctor` を実行し、[古い画像の復旧ガイド](RECOVER_OLD_IMAGES.md) を確認してください。

**`gpt-5.5` だけ失敗する**
まず Codex CLI を最新版に更新してから再試行してください。それでも失敗する場合は、現在のアカウントやバックエンド経路で `gpt-5.5` の image capability または使用量枠がまだ異なる可能性があります。安定した代替として `gpt-5.4` を使ってください。

**Port が突然 `3457` になる**
別のローカルツールから `PORT=3457` が引き継がれている可能性があります。`unset PORT` するか、`IMA2_PORT=3333 ima2 serve` で起動してください。

より詳しい確認手順は [FAQ](FAQ.md) を参照してください。

## Development

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run dev` は UI を build し、TypeScript server entry を `--watch` で起動して verbose diagnostics を表示します。`npm run typecheck`, `npm run build:server`, `npm run build:cli` で TypeScript migration と package emit path を確認できます。

## License

MIT
