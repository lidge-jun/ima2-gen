---
title: "032 — WP-C 실행 기록: 번역·빈 상태 후속"
lane: "260726_zero-backlog-frontend-qa"
wp: 3
record: C
completed: 2026-07-26
commits: [ff366ad, 5323ab3]
---

# WP-C 실행 기록

`ff366ad i18n: translate the element panel and stray hardcoded labels`에서 시작한 번역
정리를 `5323ab3 fix: 빈 상태와 한국어 UI 문구를 정돈`에서 활성 표면까지 확장했다.

## 결과

- Home recent는 history 0에서도 heading과 `role="status"` 빈 상태를 유지한다.
- Quota 계정 전환의 idle/starting/waiting/copied/complete/error, API key·Vertex
  저장/삭제/네트워크 실패 문구가 en/ko dictionary에서 나온다.
- 순수 mention/chip 모듈은 i18n을 import하지 않고 caller-provided label을 받는다.
- Assets·Asset Gen·Card News의 heading/empty 설명은 실제 CSS owner에서 줄바꿈을
  보호한다.
- `settings.apiKeys.saved`의 체크 글리프를 제거하고 locale/CSS 글리프 회귀 계약을
  추가했다.

## 검증 영수증

```text
npm run typecheck
npm run typecheck:tests
npm --prefix ui run build
node --import tsx --test tests/mobile-composer-tray-contract.test.js tests/assets-workspace-polish-contract.test.ts tests/asset-gen-keying-preview-contract.test.js tests/card-news-42-43-contract.test.js tests/element-mention-ui-contract.test.js tests/i18n-coverage-contract.test.ts tests/ui-glyph-policy.test.ts tests/settings-i18n-state-contract.test.ts
pass 56 / fail 0
```
