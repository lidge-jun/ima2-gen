# Grok视频T2V/I2V实施方案

日期：2026-05-30
分支：`feat/grok-video-i2v`

> 历史快照：本计划记录了2026年5月30日的实施目标。
> 当前运行时默认值是`grok-4.5`用于规划和
> `grok-imagine-video-1.5`用于视频生成；看`config.ts`和`docs/API.md`.

## 目标

添加Grok视频生成到ima2-gen作为一流的一代表面
`grok`和`grok+`.

支持的模式：

- **T2V**：文字提示->视频
- **I2V**：当前图片/所选资产/节点图片+提示->视频

视频提示必须经过相同的Grok计划层作为当前层Grok
图像生成：

1. xAI网页搜索通过`/v1/responses`
2. `grok-4.3`使用强制本地工具进行规划器调用
3. 服务器执行xAI `/v1/videos/generations`
4. 服务器轮询`/v1/videos/{request_id}`
5. 服务器下载并保存已完成的内容`.mp4`

不要将原始用户提示从产品流直接发送到视频端点。

## 截图分析

用户提供的截图：

- 可见层是生成的图像结果操作行。
- 当前操作：下载、复制图像、复制提示、在此处继续、第一个节点、
展开/打开、删除等等。
- 视频的自然放置是相同的工件动作层：
**视频/动画**应该住在旁边`Continue Here`和`First Node`，不在
一个独立的仅设置表面。

## 研究总结

完整的官方规格说明和现场progrok请求/响应日志位于：

`docs/grok-video-i2v-research.md`

研究的实施事实：

- 模型：`grok-imagine-video`
- 端点：`POST /v1/videos/generations`
- 轮询端点：`GET /v1/videos/{request_id}`
- T2V 和 I2V 均通过progrok在`127.0.0.1:18645`
- I2V接受`image.url`并遵循源图像比例`aspect_ratio`
被省略
- 决议 v1 范围：`480p`和`720p`
- 持续时间 v1 范围：T2V/I2V 1-15 秒
- 轮询状态来处理：`pending`, `done`, `failed`, `expired`
- 完成的视频 URL 是临时的，必须下载到本地历史记录中

## 产品整合

### UI放置

在屏幕截图所示的工件动作层添加视频动作：

- `Video` / `Animate`旁边的按钮`Continue Here`
- 对于图像结果卡：默认模式是 I2V，使用该图像作为源
- 对于仅提示的作曲家：允许来自视频模式下拉列表或分段的 T2V
控制在相同的提供者/模型层`grok`和`grok+`
- 对于节点模式：节点结果操作 -> 动画节点
- 对于代理模式：当前图像动作 -> 动画，加上代理工具
`ima2.generate_video`

### 提供者/模型层

保持模型层与当前图像模型平行：

| UI标签|模型|模式|
|---|---|---|
| `grok` | `grok-imagine-image` |图像|
| `grok+` | `grok-imagine-image-quality` |图像|
| `video` | `grok-imagine-video` |视频|

视频生成仍然使用`provider: "grok"`因为progrok是运行时间。
不要创建名为`video`.

请勿添加`grok-imagine-video`图像模型联合或图像模型助手。
当前图像助手分类`grok-`带前缀的字符串作为图像模型，所以
视频需要单独的生成类型：

- `provider: "grok"`
- `generationKind: "image" | "video"`
- `GrokImageModel = "grok-imagine-image" | "grok-imagine-image-quality"`
- `GrokVideoModel = "grok-imagine-video"`

### 即时管道

使用新的规划工具而不是直接的视频端点提示：

工具名称：`generate_video`

计划参数：

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

对于 I2V：

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

- 最终视频提示必须是英文
- 逐字保留明确要求的可见文本
- 包括运动/相机/动作指导
- 包括 I2V 的连续性约束：
- 保留主体身份
- 除非另有要求，否则保留成分
- 使用源图像作为第一帧/起点

产品政策：

- 始终运行Grok产品流规划器，即使上游 I2V 可以
技术上省略`prompt`.
- 规划者可以细化`prompt`并推断`mode`， 但UI/请求设置 win
为了`duration`, `resolution`， 和`aspect_ratio`.
- 始终发送明确的`duration`;不要依赖上游默认值。
- 在 I2V 中，将源图像包含在规划器视觉负载中，以便规划器
可以写出实际图像的连续性约束。
- 保持网络搜索强制 v1 与现有版本一致Grok形象行为。
未来的优化可以跳过对纯本地 I2V 动画的搜索。

