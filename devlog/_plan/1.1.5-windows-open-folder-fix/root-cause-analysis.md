# Windows "폴더 열기" 버튼 미작동 — Root Cause Analysis

**Date**: 2026-04-27
**Version**: 1.1.4 → 1.1.5 (patch)
**Severity**: Medium — UI 버튼이 클릭되어도 폴더가 열리지 않음
**Affected OS**: Windows (macOS, Linux 정상 동작)

---

## 1. 문제 현상

- Gallery Modal → "폴더 열기" 버튼 클릭
- Toast 메시지 "생성 이미지 폴더를 열었습니다." 표시 (성공으로 판정)
- **실제로는 explorer.exe가 폴더를 열지 않음**

---

## 2. 코드 구조

```
[UI] GalleryModal.tsx → openGeneratedDir()
  ↓ POST /api/storage/open-generated-dir
[Server] routes/storage.js → openDirectory(ctx.config.storage.generatedDir)
  ↓
[Core] lib/openDirectory.js → spawn("explorer", [dir], { detached, windowsHide })
```

---

## 3. Root Cause (3가지)

### 3.1 `windowsHide: true` — GUI 앱에 부적절한 플래그

**File**: `lib/openDirectory.js:19`

```javascript
const child = spawnImpl(command, [dir], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,  // ← 문제 1
});
```

- `windowsHide: true`는 **콘솔 앱의 콘솔 창 숨김** 용도
- `explorer.exe`는 **GUI 앱** — 이 플래그가 explorer 프로세스의 창 생성을 억제할 수 있음
- 일부 Windows 환경(특히 Windows 11 24H2+)에서 explorer가 백그라운드로만 실행되고 창이 안 뜸

### 3.2 Exit code 처리 누락

**File**: `lib/openDirectory.js:30-34`

```javascript
child.on("exit", (code) => {
  if (platform === "win32") {
    if (code === 0) done({ ok: true });
    return;  // code !== 0이면 done() 호출 안 됨
  }
  // ...
});
```

- `explorer.exe`는 **폴더를 성공적으로 열어도 exit code 1을 반환**하는 경우가 빈번
- code !== 0일 때 `done()`이 호출되지 않아 Promise가 pending 상태로 남음
- 250ms setTimeout fallback이 `{ ok: true }`로 resolve → UI는 "성공" 토스트 표시
- **실제로는 explorer가 폴더를 열지 않았을 수 있음**

### 3.3 Path quoting 부재

- Windows 경로에 공백 포함 가능: `C:\Users\John Doe\.ima2\generated`
- `spawn(command, [dir])`은 Node가 자동으로 quoting하지만, `explorer.exe`에 직접 전달 시 일부 환경에서 경로 파싱 실패

---

## 4. 왜 macOS/Linux는 정상인가?

| 플랫폼 | 명령어 | windowsHide 영향 | exit code |
|--------|--------|-------------------|-----------|
| macOS | `open` | N/A (해당 없음) | 항상 0 |
| Linux | `xdg-open` | N/A | 0 (성공 시) |
| Windows | `explorer` | **GUI 앱 창 생성 억제** | **비정상(1) 빈번** |

---

## 5. 영향 범위

- **직접 영향**: Gallery Modal "폴더 열기" 버튼 (Windows only)
- **미영향**: `bin/commands/show.js`의 `--reveal`은 `openUrl()` 사용 (별도 경로)
- **미영향**: macOS, Linux 사용자

---

## 6. 확인된 관련 파일

| 파일 | 역할 |
|------|------|
| `lib/openDirectory.js` | 핵심 — spawn 로직 (수정 대상) |
| `routes/storage.js` | API 엔드포인트 (수정 불필요) |
| `ui/src/components/GalleryModal.tsx` | UI 버튼 (수정 불필요) |
| `ui/src/lib/api.ts` | API 클라이언트 (수정 불필요) |
| `tests/open-directory.test.js` | 테스트 — Windows 시나리오 추가 필요 |
| `bin/commands/show.js` | CLI reveal (수정 불필요, `openUrl()`로 이미지 URL을 여는 별도 경로) |
