# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **其他语言**: [English](../README.md) · [한국어](README.ko.md) · [日本語](README.ja.md)

`ima2-gen` 是一个本地 CLI + Web 工作室，通过 ChatGPT/Codex OAuth 路径调用 OpenAI 图像生成。它包含 React UI、无头 CLI、持久历史、参考图上传、生产可用的节点分支模式，以及安全的请求日志。

当前图像生成是 **OAuth only**。API key 仍可用于 billing/status 检查和 style-sheet 提取等辅助开发路径，但图像生成端点会明确拒绝 `provider: "api"` 并返回 `APIKEY_DISABLED`，除非你有意在代码中重新打开该策略。

![ima2-gen 截图](../assets/screenshot.png)

---

## 快速开始

```bash
npx ima2-gen serve

# 或全局安装
npm install -g ima2-gen
ima2 serve
```

首次运行会进入设置:

```text
1) API Key  — 保存 OpenAI API key，用于支持的辅助路径
2) OAuth    — 使用 ChatGPT/Codex 账号登录，用于图像生成
```

当前版本请使用 OAuth 生成图像。如果 Codex 尚未登录:

```bash
npx @openai/codex login
ima2 serve
```

默认 Web UI 地址为 `http://localhost:3333`。

---

## 当前功能

### OAuth 图像生成

- `/api/generate` 文生图
- `/api/edit` 图像编辑 / 图生图
- 根生成请求最多 5 张参考图
- Quality: `low`, `medium`, `high`
- Moderation: `low`, `auto`
- PNG/JPEG/WebP 输出
- UI 并行数量: 1、2、4；CLI/server 上限为 8
- 符合 `gpt-image-2` 约束的尺寸预设

### UI 工作流

- prompt 输入区支持拖放与 Cmd/Ctrl+V 粘贴图片
- 将当前图片复用为下一次生成参考
- 底部画廊条与完整画廊弹窗
- 生成物删除/恢复
- 通过标题栏齿轮打开设置工作区
- 账号/主题设置已从拥挤的侧边栏移出
- 右侧边栏只保留生成细节选项
- 刷新后自动恢复并同步进行中任务

### 节点模式

节点模式已在打包后的 Web UI 中可用，可通过 composer 旁边的模式切换打开。

- SQLite 图会话
- 分支式子节点生成
- Duplicate branch / New from here 流程
- 根节点级本地参考图，支持 drag/drop、paste 和 file picker
- 节点 sidecar 与 history 响应记录 reference 使用数量
- session style sheet 可自动给 classic/node prompt 添加 house style 前缀
- 画廊按 session title 分组，避免显示裸 server id

### 可观测性

- generate/edit/node/OAuth/session/history/inflight 生命周期结构化日志
- 使用 `requestId` 关联请求
- 默认 `/api/inflight` 只返回 active jobs
- `/api/inflight?includeTerminal=1` 才返回最近完成/失败/取消的 terminal jobs
- 日志不会包含 raw prompt、effective/revised prompt、token、auth header、cookie、request body、reference data URL、generated base64、raw upstream body

---

## CLI 命令

### 服务器命令

| 命令 | 别名 | 说明 |
|---|---|---|
| `ima2 serve` | — | 启动本地 Web 服务器 |
| `ima2 setup` | `login` | 重新配置保存的认证 |
| `ima2 status` | — | 显示配置与 OAuth 会话状态 |
| `ima2 doctor` | — | 诊断 Node/package/config/auth 状态 |
| `ima2 open` | — | 打开 Web UI |
| `ima2 reset` | — | 删除保存的配置 |
| `ima2 --version` | `-v` | 输出版本 |
| `ima2 --help` | `-h` | 输出帮助 |

### 客户端命令

需要正在运行的 `ima2 serve`。

| 命令 | 说明 |
|---|---|
| `ima2 gen <prompt>` | 从 CLI 生成图像 |
| `ima2 edit <file> --prompt <text>` | 编辑已有图像 |
| `ima2 ls` | 列出历史，表格或 `--json` |
| `ima2 show <name>` | 显示或 reveal 生成物 |
| `ima2 ps` | 列出进行中 jobs |
| `ima2 ping` | 健康检查运行中的服务器 |

服务器会在 `~/.ima2/server.json` 广播端口。CLI 自动发现，也可通过 `--server <url>` 或 `IMA2_SERVER=http://localhost:3333` 覆盖。

