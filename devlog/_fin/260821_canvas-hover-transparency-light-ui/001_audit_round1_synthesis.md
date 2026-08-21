# 001 — A-phase 감사 라운드 1 합성 (opus 리뷰어 Carson)

평결: FAIL → 6개 지적 전부 수용, 문서 수정으로 해소.

| # | 지적 | 처리 |
|---|------|------|
| 1 | AnnotationLayer는 단일 canvas — CSS 클래스 불가 | 010: 렌더러 내 호버 아웃라인 방식으로 재설계 |
| 2 | pointer move가 도구별 early-return | 010: hit-test를 tool 분기 이전으로 이동 |
| 3 | /api/edit는 alpha 검증 미적용 | 020: edit 경로에 decodeRawForAlpha 재사용 + alphaVerified 메타 추가 |
| 4 | background 필드 없음 | 020: 프롬프트 넛지 단독 경로로 명문화 |
| 5 | 030 인벤토리 경계 불명 | 030: ui/src/index.css + styles/*.css 한정 + 예외 목록 |
| 6 | index.html 경로 모호 | 040: ui/index.html로 확정 (존재 확인) + color-scheme 메타 갱신 |

## 라운드 2 (plan-level 재감사)

| # | 지적 | 처리 |
|---|------|------|
| R2-1 | decodeRawForAlpha는 채널 존재만 검사 — 완전 불투명 오탐 | 020: verifyBufferAlpha(lib/imageBackgroundParam.ts:123) 재사용으로 교체 |
| R2-2 | alphaVerified 타입 전파 지점 미명시 | 020: edit.ts→types.ts(GenerateResponse/Item)→storeGenImpl→mapHistoryItem(storeHelpers.ts)→CanvasModeResultDetails + 사이드카 메타 명시 |

## 라운드 3-4

| # | 지적 | 처리 |
|---|------|------|
| R3-1 | 히스토리 변환 모듈 오기(storeHistoryImpl) | 020+본 문서: mapHistoryItem(storeHelpers.ts)로 정정 |
| R4-2 | CanvasModeResultDetails 부존재 주장 | **반박**: `ls ui/src/components/canvas-mode/CanvasModeResultDetails.tsx` → 존재(1540B). 리뷰어 오류로 기각 |
