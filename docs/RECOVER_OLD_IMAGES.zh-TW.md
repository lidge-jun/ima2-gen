# 恢復舊生成的圖像

`ima2-gen`將生成的圖像移動到更安全的用戶資料資料夾中`v1.0.8`.

有關更廣泛的安裝和故障排除問題，請參閱[常問問題](FAQ.md)或者[韓文常見問題解答](FAQ.ko.md).

## 發生了什麼變化

版本鋼彈`v1.0.7`將生成的映像儲存在已安裝的套件中：

```text
<global node_modules>/ima2-gen/generated
```

開始於`v1.0.8`，生成的圖像儲存在您的用戶資料資料夾下：

```text
macOS / Linux: ~/.ima2/generated
Windows: %USERPROFILE%\.ima2\generated
```

這可以防止將來的套件更新混合應用程式程式碼和運行時用戶檔案。

## 為什麼影像可能看起來缺失

抱歉嚇到了。較舊的全域安裝可能會將映像保留在套件資料夾內。如果在更新期間取代了舊的全域安裝資料夾，則先前的全域安裝資料夾將被取代。`generated/`資料夾可能不再位於磁碟上。

`ima2-gen`僅當舊資料夾仍然存在時才能複製舊圖像。如果找不到舊資料夾，復原可能需要備份。

## 首先檢查

跑步：

```bash
ima2 doctor
```

儲存部分顯示目前圖庫資料夾以及是否找到舊資料夾。

## macOS / Linux：尋找舊資料夾

```bash
find ~/.ima2 ~/.npm-global ~/.nvm ~/.fnm ~/.volta ~/.bun ~/.config/yarn ~/Library/pnpm ~/.local/share/pnpm ~/.asdf ~/.local/share/mise /usr/local /opt/homebrew \
  -path '*ima2-gen/generated' -type d 2>/dev/null
```

如果你用過`npx`或者`npm exec`:

```bash
find "$(npm config get cache)/_npx" \
  -path '*/node_modules/ima2-gen/generated' -type d 2>/dev/null
```

## Windows PowerShell：尋找舊資料夾

```powershell
$roots = @($env:USERPROFILE, $env:APPDATA, $env:LOCALAPPDATA, $env:NVM_HOME, "C:\Program Files\nodejs")
foreach ($r in $roots) {
  if (Test-Path $r) {
    Get-ChildItem -Path $r -Recurse -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match 'ima2-gen[\\/]+generated$' } |
      Select-Object -ExpandProperty FullName
  }
}
```

如果你用過`npx`或者`npm exec`:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Directory -Filter generated -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match 'node_modules\\ima2-gen\\generated$' } |
  Select-Object -ExpandProperty FullName
```

## 將找到的檔案複製到新位置

macOS / Linux：

```bash
mkdir -p ~/.ima2/generated
cp -n "/path/to/old/ima2-gen/generated/"* ~/.ima2/generated/
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ima2\generated"
Copy-Item "C:\path\to\old\ima2-gen\generated\*" "$env:USERPROFILE\.ima2\generated" -Recurse -Force:$false
```

## 重要的

不要刪除舊的全域安裝資料夾或npm緩存，直到您確認您的圖像在應用程式中再次可見。
