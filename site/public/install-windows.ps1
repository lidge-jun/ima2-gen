# ima2-gen 원클릭 설치 (Windows / PowerShell)
#
# 사용 (PowerShell 실행정책에 따라 한 줄로):
#   irm https://lidge-jun.github.io/ima2-gen/install-windows.ps1 | iex
#
# 또는 파일을 받아 실행:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
#
# 동작 순서:
#   1. Node.js 설치 확인 (없으면 winget으로 설치, winget 없으면 안내)
#   2. ima2-gen 전역 설치 (npm install -g ima2-gen)
#   3. ima2 serve 실행 (포트 3333)
#
# 지원: Windows 10 이상, PowerShell 5.1 또는 PowerShell 7

$ErrorActionPreference = 'Stop'

function Print($msg) { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Fail($msg)  { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

# 1. Node.js 확인
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Print "Node.js 감지됨: $nodeVersion"
}
else {
    Warn 'Node.js가 설치되어 있지 않습니다.'
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Print 'winget으로 Node.js LTS를 설치합니다…'
        winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
        # 새 PATH 적용을 위해 환경변수 다시 읽기
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + `
                    [System.Environment]::GetEnvironmentVariable('Path', 'User')
    }
    else {
        Fail 'winget이 없습니다. https://nodejs.org 에서 Node.js LTS를 직접 받아 설치하시고 다시 실행해 주세요.'
    }
}

# 2. ima2-gen 설치
Print 'ima2-gen을 전역으로 설치합니다…'
$installResult = & npm install -g ima2-gen 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $installResult
    Fail 'ima2-gen 설치에 실패했습니다. PowerShell을 관리자 권한으로 다시 실행하거나, npm prefix를 사용자 폴더로 바꿔 주세요.'
}
Print 'ima2-gen 설치 완료'

# 3. 실행
Print '이미지 스튜디오를 띄웁니다 (Ctrl+C로 종료)…'
Print '브라우저가 자동으로 열리지 않으면 http://localhost:3333 으로 접속하세요.'
Write-Host ''
& ima2 serve
