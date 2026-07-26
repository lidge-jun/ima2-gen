---
title: "041 — WP4 실행 기록: 드롭다운·토큰·반응형 클리닝"
lane: "260726_model-defaults-ui-cleaning"
wp: 4
record: D
completed: 2026-07-26
commits: [ba56722]
---

# WP4 실행 기록

Prompt Builder의 hand-rolled 모델 메뉴를 공유 `Select`로 옮기고, 포털
배치·그룹 높이·좁은 화면 탭·장식 gradient와 하드코딩 색상을 함께 정리했다.
계획 문서는 `devlog/_plan/260726_model-defaults-ui-cleaning/040_dropdown_tokens_gradients.md`
에 남겨 활성 유닛의 맥락을 유지했다.

## 결과

- Prompt Builder 모델 선택은 Luna-first `Select<PromptBuilderModel>` +
  `portal`을 쓰고 전용 open/blur/listbox 상태와 skin을 제거했다.
- 공용 Select는 좁은 viewport의 가로 폭, 위/아래 가용 높이, grouped list의
  `scrollHeight`, disabled option Home/End를 처리한다.
- Select와 element mention panel은 solid surface로 바뀌었고 option은 44px,
  명시적 focus-visible을 가진다.
- Asset Gen tablist는 첫 화면에서도 CSS를 직접 로드하며 320px에서 44px target과
  Arrow/Home/End roving focus를 유지한다.
- functional panel의 장식 gradient는 제거하고 checkerboard와 caption scrim처럼
  의미가 있는 gradient는 남겼다.

## 검증 영수증

```text
node --import tsx --test tests/prompt-studio-ui-contract.test.js tests/provider-ui-polish-contract.test.js tests/mcp-settings-states-contract.test.ts tests/element-mention-ui-contract.test.js tests/asset-gen-keying-preview-contract.test.js tests/inflight-popup-polish-contract.test.js tests/model-default-projection-contract.test.ts tests/gpt56-rollout-contract.test.ts
pass 69 / fail 0
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm --prefix ui run build
node scripts/check-devlog-citations.mjs
git diff --check
```

실제 브라우저 QA는 Prompt Builder의 Enter/Space/Arrow/Home/End/Escape/Tab,
선택 뒤 focus return과 `aria-*` 전이를 확인했다. grouped provider menu는
1024×200에서 `opensAbove=true`, `inViewport=true`, grouped label 1개를 기록했다.
Asset Gen 한국어 320/390px tab은 44px target과 가로 오버플로 0을 유지했고
console error는 없었다.