## 后端实施方案

### 第一阶段：类型/配置/功能

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
- 分离`GrokVideoModel` / `isGrokVideoModel()`帮手
- 不延长`VALID_GROK_IMAGE_MODELS`有视频

### 第二阶段：Grok视频适配器

新文件：

- `lib/grokVideoAdapter.ts`

职责：

- 运行搜索 +`grok-4.3`计划者被迫`generate_video`
- 建造`/v1/videos/generations`有效负载
- 验证 T2V/I2V/参考视频互斥模式
- 启动异步请求并接收`request_id`
- 轮询`/v1/videos/{request_id}`
- 下载最终mp4
- 返回`{ videoB64? | videoBuffer, url, duration, usage, revisedPrompt, requestId }`

投票合约：

- 与总轮询预算分开使用较短的启动请求超时
- 总投票预算默认为 15 分钟
- 轮询间隔默认为 5 秒
- 几分钟内未更改的进度应发出警告/进度事件，
不是错误
- 客户端取消会停止本地轮询并标记正在进行的作业已取消；
xAI可以继续处理上游作业
- 将名称规范化为`clientRequestId`和`xaiVideoRequestId`

错误代码：

|代码|意义|
|---|---|
| `GROK_VIDEO_REQUEST_FAILED` |非 2xx 启动响应|
| `GROK_VIDEO_POLL_FAILED` |非 2xx 轮询响应|
| `GROK_VIDEO_FAILED` |地位`failed` |
| `GROK_VIDEO_EXPIRED` |地位`expired` |
| `GROK_VIDEO_TIMEOUT` |投票预算超出|
| `GROK_VIDEO_EMPTY_RESPONSE` |没有视频就完成了URL |
| `GROK_VIDEO_MODERATION_BLOCKED` |完成了但是`respect_moderation`是假的或者URL被压制|
| `GROK_VIDEO_DOWNLOAD_FAILED` |mp4 下载失败|
| `GROK_VIDEO_INVALID_MODE` |混合图像/参考/视频模式|
| `GROK_VIDEO_REF_TOO_MANY` |视频参考超过 7 条|

xAI `failed.error.code`映射：

| xAI代码| ima2代码/响应|
|---|---|
| `invalid_argument` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 400 |
| `permission_denied` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 403 |
| `failed_precondition` | `GROK_VIDEO_REQUEST_FAILED`, HTTP 412 |
| `service_unavailable` | `GROK_VIDEO_POLL_FAILED`, HTTP502 带重试提示|
| `internal_error` | `GROK_VIDEO_FAILED`, HTTP 502 |

### 第三阶段：存储/历史

添加视频工件存储：

- 写`.mp4`到生成的目录
- 写`.mp4.json`边车
- 添加`mediaType: "image" | "video"`元数据
- 添加`video.duration`, `video.resolution`, `video.aspectRatio`, `sourceImageId`
- 图库/历史有效负载应包含足够的数据来渲染视频卡
- 更新历史扫描以包括`.mp4`
- 使用视频的 sidecar 元数据；不要尝试图像 XMP 嵌入
- 稍后可以选择添加海报缩略图，但 v1 可以渲染`<video controls>`

不要依赖xAI应用程序历史记录的临时 URL。

历史行添加：

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

### 第四阶段：API路线

新路线：

- `POST /api/video/generate`

身体：

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

响应应该使用SSE对于长期运行的进展：

- `phase: planning`
- `phase: submitted`和`xaiVideoRequestId`
- `progress`随着民意调查的进展
- `done`带本地mp4神器
- `error`带有标准化错误代码

飞行中测绘：

| SSE阶段|飞行阶段|意义|
|---|---|---|
| `planning` | `planning` |网络搜索+`grok-4.3`规划师|
| `submitted` | `submitted` | xAI已接受作业并返回请求 ID|
| `progress` | `polling` |异步视频渲染进度|
| `done` | `decoding`-> 终端|下载/写入本地mp4|
| `error` |终端|标准化误差|

### 第五阶段：节点模式

使用案例：

- 为选定的节点设置动画
- 将当前/生成的图像结果动画化为视频
- 将生成的视频保存为链接到节点/会话的工件

