---
title: "031 — WP-B 실행 기록: 문자 아이콘 정리"
lane: "260726_zero-backlog-frontend-qa"
wp: 3
record: B
completed: 2026-07-26
commit: 075a8cc
---

# WP-B 실행 기록

`075a8cc ui: replace pencil and check dingbats with shared SVG icons`에서 문자 기반
편집·확인 affordance를 공용 SVG owner로 옮겼다.

## 결과

- 공용 owner: `ui/src/components/controls/EditIcon.tsx`,
  `ui/src/components/controls/CheckIcon.tsx`
- 회귀 계약: `tests/ui-glyph-policy.test.ts`
- 즐겨찾기·저장 동작은 서로 다른 의미와 ARIA 상태를 유지한다.
- 2026-07-26 후속 검증에서 컴포넌트, locale JSON, CSS `content:`까지 금지
  dingbat가 0건임을 다시 확인했다 (`5323ab3`).

## 검증 영수증

```text
node --import tsx --test tests/ui-glyph-policy.test.ts
pass 8 / fail 0
```
