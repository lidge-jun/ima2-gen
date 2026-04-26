# PRD: Windows "폴더 열기" 수정

**Version**: 1.1.5 (patch)
**Date**: 2026-04-27
**Status**: Plan

---

## 1. 목적

Windows 환경에서 Gallery Modal의 "폴더 열기" 버튼이 explorer.exe를 올바르게 실행하도록 수정한다.

---

## 2. 수정 범위

### 2.1 `lib/openDirectory.js` (핵심 수정)

**Before:**
```javascript
const child = spawnImpl(command, [dir], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
```

**After:**
```javascript
const isWin = platform === "win32";
const child = spawnImpl(command, isWin ? [`"${dir}"`] : [dir], {
  detached: !isWin,
  stdio: "ignore",
  windowsHide: !isWin,
});
```

**변경 사항:**
1. `windowsHide` — Windows에서는 `false` (explorer.exe는 GUI 앱)
2. `detached` — Windows에서는 `false` (explorer는 독립 프로세스로 동작하므로 detached 불필요)
3. Path quoting — Windows에서 `"${dir}"` 형태로 감싸서 공백 경로 대응

### 2.2 Exit code 처리 수정

**Before:**
```javascript
child.on("exit", (code) => {
  if (platform === "win32") {
    if (code === 0) done({ ok: true });
    return;
  }
  // ...
});
```

**After:**
```javascript
child.on("exit", (code) => {
  if (platform === "win32") {
    // explorer.exe는 성공 시에도 비정상 exit code 반환 빈번
    done({ ok: true });
    return;
  }
  if (code === 0) done({ ok: true });
  else if (code != null) done({ ok: false, error: `${command} exited with code ${code}` });
});
```

**변경 사항:**
- Windows exit code 0이 아니어도 `{ ok: true }` 반환
- explorer.exe의 비정상 exit code(1 등)를 성공으로 처리
- setTimeout fallback은 그대로 유지 (exit 이벤트가 아예 안 올 경우 대비)

### 2.3 기존 테스트 수정

**File**: `tests/open-directory.test.js`

**기존 assertion 수정:**
```javascript
// Before (line 30):
assert.ok(calls.every((call) => call.args[0] === dir));

// After — 플랫폼별 분리:
assert.equal(calls[0].args[0], dir);           // darwin: unquoted
assert.equal(calls[1].args[0], `"${dir}"`);    // win32: quoted
assert.equal(calls[2].args[0], dir);           // linux: unquoted
```

### 2.4 테스트 추가

**File**: `tests/open-directory.test.js`

**추가 시나리오 4개:**
```javascript
test("openDirectory on Windows resolves immediately on exit code 1", async () => {
  // settleMs를 5000ms로 크게 설정, exit code 1 emit 직후
  // Promise.race( result, setTimeout(50ms,"timeout") )로
  // "exit에서 즉시 settle됨"을 검증. 기존 buggy 코드는 timeout 발생.
});

test("openDirectory on Windows passes windowsHide=false and detached=false", async () => {
  // spawn options.capture 후
  // assert.equal(options.windowsHide, false);
  // assert.equal(options.detached, false);
});

test("openDirectory on non-Windows keeps windowsHide=true and detached=true", async () => {
  // macOS: windowsHide=true, detached=true 유지 확인 (회귀 방지)
});

test("openDirectory on Windows quotes path with spaces", async () => {
  // dir = "C:\\Users\\John Doe\\.ima2\\generated"
  // assert.equal(calls[0].args[0], `"C:\\Users\\John Doe\\.ima2\\generated"`);
});
```

---

## 3. 수정 파일 목록

| 파일 | Action | 설명 |
|------|--------|------|
| `lib/openDirectory.js` | MODIFY | spawn 옵션 + exit code 처리 |
| `tests/open-directory.test.js` | MODIFY | 기존 assertion 수정 + Windows 시나리오 4개 추가 |
| `package.json` | MODIFY | version bump → 1.1.5 |
| `package-lock.json` | MODIFY | version bump → 1.1.5 (line 3, line 9) |

---

## 4. 검증 방법

1. `npm test` — 전체 테스트 통과
2. Windows 환경에서 직접 테스트:
   - `ima2 serve` 실행
   - Gallery Modal 열기
   - "폴더 열기" 클릭 → explorer.exe가 generated 폴더를 여는지 확인
   - 경로에 공백 포함된 경우도 확인
3. macOS/Linux 회귀 테스트:
   - 기존 `open` / `xdg-open` 동작 확인

---

## 5. 제외 사항

- `routes/storage.js` 수정 불필요 (API 레이어는 정상)
- `ui/src/components/GalleryModal.tsx` 수정 불필요 (UI는 정상)
- `bin/commands/show.js` 수정 불필요 (`--reveal`은 `openUrl()`로 이미지 URL을 여는 별도 경로. 이번 폴더 열기 수정의 직접 영향 대상 아님)

---

## 6. 리스크

- **Low**: Windows exit code를 무조건 성공으로 처리하면 실제 explorer 실행 실패를 감지 못할 수 있음
  - **완화**: setTimeout 250ms fallback이 이미 동일한 역할 수행 중. explorer 자체 실패는 매우 드묾
- **Low**: Path quoting 변경이 macOS/Linux에 영향
  - **완화**: `isWin` 조건부 분기로 영향 격리
