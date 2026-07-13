# ima2-gen one-click install (Windows / PowerShell)
#
# Usage (one-liner):
#   irm https://lidge-jun.github.io/ima2-gen/install-windows.ps1 | iex
#
# Or download and run:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
#
# Steps:
#   1. Kill stale ima2/node processes (prevents EBUSY on update)
#   2. Detect Node.js (nvm-windows → winget → installer link)
#   3. Verify Node >= 20
#   4. Install ima2-gen globally
#   5. Launch ima2 serve
#
# Requires: Windows 10+, PowerShell 5.1+

$ErrorActionPreference = 'Stop'
$MIN_NODE = 20

function Print($msg) { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "✔ $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
    # nvm-windows specific
    $nvmHome = [System.Environment]::GetEnvironmentVariable('NVM_HOME', 'User')
    $nvmLink = [System.Environment]::GetEnvironmentVariable('NVM_SYMLINK', 'User')
    if ($nvmHome -and $env:Path -notlike "*$nvmHome*") {
        $env:Path = "$nvmHome;$env:Path"
    }
    if ($nvmLink -and $env:Path -notlike "*$nvmLink*") {
        $env:Path = "$nvmLink;$env:Path"
    }
}

# ── 1. Kill stale processes (EBUSY prevention) ──────────────────────

$stale = Get-Process node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -like '*ima2*' -or $_.CommandLine -like '*ima2*' }
if (-not $stale) {
    $stale = Get-Process node -ErrorAction SilentlyContinue |
        Where-Object { $_.MainModule.FileName -like '*node_modules*ima2*' }
}
if ($stale) {
    Warn "Stopping stale ima2 node processes ($($stale.Count) found)…"
    $stale | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# ── 2. Find or install Node.js ──────────────────────────────────────

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Print "Node.js detected: $nodeVersion"
}
else {
    Warn 'Node.js not found. Searching for install methods…'

    # Try nvm-windows
    if (Get-Command nvm -ErrorAction SilentlyContinue) {
        Print 'nvm-windows detected. Installing Node LTS…'
        nvm install lts
        nvm use lts
        Refresh-Path
    }
    # Try winget
    elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        Print 'Installing Node.js LTS via winget…'
        winget install --id OpenJS.NodeJS.LTS -e --silent `
            --accept-package-agreements --accept-source-agreements
        Refresh-Path
    }
    else {
        Fail 'No package manager found. Install Node.js from https://nodejs.org or install nvm-windows from https://github.com/coreybutler/nvm-windows/releases'
    }
}

# ── 3. Version gate ─────────────────────────────────────────────────

Refresh-Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'node is not on PATH after install. Close this terminal, open a new one, and re-run.'
}

$major = [int]((node --version) -replace 'v(\d+)\..*', '$1')
if ($major -lt $MIN_NODE) {
    Fail "Node v$major is too old. ima2-gen requires Node >= $MIN_NODE. Run: nvm install lts"
}
$npmVersion = npm --version
$npmMajor = [int]($npmVersion.Split('.')[0])
Ok "Node $(node --version), npm $npmVersion"

# ── 4. Install ima2-gen ─────────────────────────────────────────────

# Pre-clean: force-remove stale locks from previous versions
$npmGlobal = (npm prefix -g 2>$null)
if ($npmGlobal) {
    $lockCandidate = Join-Path (Join-Path $npmGlobal 'node_modules') '.package-lock.json'
    if (Test-Path $lockCandidate) {
        try {
            Remove-Item $lockCandidate -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

Print 'Installing ima2-gen globally…'
$installArgs = @('install', '-g', 'ima2-gen')
if ($npmMajor -ge 12) {
    $installArgs += '--allow-scripts=ima2-gen,better-sqlite3,sharp'
}

function Invoke-Npm {
    param([string[]]$Arguments)

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        # PowerShell 5.1 promotes native stderr (including npm warnings) to
        # ErrorRecord objects. Keep those in the captured output so warnings
        # do not abort the installer before npm's exit code is checked.
        $ErrorActionPreference = 'Continue'
        $result = & npm @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    [pscustomobject]@{
        Output   = @($result)
        ExitCode = $exitCode
    }
}

$installResult = Invoke-Npm $installArgs
$output = $installResult.Output
if ($installResult.ExitCode -ne 0) {
    $outputStr = $output -join "`n"
    if ($outputStr -match 'EBUSY|EPERM|resource busy') {
        Warn 'File lock detected. Killing all node processes and retrying…'
        Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
        Start-Sleep -Seconds 3
        npm cache clean --force 2>$null
        $installResult = Invoke-Npm $installArgs
        $output = $installResult.Output
        if ($installResult.ExitCode -ne 0) {
            Write-Host ($output -join "`n")
            Fail 'Install still failed after cleanup. Reboot, then run this script again before starting ima2.'
        }
    }
    else {
        Write-Host ($output -join "`n")
        Fail 'Install failed. Try running PowerShell as Administrator.'
    }
}
Ok 'ima2-gen installed'
Print 'Verifying runtime dependencies…'
& ima2 doctor *> $null
if ($LASTEXITCODE -ne 0) {
    Fail "Runtime verification failed. Re-run the installer and inspect 'ima2 doctor'."
}
Ok 'Runtime dependencies verified'

# ── 5. Launch ────────────────────────────────────────────────────────

Print 'Starting image studio (Ctrl+C to stop)…'
Print 'If the browser does not open, visit http://localhost:3333'
Write-Host ''
& ima2 serve
