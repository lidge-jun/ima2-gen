---
created: 2026-07-11
tags: [ima2-gen, hardening, security, frontend, backend]
---

# WP8 하드닝 홀 레저 (sol explorers "Mill"=백엔드, "Parfit"=프론트)

정적 read-only 감사. Agent 탭 결함은 010_agent-audit.md가 소유. 위협 모델:
기본 바인딩 loopback 전용(127.0.0.1) — `IMA2_HOST=0.0.0.0`이면 심각도 상승.

## 백엔드 (Mill)

### P0
- **B1 Card News `setId` 임의 경로 쓰기**: `/api/cardnews/*`가 setId 검증 없이
  fs join — 절대경로/`../` 통과. `routes/cardNews.ts:135,143`,
  `lib/cardNewsGenerator.ts:154,168`, `lib/cardNewsManifestStore.ts:41`.
  수정: 기존 `assertSafeSetId()` 정책을 모든 쓰기 전에 적용 + realpath 격리.

### P1
- **B2 LAN 바인딩 시 무인증 자격증명/파괴 조작** (`config.ts:74`, `routes/keys.ts:171,249`) — 비루프백 바인딩엔 토큰 요구.
- **B3 asset 삭제가 `generated/` 밖 심링크 추적** (`lib/assetLifecycle.ts:7,69,112`) — lstat + realpath 격리.
- **B4 키 동시 갱신 last-writer-wins + 공유 temp 파일명** (`routes/keys.ts:9,85,216,259`) — 뮤텍스 + 랜덤 temp.
- **B5 video edit/extend/analyze 업스트림 서버 데드라인 없음** (`routes/videoExtended.ts:115,158,191,254`) — AbortSignal.timeout 결합.
- **B6 Card News 카드 수/동시성 무제한** (`lib/cardNewsGenerator.ts:141,154`) — 상한 적용.
- **B7 generate `requestId`/prompt 검증 미흡, body 50MB** (`routes/generate.ts:49,114`) — normalizeRequestId 재사용 + 스키마.
- **B8 다운로드 크기 검증이 Content-Length 신뢰** (`lib/grokImageCore.ts:154-160`) — 스트리밍 바이트 카운팅.

### P2
- B9 sidecar 실패 무음 (`lib/atomicWrite.ts:9`), B10 미디어/sidecar 비원자 쌍
  (cardNews/canvasVersion/localImport/videoExtended), B11 업스트림 에러 바디
  원문 반환 (`routes/videoExtended.ts:159,192,269`), B12 중앙 JSON 404/에러
  미들웨어 부재 (`server.ts:167`), B13 historyIndex 무효화 레이스
  (`lib/historyIndex.ts:25,42`).

### 확인된 방어선
loopback 기본, video read는 realpath 격리+100MB 한도, SSE 512 연결 캡+하트비트,
inflight 글로벌 캡+TTL, 구조화 로깅 시크릿 리댁션, 키 파일 0600.

## 프론트엔드 (Parfit)

### P0
- **U1 세션 전환 시 노드 그래프 변경 무음 소실**: `switchSessionImpl`이
  flushGraphSave 실패를 "failed"로 삼키고 다른 세션 로드.
  `storeSessionImpl.ts:45`, `storeGraphSave.ts:263,289`.

### P1
- U2 초기 세션 로드 실패 → 설명 없는 빈 워크스페이스 (`storeSessionImpl.ts:21`).
- U3 Generation Log fetch 거부 unhandled + 빈 상태로 위장 (`GenerationRequestLogPanel.tsx:14`).
- U4 갤러리 세션 뷰 fetch 실패 은닉 + stale 데이터 (`GalleryModal.tsx:112,186`).
- U5 세션 그룹 갤러리 500개 고정 한도, 커서 없음 (`GalleryModal.tsx:117,459`).
- U6 비디오 플래너 설정 PATCH가 response.ok 미확인 낙관 갱신 (`VideoControlsPanel.tsx:70`).
- U7 V2V→T2V 무음 강등 (last frame 추출 실패 삼킴) (`storeVideoImpl.ts:45`).
- U8 클립보드 fire-and-forget + 무조건 성공 토스트 (`ResultActions.tsx:136`, `Canvas.tsx:83`).
- U9 모바일 우패널 backdrop `pointer-events:none`으로 닫기 불능 (`RightPanel.tsx:74`, `responsive-mobile.css:226`).
- U10 모바일 우패널/모달 focus trap·Escape·복귀 부재 (ProviderReadiness/Onboarding/ApiDisabled/MetadataRestore 등).
- U11 Prompt Builder 첨부 실패 무피드백 (`promptBuilderStore.ts:92`).

### P2
- U12 i18n 우회 문자열 다수 (Continuity, Active prompt, DRAG, Toast dismiss 등).
- U13 첨부 전용 fallback 지시문 영어 하드코딩 (`promptBuilderStore.ts:101,151`).
- U14 우패널 탭 라벨 truncation + title 부재 (`right-panel.css:48`).
- U15 미지원 드롭 무음 no-op (`Canvas.tsx:140`).
- U16 노드 액션 lock/stale 무음 no-op (`storeNodeGenImpl.ts:37`).
- U17 세션 그룹 갤러리 최대 500 타일 무가상화 + `<video>` 마운트 (`GalleryModal.tsx:117,448`).

## WP9 우선순위 (수정 대상)

1. B1 (P0 보안) · 2. U1 (P0 데이터 소실) · 3. U6+U7 (비디오 무음 실패 —
   goal의 비디오 UX 축) · 4. B4+B5 (키 레이스/데드라인) · 5. U2+U3+U4 (fetch
   에러 상태) · 6. U9+U10 (모바일 backdrop/focus) · 7. B12 (중앙 에러 미들웨어)
   · 8. U8 (클립보드) · 9. B3 (심링크) · 10. B6+B7 (입력 상한).