### 退出码

`0` 成功 · `2` 参数错误 · `3` 服务器不可达 · `4` `APIKEY_DISABLED` · `5` 4xx · `6` 5xx · `7` 安全拒绝 · `8` 超时。

---

## API 端点

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

### OAuth 生成请求

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

### API key 设置与启用说明

当前行为:

- 支持的生成路径是 `provider: "oauth"`。
- `provider: "api"` 在 `routes/generate.js`、`routes/edit.js`、`routes/nodes.js` 中返回 `403` / `APIKEY_DISABLED`。
- `OPENAI_API_KEY` 或 `~/.ima2/config.json` 中的 API key 可用于 billing probe、style-sheet extraction 等非生成辅助路径。

为辅助路径配置 API key:

```bash
export OPENAI_API_KEY="sk-..."
ima2 serve
```

或写入 `~/.ima2/config.json`:

```json
{
  "provider": "api",
  "apiKey": "sk-..."
}
```

如果开发者想重新打开 API-key 图像生成，需要审查并修改:

- `routes/generate.js`
- `routes/edit.js`
- `routes/nodes.js`

不要只删除 guard。需要补齐 OpenAI SDK 生成/编辑实现、OAuth/API 双路径测试、billing/error 测试，并同步更新 README。

---

## 配置

优先级:

```text
环境变量 > ~/.ima2/config.json > 默认值
```

| 变量 | 默认值 | 说明 |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | Web 服务器端口 |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth 代理端口 |
| `IMA2_SERVER` | — | CLI 目标服务器覆盖 |
| `IMA2_CONFIG_DIR` | `~/.ima2` | 配置与 SQLite 位置 |
| `IMA2_GENERATED_DIR` | `generated/` | 生成图片目录 |
| `IMA2_NO_OAUTH_PROXY` | — | 设为 `1` 禁止自动启动 OAuth proxy |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | opt-in terminal inflight job 保留时间 |
| `VITE_IMA2_NODE_MODE` | enabled | UI 构建时设为 `0` 可隐藏节点模式 |
| `OPENAI_API_KEY` | — | 支持的辅助路径 API key |

---

## 架构

```text
ima2 serve
  ├── Express server (:3333)
  │   ├── routes/ 路由模块
  │   ├── lib/oauthProxy.js OAuth 图像调用
  │   ├── generated/ 图片 + sidecar JSON
  │   ├── better-sqlite3 会话 DB
  │   └── ui/dist React app
  ├── openai-oauth proxy (:10531)
  └── ~/.ima2/server.json 供 CLI 自动发现
```

---

## 开发

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev
npm test
npm run build
```

`npm run dev` 会构建 UI，并以 `--watch` 启动 `server.js`。节点模式现在是 dev 与打包构建中的普通产品界面。只有需要 classic-only bundle 时才设置 `VITE_IMA2_NODE_MODE=0`。

当前测试覆盖 CLI、config、history delete/restore/pagination、reference validation、OAuth parameter normalization、prompt fidelity、inflight tracking、safe logging、route health checks。

---

## 故障排查

**`ima2 ping` 无法连接服务器**
启动 `ima2 serve` 并查看 `~/.ima2/server.json`。也可用 `ima2 ping --server http://localhost:3333` 指定。

**OAuth 登录失败**
运行 `npx @openai/codex login`，确认 `ima2 status`，然后重启 `ima2 serve`。

**生成图片时出现 `APIKEY_DISABLED`**
你正在用 API key provider 生成。当前版本请使用 OAuth。

**已配置 API key，但生成仍走 OAuth**
这是预期行为。API key 当前用于辅助 status/extraction 路径，不用于图像生成。

**端口意外变成 `3457`**
shell 可能继承了其他工具的 `PORT=3457`。运行 `unset PORT` 或 `IMA2_PORT=3333 ima2 serve`。

---

## 最近变更

- 打包构建中启用节点模式
- 节点级参考图与 branch duplication
- 节点 reference 使用量 `refsCount` 元数据
- npm 包包含 modular `routes/` 服务端文件
- 账号/主题设置工作区
- Prompt fidelity 与 revised prompt capture
- OAuth quality `low`, `medium`, `high` 保留
- 安全结构化日志与 terminal inflight debug snapshot
- 基于 session title 的画廊分组
- Windows spawn 相关 CLI 修复

## 许可证

MIT
