# npx 快速入门

> 推荐的安装方法是`npm install -g ima2-gen`。本页涵盖
> 另一种选择`npx`无需全局安装即可一次性使用的工作流程。

## 无需安装即可运行

```bash
npx ima2-gen serve
```

然后打开`http://localhost:3333`.

如果ChatGPT OAuth尚未登录：

```bash
npx @openai/codex login
npx ima2-gen serve
```

## 笔记

- `npx`将包下载到临时缓存。每次运行可能会重新下载，如果
缓存是冷的，这比全局安装慢。
- 生成的图像存储在`~/.ima2/generated`无论安装
方法。当 npx 缓存过期时，它们不会丢失。
- `ima2 setup`, `ima2 grok login`，以及其他CLI命令在之后仍然有效
`npx ima2-gen serve`只要 npx 会话处于活动状态，就会启动服务器。
- 为了获得稳定、更快的体验，请使用全局安装：

```bash
npm install -g ima2-gen
ima2 setup
ima2 serve
```

## 从旧的 npx 缓存中恢复图像

如果你用过`npx`在早期版本中，您的图像保存在 npx 内
缓存而不是`~/.ima2/generated`， 看[恢复旧图像](RECOVER_OLD_IMAGES.md).
