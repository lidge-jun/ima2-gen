# 恢复旧生成的图像

`ima2-gen`将生成的图像移动到更安全的用户数据文件夹中`v1.0.8`.

有关更广泛的安装和故障排除问题，请参阅[常问问题](FAQ.md)或者[韩语常见问题解答](FAQ.ko.md).

## 发生了什么变化

版本高达`v1.0.7`将生成的图像存储在已安装的包中：

```text
<global node_modules>/ima2-gen/generated
```

开始于`v1.0.8`，生成的图像存储在您的用户数据文件夹下：

```text
macOS / Linux: ~/.ima2/generated
Windows: %USERPROFILE%\.ima2\generated
```

这可以防止将来的包更新混合应用程序代码和运行时用户文件。

## 为什么图像可能看起来缺失

抱歉吓到了。较旧的全局安装可能会将图像保留在包文件夹内。如果在更新期间替换了旧的全局安装文件夹，则之前的全局安装文件夹将被替换。`generated/`文件夹可能不再位于磁盘上。

`ima2-gen`仅当旧文件夹仍然存在时才能复制旧图像。如果找不到旧文件夹，恢复可能需要备份。

## 首先检查

跑步：

```bash
ima2 doctor
```

存储部分显示当前图库文件夹以及是否找到旧文件夹。

## macOS / Linux：查找旧文件夹

```bash
find ~/.ima2 ~/.npm-global ~/.nvm ~/.fnm ~/.volta ~/.bun ~/.config/yarn ~/Library/pnpm ~/.local/share/pnpm ~/.asdf ~/.local/share/mise /usr/local /opt/homebrew \
  -path '*ima2-gen/generated' -type d 2>/dev/null
```

如果你用过`npx`或者`npm exec`:

```bash
find "$(npm config get cache)/_npx" \
  -path '*/node_modules/ima2-gen/generated' -type d 2>/dev/null
```

## Windows PowerShell：查找旧文件夹

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

如果你用过`npx`或者`npm exec`:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Directory -Filter generated -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match 'node_modules\\ima2-gen\\generated$' } |
  Select-Object -ExpandProperty FullName
```

## 将找到的文件复制到新位置

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

不要删除旧的全局安装文件夹或npm缓存，直到您确认您的图像在应用程序中再次可见。
