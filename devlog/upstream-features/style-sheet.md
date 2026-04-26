# 세션별 StyleSheet (자동 스타일 일관성)

> 마스터: [README.md](README.md) — Phase 3.2
> 참조: upstream 18커밋 — `d5e47eb` `de31e91` `0b82fb8` `000a30c` `d0a1728` `39a39f3` `02b0a22` `6ad43bc` `c44a2d7` `d644677` `f1772f5`(skip) `f199329` `0cd1a54` `81a97f1` `8acc5a4` `b55b471` `cb5af30`(skip) `0e18df0` + `539a07f` (composer 위치)

## 배경

같은 세션에서 여러 장 생성할 때 색감/구도/분위기/매체가 일관되게 유지되도록, **첫 결과(또는 사용자가 좋아한 결과)에서 스타일 시트를 추출해 이후 모든 prompt에 자동 prepend**하는 기능.

기존 우리 `styleChips`는 사용자가 매번 chip을 골라야 함. StyleSheet는 한 번 추출 → 세션 토글로 자동 적용.

## 동작 명세

### 데이터 모델

`sessions` 테이블에 컬럼 2개 추가 (idempotent migration in `lib/db.js`):

```sql
ALTER TABLE sessions ADD COLUMN style_sheet TEXT;
ALTER TABLE sessions ADD COLUMN style_sheet_enabled INTEGER NOT NULL DEFAULT 0;
```

`style_sheet` JSON 스키마:
```json
{
  "palette": "warm earth tones with muted teal accents",
  "composition": "centered subject, shallow depth of field, rule of thirds",
  "mood": "intimate, contemplative, golden hour",
  "medium": "35mm film photography with subtle grain"
}
```

4 필드 모두 string. 빈 문자열 OK, 4필드 모두 빈 시트는 reject.

### 핵심 모듈

**`lib/styleSheet.js` 신규**:
```js
export function coerceStyleSheet(raw) {
  // raw가 빈 객체/배열이면 throw STYLE_SHEET_EMPTY
  // 4필드 외 키 있으면 무시
  // 각 필드 string 타입 강제
}

export function renderStyleSheetPrefix(sheet) {
  // 4필드 → "Style: palette: X. composition: Y. mood: Z. medium: W.\n\n" 형식
  // 빈 필드는 생략
}
```

**`lib/styleSheetExtract.js` 또는 `server.js` 라우트**:
- GPT(예: gpt-5 또는 gpt-4o)로 기존 prompt + 결과 이미지에서 4필드 추출
- 응답을 JSON으로 파싱 → `coerceStyleSheet`로 검증

### Server 라우트

```
GET    /api/sessions/:id/style-sheet           → { sheet, enabled }
PUT    /api/sessions/:id/style-sheet           → body { sheet, enabled? }
POST   /api/sessions/:id/style-sheet/extract   → 기존 generations에서 추출 후 PUT
DELETE /api/sessions/:id/style-sheet           → null + enabled=0
```

에러 코드:
- `STYLE_SHEET_EMPTY` → 422
- `STYLE_SHEET_PARSE` → 422 (GPT 응답이 JSON 아님)
- `STYLE_SHEET_SHAPE` → 422 (필드 누락/타입 어긋남)
- `enabled`가 boolean 아닌 경우 → 422

`/api/generate`, `/api/edit`, `/api/node/generate` 진입점에서:
1. 세션 조회 → `style_sheet_enabled === 1` 이면
2. `renderStyleSheetPrefix(sheet)` + 사용자 prompt를 합쳐서 모델 호출
3. **stale 보호**: PUT 시점의 `graph_version`을 sidecar에 기록, generate 직전 다시 조회해서 같은 버전이면 적용 / 다르면 cache invalidate

### UI

**`StyleSheetPanel` 컴포넌트** (`ui/src/components/StyleSheetPanel.tsx` 신규):
- 4필드 textarea
- "Extract from current results" 버튼 → POST /extract 호출
- "Enable for this session" 토글
- 저장 / 취소
- 모달 형식 (composer 툴바에서 호출, `539a07f` 참고)
- a11y: ESC로 닫기, `role="dialog"`, save/toggle 가드(저장 안 된 변경 있으면 확인)

**store** (`useAppStore.ts`):
```ts
styleSheet: { sheet: StyleSheet | null, enabled: boolean }
loadStyleSheet: (sessionId) => Promise<void>
saveStyleSheet: (sheet, enabled) => Promise<void>
extractStyleSheet: () => Promise<void>
```

**stale 가드**: 다른 탭에서 같은 세션 시트 수정 시 conflict toast.

## 영향 파일 (우리 코드 기준)

| 파일 | 변경 종류 |
|------|----------|
| `lib/db.js` | sessions 컬럼 2개 추가 (migration) |
| `lib/sessionStore.js` | get/set/enable 헬퍼 |
| `lib/styleSheet.js` | 신규 — coerce + render |
| `lib/styleSheetExtract.js` | 신규 — GPT 호출 |
| `server.js` | 4 라우트 + generate/edit/node 진입점 prefix prepend |
| `ui/src/components/StyleSheetPanel.tsx` | 신규 |
| `ui/src/components/PromptComposer.tsx` | 툴바에 StyleSheet 버튼 |
| `ui/src/store/useAppStore.ts` | styleSheet 상태 + actions |
| `ui/src/lib/api.ts` | 4 API 호출 헬퍼 |
| `ui/src/types.ts` | `StyleSheet` 타입 |
| `tests/style-sheet.test.js` | coerceStyleSheet, renderStyleSheetPrefix 단위 테스트 |

## 검증

1. **단위**: coerceStyleSheet 빈/배열/잘못된 타입 거부, render 빈 필드 생략
2. **통합**: 세션 생성 → extract → enable → generate → 결과 prompt에 prefix 포함 확인
3. **회귀**: enabled=0 세션은 동작 변화 없음
4. **a11y**: ESC, focus trap, save 안 한 채 닫을 때 confirm

## 의존성 / 순서

- Phase 2.3 (config 중앙화) 완료 후 권장 — extract용 GPT 모델/limit이 config로 분리되면 깔끔
- Phase 3.1 (Direct mode)와 호환: Direct ON + StyleSheet ON 시 prefix(스타일) + 사용자 prompt + suffix(fidelity) 순서

## 우리 styleChips와의 관계

- **공존 가능**: chips는 일회성 toggle, StyleSheet는 세션 영속
- 또는 StyleSheet 도입 후 chips 단순화 (예: chips 누르면 StyleSheet 필드에 자동 누적)
- 결정은 구현 직전 사용자와 합의

## 분량 예측

upstream 18커밋 ≈ 1주 작업이 누적된 것. 우리는 코드 베끼기가 아니라 재구현이라 **3~5일** 소요 예상.
