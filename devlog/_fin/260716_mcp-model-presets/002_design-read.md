# 002 — Design Read

```yaml
---
name: ima2-gen MCP model presets
colors:
  primary: existing neutral dark studio tokens
  accent: existing single selection accent
  background: existing right-panel surfaces
typography:
  heading: existing compact UI stack
  body: existing UI stack with mono metadata/control values
iconography:
  system: existing project vocabulary
  weight: existing
  domain: no new icons
---
```

반복 사용되는 로컬 생성 스튜디오다. 모델 선택은 상단 `|provider|model|`이 소유하고, Settings는 선택 결과의 capabilities만 보여주는 inspector/editor 역할을 맡는다. 기존 우측 model button grid를 제거해 선택기가 두 군데인 문제를 없앤다.

- Do: 선택 모델 요약, provider-default Auto, capability가 있는 field만 조건부 표시, duration/resolution/ratio를 한눈에 스캔 가능한 compact rows, raw input role을 작은 기술 태그로 표시, loading/error/locked 의미 유지.
- Don't: 모델 grid 반복, preset마다 card, 새 modal/wizard, capability가 없는 값을 추측, catalog effect가 Zustand를 계속 동기화하는 구조.
- Concept generation skip: 기존 구현과 governing dark studio design이 확정된 D5/D8 utility control 수정이다. 표현형/브랜드 surface가 아니므로 bitmap concept pass가 제품 판단을 개선하지 않는다.

```text
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 2
Product density profile: D5 (right settings), D8 vocabulary (technical values)
VISUAL_DENSITY: 8
Reasoning: repeated-work creative control surface라 예측 가능한 고밀도와 짧은 state feedback이 우선이다.
```

## Interaction contract

- 모델은 상단 custom Select 한 곳에서만 바꾼다.
- Settings는 selected model label/description을 보여준 다음 Aspect ratio, Duration, Resolution, Quality/Mode 같은 provider-declared preset rows를 렌더한다.
- 6개 이하 options는 기존 option-button fill state, 그보다 많거나 numeric range가 길면 기존 shared Select skin을 쓴다.
- optional parameter의 Auto는 key omission이다. provider가 default를 선언한 모델을 처음 고르면 그 default가 active preset이 된다.
- 추가 enum/bool parameter는 `<details>`의 Advanced presets로 내려 top-level decision 수를 줄인다. 입력 roles는 read-only tags이며 아직 ima2 route가 소비하지 못하는 role을 generation support로 오인시키지 않도록 “Tool inputs”로 표시한다.
- Higgsfield는 presets를 탐색할 수 있지만 locked notice와 generation double guard를 유지한다.

