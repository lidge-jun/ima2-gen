# 060 — UI/UX 개선 라운드 1 (wp6)

## 방법

- opus(claude-opus-5) 서브에이전트를 감사자로 파견: cxc-dev-uiux-design +
  ima2-front 체크리스트(앤티슬롭, 밀도 D4-D5, 타이포, a11y)를 기준으로
  chrome 스크린샷 세트를 감사시킨다
- 지적사항을 심각도로 정렬, 상위 항목(P1/P2)을 이 사이클에서 구현
- 대상 후보(연구 시점 추정): 호버/포커스 일관성, 빈 상태(empty state) 카피,
  버튼 대비, 캔버스 툴바 밀도, 모바일 폭 검증

## 검증

- before/after 스크린샷 + opus 재검토 PASS + typecheck/build
