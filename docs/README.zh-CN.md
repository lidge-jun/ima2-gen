# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> 🌐 **Live site**: [lidge-jun.github.io/ima2-gen](https://lidge-jun.github.io/ima2-gen/) · [한국어](https://lidge-jun.github.io/ima2-gen/ko/)
>
> **其他语言**: [English](../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

`ima2-gen` 是一个本地 AI 工作室，只需免费 ChatGPT 和 SuperGrok 即可生成图像和视频。

全局安装后，通过 ChatGPT 或 Grok OAuth 登录即可开始生成图像和视频。默认 OAuth 路径无需 API 密钥；也可选用 API 密钥提供商（`api`、`grok-api`、`gemini-api`、`agy`）。

![显示 prompt 输入区、生成图片、模型标签和结果元数据的 ima2-gen classic 界面](../assets/screenshots/classic-generate-light.png)

## 快速开始

```bash
npm install -g ima2-gen
ima2 setup
ima2 serve
```

然后打开 `http://localhost:3333`。

CLI 生成视频:

```bash
ima2 video "猫弹钢琴" --duration 5 --resolution 720p
ima2 video "让这张图动起来" --ref photo.png --duration 10
```

如果 `3333` 已经被占用，server 会绑定下一个可用端口，并把实际 URL 写入 `~/.ima2/server.json`。不要假设端口固定，请使用终端输出的 URL 或 `ima2 open`。

> **想用 npx 运行？** 请参阅 [NPX_QUICKSTART.md](NPX_QUICKSTART.md)。

### 一键安装（无需 npm）

没有 Node.js 或 npm 也可以：平台安装脚本会检测环境，必要时安装 Node LTS，然后安装 ima2-gen。

**macOS:**
```bash
curl -fsSL https://lidge-jun.github.io/ima2-gen/install-mac.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://lidge-jun.github.io/ima2-gen/install-windows.ps1 | iex
```

**Linux / WSL:**
```bash
curl -fsSL https://lidge-jun.github.io/ima2-gen/install-linux.sh | bash
```

各脚本会检查 nvm/fnm/brew/winget，用最佳方式安装 Node LTS，并自动清理残留进程。

### 设置

`ima2 setup` 提供四种认证方式:

1. **GPT OAuth** — 使用 ChatGPT 账号登录（免费，仅图像）
2. **Grok OAuth** — 使用 xAI/Grok 账号登录（图像 + 视频）
3. **Both** — GPT + Grok 同时配置（完整功能）
4. **Web setup** — 在 Web UI 中完成全部设置

视频生成需要 Grok OAuth（选项 2 或 3）。若已配置 GPT OAuth 并想追加视频，请单独运行 `ima2 grok login`。

### 更新

用 Ctrl+C 停止正在运行的 server，然后:

```bash
npm install -g ima2-gen@latest
```

Ctrl+C 会执行干净关闭——关闭数据库、停止子进程并释放文件锁。旧版本（< 1.1.22）或 Windows 上出现 `EBUSY` 时，安装脚本会自动清理残留进程。

## 能做什么

- **Classic mode**：快速生成、编辑，并把当前图片继续作为参考图使用。
- **Node mode**：从一张满意的图出发，向多个方向分支探索。
- **Multimode batches**：用同一个 prompt 同时生成多个候选 slot，并从最好的结果继续。
- **Canvas Mode**：支持缩放/平移、标注、橡皮擦、背景清理、透明 checkerboard 预览，以及 alpha/matte export。
- **Video generation**：从文本、单图或多张参考图生成短视频；SSE 显示 planning→submitted→progress→done；支持 First/Mid/Last 帧复制。
- **Storyboard mode**：在 composer 中开启 storyboard 模式，保持连续帧的角色与场景一致性（图像与视频均支持）。
- **Local gallery**：本地保存生成结果；默认显示当前 session，All Images 切换显示全部历史；记录生成时间与 reasoning effort 元数据。
- **Reference images**：拖放、粘贴、文件选择；图像最多 5 张，视频最多 7 张；大图上传前自动压缩。
- **Prompt library imports**：把本地 prompt pack、GitHub folder、curated GPT-image hint 导入内置 prompt library。
- **Mobile shell**：小屏幕使用 app bar、compose sheet 和 compact settings toggle。
- **Observable jobs**：用 request ID 追踪进行中和最近完成的任务。

### SSE 多路复用

Web UI 通过单个 `GET /api/events` Server-Sent Events 连接接收所有生成进度。Multimode、node、video 请求以异步 POST（`202 { requestId }`）提交，进度事件经共享事件总线多路复用。这消除了浏览器 6 连接限制导致的并发生成时图库 hang。未发送 `async: true` 的 CLI 客户端仍可收到每个请求的 SSE 流以保持兼容。

## 图像生成支持 OAuth 和 API key

默认图像生成通过本地 Codex/ChatGPT OAuth 路径执行。

如果 env/config 里有 API key，生成接口可以通过 `provider: "api"` 使用 Responses API 的 `image_generation` tool。

- `provider: "grok-api"` — 通过 `XAI_API_KEY` 直连 xAI Images API
- `provider: "agy"` — 本地 Antigravity CLI（`IMA2_AGY_BIN`）
- `provider: "gemini-api"` — `GEMINI_API_KEY` 或 Vertex（`VERTEX_SERVICE_ACCOUNT_JSON`，Vertex 优先）

如果设置页显示 **API key provider available**，意思是检测到了 API key，并且可用于生成、编辑、multimode 和 node 请求。

Grok 视频默认使用正式名 `grok-imagine-video-1.5`；`grok-imagine-video` 保留用于 Ref2V、V2V edit 和 extension 兼容路径，旧的 `grok-imagine-video-1.5-preview` 字符串仍作为兼容 alias 接受。根据参考图数量自动选择 T2V(0)、I2V(1)、Ref2V(2-7，最长 10 秒)。1080p 可用于 `grok-imagine-video-1.5` 的 prompt-only T2V 和单图/单帧 I2V。支持 duration(1-15s)、resolution(480p/720p/受支持时 1080p) 和 aspect ratio。

设置页的 QuotaCard 显示 Grok billing `$used/$limit` 进度条和 **Switch Account** 按钮（`POST /api/auth/switch`）。

![显示 OAuth active 与 API key provider available 状态的设置页](../assets/screenshots/settings-oauth-generation.png)

## 模型建议

图像生成与 Prompt Builder 默认使用 **`gpt-5.6-luna`**；旧模型保留为兼容选项。

- `gpt-5.6-luna` — 当前图像与 Prompt Builder 默认值。
- `gpt-5.6-terra` / `gpt-5.6-sol` — 账号支持时可用的 GPT-5.6 选项。
- `gpt-5.5` / `gpt-5.4` / `gpt-5.4-mini` — 兼容选项。

Quality 支持 `low`, `medium`, `high`；moderation 支持 `auto`, `low`。

## 工作流

### Classic mode

适合快速做出一张图并继续调整。

1. 写 prompt。
2. 需要时添加参考图。
3. 选择模型、quality、size、format、moderation。
4. 生成一张图，或打开 multimode 从同一个 prompt 生成多个候选 slot。
5. 生成后复制、下载、继续迭代，或进入 Canvas Mode 清理。

![一个 prompt 正在生成四个 candidate slot，sidebar 中显示 active job history 的 multimode sequence 界面](../assets/screenshots/multimode-sequence.png)

### Node mode

适合将创意分支发散并进行直观对比。

![显示连接节点、生成卡片和节点元数据的 Node mode 界面](../assets/screenshots/node-graph-branching.png)

每个节点都有自己的 prompt 和结果。根节点可以附加本地参考图；子节点将使用父节点图片作为参考来源。完成的任务会通过 request ID 重新匹配，因此刷新或 graph version conflict 后也能恢复结果。

### Canvas Mode

当生成结果已经接近目标，但还需要局部清理或背景处理时使用 Canvas Mode。

- 缩放后的图片中，viewport pan 与 selection tool 分离，避免在移动画面时误触或修改 annotation。
- 支持 annotation、eraser、multiselect、group、undo/redo 和 sticky note。
- 可点击指定 background cleanup seed，预览 mask，并保存为 canvas version。
- 透明图会显示 checkerboard preview，export 可选择保留 alpha 或合成指定 matte color。
- 保存的 canvas version 不会出现在 Gallery/HistoryStrip 中，但 Canvas Mode 可以复用它，也可以把它作为下一次 reference。

![显示 zoom controls、annotation marks、sticky note 和 canvas toolbar 的 Canvas Mode 界面](../assets/screenshots/canvas-mode-cleanup.png)

### Prompt library 和 Import

Prompt library 可以从 local files、GitHub folders、curated sources 和 GPT-image hint packs 导入。导入后的 prompt 会写入本地 index，因此下次启动后仍可搜索和 ranking。

![导入到 prompt library 前用于查看 GitHub folder、curated sources 和搜索候选 prompt 的 prompt import dialog](../assets/screenshots/prompt-import-dialog.png)

### Experimental Card News Mode

Card News 仍是开发专用的实验功能。默认公开运行环境中，除非明确以开发用途启用，否则它会保持隐藏；目前不应将其视为稳定的公开功能。

### Settings

Settings workspace 会把账号、模型、主题和语言设置从生成面板中分离出来。

![显示账号区域和生成模型设置的 Settings workspace](../assets/screenshots/settings-workspace.png)

## CLI 命令

### Server

| Command | Description |
|---|---|
| `ima2 serve [--dev]` | 启动本地 Web server；`--dev` 显示更详细的 server diagnostics |
| `ima2 setup` | 重新配置认证 |
| `ima2 status` | 查看 config 和 OAuth 状态 |
| `ima2 doctor` | 诊断 Node、package、config、auth |
| `ima2 doctor image-probe [--json]` | 无图像时的 sanitized 诊断 probe |
| `ima2 open` | 打开 Web UI |
| `ima2 reset` | 删除已保存的 config |

### Client

这些命令需要先运行 `ima2 serve`。CLI 已覆盖所有服务端路由，下面只列出最常用的命令。完整列表见 [CLI 参考（英文）](CLI.md)（包含 generation、history、sessions、prompt library、annotations、Card News、observability、config）。

| Command | Description |
|---|---|
| `ima2 gen <prompt>` | 从 CLI 生成图片 |
| `ima2 edit <file> --prompt <text>` | 编辑已有图片 |
| `ima2 multimode <prompt>` | 多图 SSE 生成 |
| `ima2 video <prompt>` | Grok 视频生成（SSE 进度） |
| `ima2 ls [--session <id>] [--favorites]` | 查看本地历史 |
| `ima2 show <name> [--metadata]` | 打开生成文件 |
| `ima2 prompt ls -q <搜索>` | 搜索 prompt library |
| `ima2 inflight ls [--terminal]` | 查看进行中 / 最近完成任务（`ps` 别名）|
| `ima2 config set <key> <value>` | 写入 `~/.ima2/config.json` |
| `ima2 ping` | 检查 server 是否可用 |

Server 端口会写入 `~/.ima2/server.json`。如果 `3333` 已被占用，server 可能 fallback 到 `3334+`，请优先使用终端输出的 URL 或 `ima2 open`。也可以用 `--server <url>` 或 `IMA2_SERVER=http://localhost:3333` 覆盖。

完整命令与标志见 [docs/CLI.md](CLI.md)。

## 配置

优先级：

```text
environment variables > ~/.ima2/config.json > built-in defaults
```

| Variable | Default | Description |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | Web server port |
| `IMA2_HOST` | `127.0.0.1` | Web server bind host |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth proxy port |
| `IMA2_SERVER` | — | CLI target override |
| `IMA2_CONFIG_DIR` | `~/.ima2` | Config 和 SQLite 位置 |
| `IMA2_ADVERTISE_FILE` | `~/.ima2/server.json` | 运行时 server discovery 文件 |
| `IMA2_GENERATED_DIR` | `~/.ima2/generated` | 生成图片目录 |
| `IMA2_IMAGE_MODEL_DEFAULT` | `gpt-5.6-luna` | Server fallback 图像模型 |
| `IMA2_NO_OAUTH_PROXY` | — | 设为 `1` 时关闭 OAuth proxy 自动启动 |
| `IMA2_LOG_LEVEL` | `info` | 普通 `serve` 默认为 `info`，dev mode 默认为 `debug`；支持 `debug`, `info`, `warn`, `error`, `silent` |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `300000` | 调试用 recent job 保留时间 |
| `OPENAI_API_KEY` | — | `provider: "api"` Responses 图像路径及辅助功能 |
| `XAI_API_KEY` | — | `provider: "grok-api"` 直连 xAI Images API |
| `GEMINI_API_KEY` | — | `provider: "gemini-api"` Generative Language API |
| `VERTEX_SERVICE_ACCOUNT_JSON` | — | Vertex AI 服务账号 JSON（优先于 API 密钥） |
| `IMA2_AGY_BIN` | PATH 中的 `agy` | `provider: "agy"` 二进制路径 |

### Logging modes

`ima2 serve` 默认保持终端输出安静：启动 URL、warning 和 error 会显示，但 request/node/OAuth structured logs 默认隐藏。

如果需要 request ID、Node generation phases、OAuth stream diagnostics 或 inflight state transitions，请使用 `ima2 serve --dev`、`npm run dev`，或 `IMA2_LOG_LEVEL=debug ima2 serve`。

## API 文档

接口列表已移到 [API Reference](API.md)。

更详细的常见问题整理在 [FAQ](FAQ.md)。如果更新后看不到旧图库图片，请先查看[旧图片恢复指南](RECOVER_OLD_IMAGES.md)。

## 常见问题

**`ima2 ping` 提示 server unreachable**
先启动 `ima2 serve`，再检查 `~/.ima2/server.json`。也可以运行 `ima2 ping --server http://localhost:3333`。

**OAuth 登录失败**
重新运行 `ima2 setup`（选项 1），用 `ima2 status` 确认状态，然后重启 `ima2 serve`。

**在代理/VPN 网络下反复出现 `fetch failed`**
请先确认本地 OAuth proxy 可以访问。如果你的网络需要代理，请在代理客户端里开启 TUN/TURN 类似的转发模式，然后重试 `openai-oauth --port 10531`。如果仍然失败，请在运行 `ima2 serve` 或 `openai-oauth` 的同一个终端里设置 `HTTP_PROXY` 和 `HTTPS_PROXY`。在 Windows 上，SecretDNS 等 DNS/分片绕过工具也可能破坏 OAuth 或流式图像响应。

**生成图片时返回 `API_KEY_REQUIRED`**
`provider: "api"` 请求没有可用 API key。请配置 API key，或切换到 OAuth provider。

**图像生成返回 `EMPTY_RESPONSE` 或没有图像数据**
运行 `ima2 doctor image-probe --json > ima2-image-probe.json`，提 issue 时附上安全 JSON。GPT OAuth 场景下，请在 `ima2 serve` 运行时额外捕获 `ima2 gen "猫" --no-web-search --json` 和 `ima2 gen "猫" --json`。不要分享 ChatGPT cookie、OAuth 令牌文件、API key、原始 upstream 响应、prompt 历史或生成 base64。详见 [FAQ 支持包](FAQ.md#what-should-i-share-when-oauth-image-generation-returns-no-image)。

**大参考图上传失败**
JPEG/PNG 会在上传前自动压缩。如果仍然失败，请转成更低分辨率的 JPEG/PNG。HEIC/HEIF 不支持浏览器路径。

**更新后看不到旧图库图片**
新版本把生成图片目录从已安装的 package 文件夹移到了 `~/.ima2/generated`。请运行 `ima2 doctor`，并查看[旧图片恢复指南](RECOVER_OLD_IMAGES.md)。

**只有 `gpt-5.5` 失败**
请先更新 Codex CLI 后再试。如果仍然失败，说明当前账号或后端路径下 `gpt-5.5` 的图像 capability 或额度策略可能还不同；稳定替代方案是使用 `gpt-5.4`。

**应用在不同端口打开**
如果请求的服务端口被占用，ima2-gen 会 fallback 到下一个可用端口并写入 `~/.ima2/server.json`。若端口意外变成 `3457`，可能是 shell 继承了其他本地工具的 `PORT=3457`。运行 `unset PORT`，或使用 `IMA2_PORT=3333 ima2 serve`。

**Windows 上端口 `10531` 已被占用**
部分 Windows 安全工具（如 `AnySign4PC.exe`）可能占用默认 OAuth proxy 端口。当前版本会跟踪实际 fallback OAuth 端口。如需手动覆盖，请使用 `IMA2_OAUTH_PROXY_PORT=11531 ima2 serve` 启动，并用 `ima2 doctor` 确认。

更多面向新手的排查步骤请查看 [FAQ](FAQ.md)。

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

`npm run dev` 会构建 UI，并用 `--watch` 启动 TypeScript server entry，同时显示详细 server diagnostics。`npm run typecheck`、`npm run build:server`、`npm run build:cli` 可验证 TypeScript migration 和 package emit path。

## License

MIT
