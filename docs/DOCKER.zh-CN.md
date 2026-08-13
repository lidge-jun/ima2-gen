# Docker部署

ima2-gen运送多级`Dockerfile`（问题＃114）。该图像构建了
网络UI和服务器从源并直接运行 Express 服务器。

## 快速启动

```bash
docker build -t ima2-gen .
docker run -d --name ima2 \
  -p 3333:3333 \
  -e IMA2_LAN_TOKEN=change-me \
  -v ima2-data:/data \
  ima2-gen
```

或者使用 compose：

```bash
IMA2_LAN_TOKEN=change-me docker compose up -d
```

然后打开`http://localhost:3333/?token=change-me`（或将令牌作为
`x-ima2-token`标头打开API来电）。

## 为什么`IMA2_LAN_TOKEN`是必须的

服务器必须在容器内绑定`0.0.0.0`可以通过
端口映射。ima2-gen故意拒绝绑定非环回主机
没有访问令牌（`server.ts`保安），所以容器设置
`IMA2_HOST=0.0.0.0`并且你必须提供`IMA2_LAN_TOKEN`。没有它
容器在启动时退出并出现明显错误 - 这是设计使然，而不是错误。

## 环境

|多变的|默认（图像）|目的|
|---|---|---|
| `IMA2_LAN_TOKEN` |- （必需的）| API非环回绑定的访问令牌|
| `IMA2_PORT` | `3333` |服务器端口|
| `IMA2_HOST` | `0.0.0.0` |绑定主机|
| `IMA2_CONFIG_DIR` | `/data` |配置+生成的输出+凭据|
| `OPENAI_API_KEY` | — |选修的：API-关键图像提供商|
| `GEMINI_API_KEY` | — |选修的：Gemini API提供者|

状态（配置、生成的图像/视频、OAuth凭证）生活在`/data`
— 在那里挂载一个卷来保存它。

## 提供商设置

容器在没有配置任何提供程序的情况下启动。配置提供者
网络UI（设置），或通过API通过环境变量的键。OAuth
从网络发起的设备/浏览器流UI照常工作；令牌持续存在
在`/data`.

## 局限性

- 该映像仅运行服务器。CLI工作流程（`ima2 gen`等）可以执行
放入容器中（`docker exec -it ima2 node bin/ima2.js …`）但是是
主要为主机安装而设计。
- 镜像构建尚未在 CI 中进行。 Dockerfile 镜像npm
打包合同（`package.json` `files[]`）；如果你遇到了构建/运行时
问题，请使用日志打开问题。
