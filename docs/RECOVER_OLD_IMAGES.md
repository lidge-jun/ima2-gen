# Recover Old Generated Images

`ima2-gen` moved generated images to a safer user-data folder in `v1.0.8`.

For broader install and troubleshooting questions, see the [FAQ](FAQ.md) or [Korean FAQ](FAQ.ko.md).

## What changed

Versions up to `v1.0.7` stored generated images inside the installed package:

```text
<global node_modules>/ima2-gen/generated
```

Starting with `v1.0.8`, generated images are stored under your user data folder:

```text
macOS / Linux: ~/.ima2/generated
Windows: %USERPROFILE%\.ima2\generated
```

This prevents future package updates from mixing application code and runtime user files.

## Why images may look missing

Sorry for the scare. Older global installs may have kept images inside the package folder. If that old global install folder was replaced during an update, the previous `generated/` folder may no longer be on disk.

`ima2-gen` can copy old images only when the old folder still exists. If no old folder can be found, recovery may require a backup.

## First check

Run:

```bash
ima2 doctor
```

The Storage section shows the current gallery folder and whether legacy folders were found.

## macOS / Linux: find old folders

```bash
find ~/.ima2 ~/.npm-global ~/.nvm ~/.fnm ~/.volta ~/.bun ~/.config/yarn ~/Library/pnpm ~/.local/share/pnpm ~/.asdf ~/.local/share/mise /usr/local /opt/homebrew \
  -path '*ima2-gen/generated' -type d 2>/dev/null
```

If you used `npx` or `npm exec`:

```bash
find "$(npm config get cache)/_npx" \
  -path '*/node_modules/ima2-gen/generated' -type d 2>/dev/null
```

## Windows PowerShell: find old folders

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

If you used `npx` or `npm exec`:

```powershell
Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Directory -Filter generated -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match 'node_modules\\ima2-gen\\generated$' } |
  Select-Object -ExpandProperty FullName
```

## Copy found files into the new location

macOS / Linux:

```bash
mkdir -p ~/.ima2/generated
cp -n "/path/to/old/ima2-gen/generated/"* ~/.ima2/generated/
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ima2\generated"
Copy-Item "C:\path\to\old\ima2-gen\generated\*" "$env:USERPROFILE\.ima2\generated" -Recurse -Force:$false
```

## Important

Do not delete old global install folders or npm caches until you confirm your images are visible in the app again.