合同：

- v1 不会将节点图模式转变为视频节点
- 父/当前节点图像变为`image`用于I2V
- 提示通过`grok-4.3`视频策划师
- 结果成为链接到会话/历史的视频工件
- 节点工具栏显示`Animate`图标/操作时`d.imageUrl`存在
- 更高版本的 v2 可以添加`videoUrl` / `mediaKind`如果需要视频节点，则到节点数据

### 第六阶段：代理模式

添加工具：

- `ima2.generate_video`

代理行为：

- 如果当前图像存在：默认I2V
- 如果没有当前图像：T2V
- 工具转动应显示视频生成进度
- 完成的视频出现在聊天工件列表和右侧图像/视频窗格中

代理合同：

- 扩展允许的工具`ima2.generate_video`
- 工具参数：`{ prompt, mode?, duration?, resolution?, aspectRatio? }`
- 当当前图像伪影存在时，运行时自动选择 I2V
- 将视频工件 ID 或通用媒体工件 ID 添加到队列/工具摘要中
- 功能应将最终工件报告为混合图像/视频，而不是仅图像
- 代理人UI应显示相同的进度阶段`/api/video/generate`

### 第七阶段：UI

可触摸的部件：

- 结果行动行
- `ResultActions`
- 历史/画廊卡
- 节点画布选定的节点工具栏
- 代理工具折叠和工件窗格
- 右侧面板型号/提供商控件

UX:

- `grok`, `grok+`, `video`位于同一模型/提供者层
- 在内部，视频是一种生成类型，而不是图像模型
- 视频设置很紧凑：
- 持续时间步进/选择
- 分辨率分段控制
- 纵横比下拉菜单
- 源模式标志：T2V/I2V/参考
- 视频生成显示真实的异步进度
- 生成的视频卡有播放/下载/复制提示/继续操作
- 图像结果卡得到`Animate`旁边的行动`Continue Here`
- 节点模式仅包含图标`Animate`选定节点工具栏中的操作
- 代理图像窗格获​​得标题`Animate`针对当前图像的操作

### 第 8 阶段：测试

在实施前添加合约测试：

- 适配器构建 T2V 有效负载
- 适配器构建 I2V 有效负载`image`
- 适配器拒绝混合`image` + `reference_images`
- 适配器轮询待定 -> 完成
- 适配器处理失败/过期/超时
- 路线流进度和完成
- 路线保存`.mp4`+ 边车
- 历史扫描仪包括`.mp4`视频行
- 适度抑制的完成反应映射到`GROK_VIDEO_MODERATION_BLOCKED`
- 投票失败`error.code`映射到标准化错误代码
- UI/请求设置覆盖计划器持续时间/分辨率/方面字段
- 飞行中`kind=video`记录相变
- 节点操作发送父图像作为 I2V 源
- 代理工具转包括`ima2.generate_video`
- UI暴露`video`旁边`grok` / `grok+`
- 不`partial`图像事件假设泄漏到视频路径中

### 第九阶段：端到端

使用progrok仅在合同测试通过后才产生烟雾：

- T2V 1 秒，480p
- I2V 1秒，480p，生成图像源
- UI结果卡中的行动
- 来自节点结果的节点操作
- 当前图像中的代理动作

## 开放决策

1. 标签：`video`, `grok video`， 或者`animate`
- 受到推崇的：`Video`在模型/提供者层，`Animate`在图像卡上。

2. 默认持续时间
- 建议：5 秒UI，测试/冒烟 1 秒。

3. 默认分辨率
- 推荐：480p，以控制成本和速度；允许 720p。

4. I2V宽高比
- 受到推崇的：`auto`默认情况下，源图像比例会被保留。

5. 参考视频 v1
- 建议：推迟第一次实施，除非已经有参考文献
存在于选定的上下文中。需要T2V/I2V；参考视频可以
共享适配器原语。

## 验证已完成

- 创建分支：`feat/grok-video-i2v`
- xAI审查的文档
- progrok型号列表包括`grok-imagine-video`
- I2V实时请求成功
- T2V 直播请求成功
- 下载并检查两个 mp4 文件`ffprobe`
- Ryo 后端审查：需要_实施前修复；上面合并的修复
- Nijika 前端评论：需要_实施前修复；上面合并的修复
