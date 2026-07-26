# 00 Model Selector Visibility 개선

Date: 2026-06-01
Range: 00 (research/spec)
Scope: sidebar header model selector trigger 시각적 인지성 개선

---

## 1. Problem

사이드바 헤더에 모델 선택 버튼이 존재하지만, 사용자가 해당 요소를 인지하지 못하는 문제가 있었다.

- trigger 텍스트가 배경과 동일한 투명도로 렌더링되어 사실상 보이지 않음
- border, background 등 시각적 경계(visual affordance)가 전혀 없음
- 버튼인지 label인지 구분 불가 -- 클릭 가능하다는 힌트가 없음
- 사용자가 "모델 전환 기능이 없다"고 오해하는 경우 발생

## 2. Root Cause

기존 `.image-model-select__trigger`는 sidebar variant에서 다음과 같은 상태였다:

- `background: transparent` -- 배경과 완전히 동화
- `border: none` -- 요소 경계 없음
- `color`만 존재하나 주변 텍스트와 동일한 색상으로 구분 불가
- dropdown임을 나타내는 chevron/arrow 등 affordance 부재
- 현재 적용된 quality/size 설정값이 표시되지 않아 상태 확인도 불가

## 3. Solution

pill-shaped button styling을 적용하여 trigger를 명시적인 interactive element로 전환했다.

변경 사항 요약:

1. **Blue border** -- `border: 1.5px solid var(--blue)` 적용. 배경과 명확히 구분되는 파란색 테두리
2. **Chevron indicator** -- trigger 우측에 `▾` 문자를 추가하여 dropdown affordance 제공
3. **Args summary line** -- trigger 하단에 `{med · 1024²}` 형태로 현재 quality + size 표시
4. **Pill styling** -- `border-radius: 8px`, `padding: 4px 10px`, `background: var(--accent-soft)`
5. **Interactive states** -- hover/focus-visible/expanded 상태에서 `border-color: var(--accent-bright)` 전환

## 4. Changed Files

| 파일 | 변경 내용 |
|---|---|
| `ui/src/components/ImageModelSelect.tsx` | sidebar variant trigger를 2-line pill 구조로 재구성. 상단(`__trigger-top`): model label + separator + reasoning effort + chevron. 하단(`__trigger-args`): `{quality · size}` 요약. `argsLabel` 계산 로직 추가 (`shortQuality`, `shortSize` 변환). |
| `ui/src/index.css` | `.image-model-select__trigger--pill` 및 하위 요소(`__trigger-top`, `__trigger-chevron`, `__trigger-args`, `__trigger-separator`, `__trigger-effort`) CSS 규칙 신규 추가. hover/focus/expanded 상태 스타일. mobile breakpoint 대응. |

## 5. Design Decisions

### 5-1. Blue border를 선택한 이유

- `var(--blue)`는 dark theme(`#4a9eff`)과 light theme(`#2563eb`) 모두에서 배경 대비 높은 contrast ratio를 가짐
- 기존 디자인 시스템에서 interactive/clickable 요소에 blue를 사용하는 패턴과 일관성 유지
- green(reasoning), amber(warning), red(error) 등 다른 semantic color와 충돌하지 않음
- hover/expanded 시 `var(--accent-bright)`로 전환하여 상태 변화를 시각적으로 전달

### 5-2. Args summary를 추가한 이유

- 모델명만으로는 현재 생성 설정(quality, size)을 알 수 없음
- Settings 패널을 열지 않고도 sidebar에서 즉시 현재 상태 확인 가능
- `{med · 1024²}` 형태의 compact notation으로 공간 효율 확보
- `shortQuality` 변환: `medium` -> `med`, `low` -> `low`, 그 외 그대로
- `shortSize` 변환: `1024x1024` -> `1024²`, `1536x1024` -> `1536x1024`, `auto` -> `auto`

### 5-3. Chevron(`▾`)을 추가한 이유

- dropdown/select 요소의 보편적 affordance -- "이 요소를 누르면 선택지가 펼쳐진다"
- SVG icon 대신 Unicode 문자(`▾`)를 사용하여 추가 asset 없이 구현
- `font-size: 9px`, `opacity: 0.5`로 모델명보다 시각적 비중을 낮춤
- 접근성: `aria-hidden="true"` 처리하여 screen reader에서 중복 읽기 방지

## 6. Before / After

### Before (기존)

```
  grok+·med              <- 배경과 동화, 경계 없음, 클릭 가능 여부 불명
```

텍스트만 존재하고 border/background/chevron이 전혀 없어 interactive element로 인식 불가.
quality/size 설정값도 표시되지 않음.

### After (개선 후)

```
┌────────────────┐
│ grok+ · med  ▾ │  <- blue border (1.5px solid var(--blue))
│  {med · 1024²} │  <- args summary (font-size: 9px, color: var(--text-faint))
└────────────────┘
```

- pill-shaped container: `border-radius: 8px`, `padding: 4px 10px`
- 상단 행: model shortLabel + separator(`·`) + reasoning effort + chevron(`▾`)
- 하단 행: `{quality · size}` compact notation
- Grok provider 사용 시 reasoning effort 및 separator 숨김 (Grok API에 reasoning 파라미터 없음)

### Hover / Focus / Expanded 상태

```
┌────────────────┐
│ grok+ · med  ▾ │  <- border-color: var(--accent-bright)
│  {med · 1024²} │     background: var(--accent-soft)
└────────────────┘
```

## 7. Mobile 대응

`ui/src/index.css` 내 mobile breakpoint에서 `.mobile-app-bar .image-model-select__trigger--pill`에 대한 별도 규칙이 존재하며, reasoning separator/effort 레이블은 좁은 화면에서 숨김 처리된다.

---

Status: implemented / shipped
