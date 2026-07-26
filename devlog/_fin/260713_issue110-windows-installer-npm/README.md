---
created: 2026-07-13
issue: "#110"
pr: "#111"
status: closed
tags: [windows, installer, powershell, npm]
---

# Windows Installer npm Handling Fix

## Problem

Windows 원클릭 설치 스크립트(`irm ... | iex`)가 두 가지 이유로 중단됨:

1. `Join-Path`에 3개 위치 인자 전달 — PowerShell 5.1에서 지원 안 됨
2. `$ErrorActionPreference = 'Stop'` 상태에서 npm stderr 경고(예: `prebuild-install` deprecation)가
   terminating error로 승격돼 npm 성공 종료에도 스크립트가 중단됨

## Root Cause

```powershell
# Before — PS 5.1 incompatible
$lockCandidate = Join-Path $npmGlobal 'node_modules' '.package-lock.json'

# npm stderr warning → ErrorRecord → Stop policy catches it → script dies
$output = & npm @installArgs 2>&1
```

PowerShell 5.1의 `Join-Path`는 `-Path`와 `-ChildPath` 두 인자만 받는다.
세 번째 인자는 positional parameter 오류를 발생시킨다.

별도로, `$ErrorActionPreference = 'Stop'`은 native command의 stderr 출력을
`ErrorRecord`로 감싸는데, npm이 정상 종료(exit code 0)해도 경고가 있으면
PowerShell이 먼저 종료시킨다.

## Fix (PR #111)

### Join-Path
```powershell
$lockCandidate = Join-Path (Join-Path $npmGlobal 'node_modules') '.package-lock.json'
```

### Invoke-Npm wrapper
```powershell
function Invoke-Npm {
    param([string[]]$Arguments)
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $result = & npm @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    [pscustomobject]@{ Output = @($result); ExitCode = $exitCode }
}
```

- `ErrorActionPreference`를 `Continue`로 일시 전환해 stderr 경고가 terminating error로
  승격되지 않게 함
- `finally`에서 원래 값 복원
- npm의 `$LASTEXITCODE`로만 성공/실패 판단

## Validation

- `tests/install-windows-contract.test.js` — Join-Path 패턴, Invoke-Npm 존재,
  ErrorActionPreference 전환, ExitCode 체크, 두 installer 파일 동기 확인 (2 passed)
- `scripts/install-windows.ps1` ↔ `site/public/install-windows.ps1` 동일 내용

## Merge

PR #111 squash merged → `61a6dd2` (2026-07-13). Issue #110 auto-closed.
