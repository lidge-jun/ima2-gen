# 040 — 라이트 팔레트 + light/dark/system 토글 (wp4)

## 목표

OKLCH 기반 라이트 팔레트 설계 + `[data-theme]` 전환 + FOWT 방지.

## 팔레트 방향 (cxc-dev-uiux-design color-system 기준)

- 틴티드 뉴트럴: 순백 대신 아주 옅은 냉회색 (bg ≈ oklch(0.97 0.005 270))
- surface 단계 3층, 텍스트 대비 4.5:1 이상 (본문), 3:1 이상 (대형)
- 다크의 --accent(#f0f0f4, 사실상 백색)는 라이트에서 잉크색으로 반전
- focus-ring 등 채도 토큰은 라이트에서 채도/명도 재조정

## 파일 계획

- MODIFY `ui/src/index.css` — `[data-theme="light"] { ... }` 오버라이드 블록
- NEW `ui/src/hooks/useTheme.ts` — themeMode(light|dark|system) 상태 + matchMedia 리스너
- MODIFY `ui/src/store/storeUIImpl.ts` (or settings) — themeMode persist (localStorage)
- MODIFY `ui/index.html` (Vite 엔트리 — 존재 확인됨) — `<head>`에 FOWT 방지
  inline script: localStorage의 themeMode를 읽어 첫 페인트 전
  `document.documentElement.dataset.theme` 세팅; `meta[name=color-scheme]`를
  "dark"에서 "dark light"로 갱신
- MODIFY 설정 UI (`SettingsWorkspace` 계열) — light/dark/system 세그먼트 토글
- MODIFY `ui/src/styles/themes.css` — canvas/minimap 라이트 값

## 검증

- 토글 3상태 chrome 스크린샷, 새로고침 시 플래시 없음, system 변경 반영
