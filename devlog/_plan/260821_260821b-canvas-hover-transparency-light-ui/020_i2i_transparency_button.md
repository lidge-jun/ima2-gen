# 020 — GPT 캔버스 i2i 투명화 원버튼 (wp2)

## 목표

캔버스 모드 하단(FloatingToolbar 또는 cleanup 패널 하단)에 "GPT 투명화" 버튼.
클릭 시 현재 캔버스 이미지를 `POST /api/edit`로 보내 배경 투명화를 요청한다.

## 동작 설계 (000 연구 근거)

- provider=oauth 고정, promptMode=direct, prompt는 검증된 넛지 문구:
  "Remove the background completely. Output a PNG with a fully transparent
  background (real alpha channel). Keep the subject pixel-identical."
- **감사 반영**: `/api/edit`에는 `background` 필드가 없고, alpha 바이트 검증은
  generate 경로(lib/generatePipeline.ts)에만 있으며 edit 경로(routes/edit.ts
  299-394)는 검증 없이 저장·반환한다. 따라서 이 WP는:
  1) 클라이언트는 프롬프트 넛지만 사용한다(검증된 경로; background 파라미터 추가 없음)
  2) edit 경로에 결과 알파 검증을 추가한다 — MODIFY `routes/edit.ts`:
     저장 직전 `verifyBufferAlpha`(lib/imageBackgroundParam.ts:123-151) 재사용 —
     이 검증기는 알파 채널 존재만이 아니라 **실제로 alpha<255인 픽셀이 존재**하는지
     의미론적으로 판정한다(완전 불투명 RGBA 오탐 방지). 응답 메타에
     `alphaVerified: boolean` 추가 (저장 포맷 PNG 유지 — lossy 재인코딩 금지 규칙
     준수). 검증 실패해도 결과는 반환하되 메타로 정직하게 표시.
  2b) **타입/전파 지점**: `alphaVerified`는 다음 경로로 전파한다 —
     routes/edit.ts 응답 JSON → ui/src/types.ts의 GenerateResponse/GenerateItem
     (옵셔널 필드 추가) → storeGenImpl의 edit 결과 → 히스토리 변환은
     `mapHistoryItem`(ui/src/store/storeHelpers.ts)에서 수행 (storeHistoryImpl은
     머지/기본값 처리만 관여 — 필요 시 그 지점만 별도 확인) → 캔버스 결과
     메타(CanvasModeResultDetails). 서버 사이드카 메타(저장 JSON)에도 동일 필드 기록.
  3) UI는 `alphaVerified`에 따라 "투명화 확인됨 / 알파 미검출" 토스트·배지 표시
- 진행 상태: 버튼 spinner + SSE inflight 표시 재사용

## 파일 계획

- NEW `ui/src/components/canvas-mode/CanvasTransparencyButton.tsx` (~80줄)
  - props: currentImage, disabled; useAppStore의 edit 액션 재사용 or fetch("/api/edit")
  - 결과는 기존 히스토리/캔버스 버전 파이프라인으로 유입 (storeGenImpl edit 경로 재사용)
- MODIFY `ui/src/components/canvas-mode/CanvasModeFloatingToolbar.tsx` — 버튼 슬롯 추가
- MODIFY `ui/src/components/canvas-mode/CanvasModeWorkspace.tsx` — 배선
- MODIFY `ui/src/styles/canvas-mode.css` — 버튼 스타일 (하단 중앙)
- MODIFY `ui/src/i18n` 사전 — ko/en 라벨 "GPT 투명화" / "GPT Transparency"

## 검증

- 버튼 클릭 → /api/edit 202/200 왕복 로그 or 실제 투명 PNG (OAuth 살아있으면)
- OAuth 불가 시: 요청 페이로드 검증 + 에러 토스트 UX 확인으로 대체하고 기록
