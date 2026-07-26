---
created: 2026-07-11
tags: [ima2-gen, hardening, implementation]
---

# WP3/WP6/WP7/WP9 구현 기록 (sol worker 병렬 라운드)

메인 세션이 계약(020 스펙)을 고정하고, 쓰기 범위가 겹치지 않는 sol 워커들이
같은 워킹 트리에서 병렬 구현. 메인이 통합 검증(structure line-count refresh,
test inventory refresh, 전체 스위트) 수행.

## Round 1 (7 workers)

| Worker | 범위 | 결과 |
|---|---|---|
| Maxwell (W1) | Agent 백엔드: startedAt/progressStage projection, 최근-종료 기준 큐 요약(F5), running 취소+AbortController 레지스트리(F8), 재시작 stale running 복구(F3), 이미지 10분/비디오 30분 타임아웃 | agent 테스트 76/76, 신규 큐 계약 테스트 |
| Carver (W2) | 워크스페이스: 모바일 Studio 복귀(F1), 큐 칩+모바일 큐 시트(F2), 부트스트랩 에러+재시도(F6), mutation 토스트, 폴링 레이스 가드+1500/4000ms(F13), 저높이 stacked(F16) | tsc/ui:build/계약 13/13 |
| Franklin (W3) | 채팅/큐/프리뷰: 단계+경과시간 상태바(F4), 썸네일 controls 중첩 제거(F7), 비디오 poster/에러/다운로드/duration(F10), running 취소 UI, canceled 뱃지, 큐 카피 인간화(F12), 조건부 auto-scroll(F15), aria-controls/live region(F18), 빈 상태 비디오 포괄(F9) | agent 계약 17/17 |
| Copernicus (W6) | 백엔드 분할: 4파일 → 전부 500줄 이하 (00_plan 지침 준수 + generators.ts 자체 설계) | 이동 계약 7/7, 소스 계약 20건 갱신 |
| Meitner (W7) | 캔버스 G1 옵션(c): provenance(annotationsBaked/annotationOnly)+벡터 스냅샷, annotation-only 비파괴 복원, 혼합 버전 확인 후 revert | 캔버스 34/34, docs 반영 |
| Boole (W9a) | 백엔드 하드닝: B1 setId 격리(P0), B3 심링크, B4 키 뮤텍스, B5 데드라인, B6 상한, B8 스트리밍 캡, B12 중앙 에러 미들웨어, B13 스캔 세대 카운터 | 집중 회귀 42/42 |
| Averroes (W9b) | 프론트 하드닝: U1 그래프 소실 차단(P0), U2/U3/U4/U5 에러·상한 상태, U6/U7 비디오 무음 실패 제거, U8 클립보드, U9/U10 backdrop+공용 focus trap(useModalFocus), U11 첨부 에러, U14 탭 a11y | 관련 계약 41/41 |

## 메인 통합 검증 (Round 1 착지 후)

- `npm run typecheck` / `npm run typecheck:tests` 통과
- `scripts/refresh-structure-line-counts.mjs` (20건 갱신) + `scripts/classify-tests.mjs`
- **`npm test`: 1116 tests, 1114 pass, 0 fail** (2 skip)

## Round 2 (2 workers)

- Jason (W3b): 260516/260517 잔여 polish — Quality 세그먼트/스테퍼, 모델 칩→
  사이드바 Model 탭 연동, tool compact 계약(32/28px, 3줄 clamp, 400px scroll),
  pane preference 영속화. Refs/Web projection과 forms/style-lock은 future로 disposition.
- Nietzsche (W9c): B7 파이프라인 입력 검증(분할 후 안전), B2 비루프백 바인딩
  opt-in 토큰(IMA2_LAN_TOKEN).
