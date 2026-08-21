# 030 — 테마 토큰 인프라 (wp3)

## 목표

라이트 모드 전제조건: 51개 CSS 파일의 하드코딩 hex 145건을 시맨틱 토큰으로 수렴.

## 계획

- `ui/src/index.css` `:root` 토큰 확장: 기존 --bg/--surface/--text 계열 유지 +
  누락 시맨틱 토큰 추가 (--overlay, --scrim, --shadow-color, --success/--warn/--danger 계열)
- **인벤토리 경계 (감사 반영)**: 대상은 `ui/src/index.css` + `ui/src/styles/*.css`
  (51개 파일, hex 145건 — `rg -c '#[0-9a-fA-F]{3,8}'` 기준)로 한정한다.
  `ui/src` 밖(site/, 컴포넌트 inline 스타일)은 이 WP 범위 밖이며, 발견 시
  목록만 기록하고 다음 라운드로 넘긴다.
- 각 styles/*.css의 rgba(255,255,255,*) / rgba(0,0,0,*) / #hex를 var()로 치환
  - 우선순위: canvas-mode, nav-rail, controls, settings, gallery (사용자 노출 최대)
  - 예외(치환하지 않음): 로고/브랜드 고정색, 체커보드 패턴색, provider 브랜드색,
    캔버스 위 주석 팔레트(사용자 선택색) — 예외 목록을 B-phase에서 명시 기록
- `ui/src/styles/themes.css`의 canvas/minimap 토큰을 :root로 흡수 or data-theme 대응

## 검증

- 다크 모드 시각 회귀 없음 (chrome 스크린샷 before/after 비교)
- typecheck + ui build + 잔여 하드코딩 hex 카운트 리포트 (145 → 목표 <30)
