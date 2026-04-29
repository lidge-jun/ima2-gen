# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> 🌐 **Live site**: [lidge-jun.github.io/ima2-gen](https://lidge-jun.github.io/ima2-gen/) · [한국어](https://lidge-jun.github.io/ima2-gen/ko/)
>
> **其他语言**: [English](../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

`ima2-gen` 是一个本地图像生成工作室，为你提供类似小型桌面应用的 ChatGPT/Codex OAuth 图像生成体验。

用 `npx` 启动，登录 Codex OAuth，输入 prompt，然后通过历史记录、参考图、style sheet、节点分支、multimode 批量候选和 Canvas Mode 清理持续迭代。默认图像生成路径不需要 OpenAI API key。

![显示 prompt 输入区、生成图片、模型标签和结果元数据的 ima2-gen classic 界面](../assets/screenshots/classic-generate-light.png)

## 快速开始

```bash
npx ima2-gen serve
```

然后打开 `http://localhost:3333`。

如果还没有登录 Codex：

```bash
npx @openai/codex login
npx ima2-gen serve
```

如果 `3333` 已经被占用，server 会绑定下一个可用端口，并把实际 URL 写入 `~/.ima2/server.json`。不要假设端口固定，请使用终端输出的 URL 或 `ima2 open`。

也可以全局安装：

```bash
npm install -g ima2-gen
ima2 serve
```

## 能做什么

- **Classic mode**：快速生成、编辑，并把当前图片继续作为参考图使用。
- **Node mode**：从一张满意的图出发，向多个方向分支探索。
- **Multimode batches**：用同一个 prompt 同时生成多个候选 slot，并从最好的结果继续。
- **Canvas Mode**：支持缩放/平移、标注、橡皮擦、背景清理、透明 checkerboard 预览，以及 alpha/matte export。
- **Local gallery**：将生成结果保存在本地，并按会话 (session) 查看历史。
- **Reference images**：支持拖放、粘贴和文件选择；大图会在上传前自动压缩。
- **Prompt library imports**：把本地 prompt pack、GitHub folder、curated GPT-image hint 导入内置 prompt library。
- **Style sheets**：保存一套视觉方向，并复用到 classic/node prompt。
- **Mobile shell**：小屏幕使用 app bar、compose sheet 和 compact settings toggle。
- **Observable jobs**：用 request ID 追踪进行中和最近完成的任务。

## 图像生成只走 OAuth

当前图像生成通过本地 Codex/ChatGPT OAuth 路径执行。

即使 env/config 里有 API key，它也只可能用于 billing 检查或 style-sheet 提取等辅助功能。生成接口收到 `provider: "api"` 时会返回 `APIKEY_DISABLED`。

如果设置页显示 **Configured but disabled**，意思是检测到了 API key，但图像生成仍然使用 OAuth。

![显示 OAuth active 与 API key disabled 状态的设置页](../assets/screenshots/settings-oauth-generation.png)

## 模型建议

应用默认使用适合快速本地迭代的 **`gpt-5.4-mini`**。如果想要更稳定、均衡的结果，建议切换到 **`gpt-5.4`**。

- `gpt-5.4` — 推荐的均衡选择。
- `gpt-5.4-mini` — 当前应用默认值，适合快速草稿。
- `gpt-5.5` — 在支持的环境中是质量最高的选择。但它可能消耗更多额度，也可能需要更新 Codex CLI，或依赖账号/后端路径是否开放对应的图像 capability。

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

### Settings 和 Style sheets

Settings workspace 会把账号、模型、主题和语言设置从生成面板中分离出来。

![显示账号区域和生成模型设置的 Settings workspace](../assets/screenshots/settings-workspace.png)

Style sheet 用来保存可复用的视觉方向。

![包含 medium、composition、mood、subject、palette、negative 字段的 style sheet editor](../assets/screenshots/style-sheet-editor.png)

## CLI 命令

### Server

| Command | Description |
|---|---|
| `ima2 serve [--dev]` | 启动本地 Web server；`--dev` 显示更详细的 server diagnostics |
| `ima2 setup` | 重新配置认证 |
| `ima2 status` | 查看 config 和 OAuth 状态 |
| `ima2 doctor` | 诊断 Node、package、config、auth |
| `ima2 open` | 打开 Web UI |
| `ima2 reset` | 删除已保存的 config |

### Client

这些命令需要先运行 `ima2 serve`。

| Command | Description |
|---|---|
| `ima2 gen <prompt>` | 从 CLI 生成图片 |
| `ima2 edit <file> --prompt <text>` | 编辑已有图片 |
| `ima2 ls` | 查看本地历史 |
| `ima2 show <name>` | 打开生成文件 |
| `ima2 ps` | 查看进行中的任务 |
| `ima2 cancel <requestId>` | 将进行中的任务标记为 canceled |
| `ima2 ping` | 检查 server 是否可用 |

Server 端口会写入 `~/.ima2/server.json`。如果 `3333` 已被占用，server 可能 fallback 到 `3334+`，请优先使用终端输出的 URL 或 `ima2 open`。也可以用 `--server <url>` 或 `IMA2_SERVER=http://localhost:3333` 覆盖。

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
| `IMA2_IMAGE_MODEL_DEFAULT` | `gpt-5.4-mini` | Server fallback 图像模型 |
| `IMA2_NO_OAUTH_PROXY` | — | 设为 `1` 时关闭 OAuth proxy 自动启动 |
| `IMA2_LOG_LEVEL` | `warn` | 普通 `serve` 默认为 `warn`，dev mode 默认为 `debug`；支持 `debug`, `info`, `warn`, `error`, `silent` |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | 调试用 recent job 保留时间 |
| `OPENAI_API_KEY` | — | 辅助功能用 API key，不用于图像生成 |

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
运行 `npx @openai/codex login`，用 `ima2 status` 确认状态，然后重启 `ima2 serve`。

**在代理/VPN 网络下反复出现 `fetch failed`**
请先确认本地 OAuth proxy 可以访问。如果你的网络需要代理，请在代理客户端里开启 TUN/TURN 类似的转发模式，然后重试 `npx openai-oauth --port 10531`。如果仍然失败，请在运行 `ima2 serve` 或 `openai-oauth` 的同一个终端里设置 `HTTP_PROXY` 和 `HTTPS_PROXY`。

**生成图片时返回 `APIKEY_DISABLED`**
当前 build 需要使用 OAuth 生成。API-key image generation 是有意关闭的。

**大参考图上传失败**
JPEG/PNG 会在上传前自动压缩。如果仍然失败，请转成更低分辨率的 JPEG/PNG。HEIC/HEIF 不支持浏览器路径。

**更新后看不到旧图库图片**
新版本把生成图片目录从已安装的 package 文件夹移到了 `~/.ima2/generated`。请运行 `ima2 doctor`，并查看[旧图片恢复指南](RECOVER_OLD_IMAGES.md)。

**只有 `gpt-5.5` 失败**
请先更新 Codex CLI 后再试。如果仍然失败，说明当前账号或后端路径下 `gpt-5.5` 的图像 capability 或额度策略可能还不同；稳定替代方案是使用 `gpt-5.4`。

**端口突然变成 `3457`**
shell 可能继承了其他本地工具的 `PORT=3457`。运行 `unset PORT`，或使用 `IMA2_PORT=3333 ima2 serve`。

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
