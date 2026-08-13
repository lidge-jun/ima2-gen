# npx 快速入門

> 建議的安裝方法是`npm install -g ima2-gen`。本頁涵蓋
> 另一種選擇`npx`無需全域安裝即可一次性使用的工作流程。

## 無需安裝即可運行

```bash
npx ima2-gen serve
```

然後打開`http://localhost:3333`.

如果ChatGPT OAuth尚未登入：

```bash
npx @openai/codex login
npx ima2-gen serve
```

## 筆記

- `npx`將包下載到臨時快取。每次運行可能會重新下載，如果
快取是冷的，這比全域安裝慢。
- 生成的圖像儲存在`~/.ima2/generated`無論安裝
方法。當 npx 快取過期時，它們不會遺失。
- `ima2 setup`, `ima2 grok login`，以及其他CLI命令在之後仍然有效
`npx ima2-gen serve`只要 npx 會話處於活動狀態，就會啟動伺服器。
- 為了獲得穩定、更快的體驗，請使用全域安裝：

```bash
npm install -g ima2-gen
ima2 setup
ima2 serve
```

## 從舊的 npx 快取中恢復映像

如果你用過`npx`在早期版本中，您的圖像保存在 npx 內
緩存而不是`~/.ima2/generated`， 看[恢復舊影像](RECOVER_OLD_IMAGES.md).
