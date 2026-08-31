---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, typography]
---

# 020 - wp3: 음수 letter-spacing과 뷰포트 스케일 타입 제거

> 감사 3라운드 F4로 재작성. 사다리 값을 구현으로 미루지 않고 **여기서 확정**했다.
> 값을 확정하지 않으면 테스트가 "뷰포트 단위 없음"만 보게 되어 전부 8px로 줄여도
> 통과한다. 자기완결 문서.

## 목표

스킬이 금지하는 두 가지를 없앤다. letter-spacing은 0 이상, font-size는 뷰포트
너비에 비례하지 않게. 덧붙여 현재 CSS에 있는 **브레이크포인트 역전 버그** 두 개를
같이 고친다.

## 대상 1: 음수 letter-spacing 8곳

| 위치 | 현재 | 조치 |
|---|---|---|
| ui/src/styles/right-panel.css:300 | -2px | 선언 제거 |
| ui/src/styles/sidebar.css:56 | -0.04em | 선언 제거 |
| ui/src/styles/responsive-mobile.css:119 | -0.04em | 선언 제거 |
| ui/src/styles/home-workspace.css:41 | -0.02em | 선언 제거 |
| ui/src/styles/responsive-mobile.css:167 | -0.02em | 선언 제거 |
| ui/src/styles/canvas-viewer.css:75 | -0.01em | 선언 제거 |
| ui/src/styles/gallery-modal.css:132 | -0.01em | 선언 제거 |
| ui/src/styles/form-controls.css:279 | -0.3px | 선언 제거 |

여덟 곳 전부 **선언 제거**입니다. 앞선 판은 이 표에서 일곱 곳을 "0"으로 적고
아래 상세 표에서는 "선언 제거"로 적어 서로 달랐습니다(감사 wp3a3-F2). 테스트가
"음수 선언 0개"만 보므로 둘 다 통과해서 구현 결과가 갈릴 수 있었습니다.
`letter-spacing: 0`을 남기면 상속을 끊는 의미가 되어 의도와 다르므로 제거로
통일합니다.

-2px는 .canvas-empty(ui/src/styles/right-panel.css:295, 48px 700)에 붙어 있다.
TSX 전체에서 canvas-empty 클래스를 렌더하는 곳이 없다 - 죽은 스타일이라 제거해도
시각 변화가 없다.

나머지 7곳은 선언을 지우면 글자 폭이 늘어난다. "넘치면 1px 줄이거나 min-width를
더한다"는 앞선 판의 처방은 두 조치가 **서로 다른 문제**를 푸는데 하나로 묶어
구현자에게 판단을 떠넘겼습니다(감사 wp3a1-F2). 셀렉터별로 확정합니다.

| 위치 | 셀렉터 | 위험 | 처방 |
|---|---|---|---|
| `ui/src/styles/canvas-viewer.css:75` | `.settings-header h2` | **높음** | 선언 제거 + `.settings-header > div { min-width: 0; }` 추가 |
| `ui/src/styles/responsive-mobile.css:119` | `.settings-header h2` (모바일 28px) | **높음** | 같은 처방에 묶는다. 위 래퍼 규칙 하나가 두 폭을 다 덮는다 |
| `ui/src/styles/home-workspace.css:41` | `.home-hero__title` | **높음** | 선언 제거 후 en/ko/zh-Hans/zh-Hant 실측. 넘치면 `overflow-wrap: anywhere`를 더한다. **1px 축소는 구조적 해결이 아니라 금지** |
| `ui/src/styles/responsive-mobile.css:167` | `.settings-section__header h3` | 낮음. 17px 섹션 제목 | 선언 제거만 |
| `ui/src/styles/sidebar.css:56` | `.logo-title` | 낮음. 고정 문자열 | 선언 제거만 |
| `ui/src/styles/gallery-modal.css:132` | `.gallery__title` | 낮음. 16px 짧은 제목 | 선언 제거만 |
| `ui/src/styles/form-controls.css:279` | `.generate-btn` | 낮음. 버튼 폭이 문자열보다 넉넉하다 | 선언 제거만 |

앞선 판은 `ui/src/styles/responsive-mobile.css:119`를 로고,
`ui/src/styles/responsive-mobile.css:167`을 hero title로 적었는데 둘 다
틀렸습니다(감사 wp3a2-F1). 실제로는 `.settings-header h2`의 모바일 오버라이드와
`.settings-section__header h3`입니다. 그리고 `.settings-header`의 flex item은 h2가
아니라 h2를 감싼 `<div>`입니다(`ui/src/components/SettingsWorkspace.tsx:138`).
h2에 `min-width:0`을 줘도 flex overflow가 안 풀립니다 — 래퍼에 줘야 합니다.

`-2px`(`ui/src/styles/right-panel.css:300`)는 위에서 확인한 죽은 스타일이라 제거만
합니다.

## 대상 2: 뷰포트 단위 타입 7곳

grep이 font-size만 봐서 font 축약 2개를 놓쳤다. 실측 7개 전부:

| 위치 | 속성 | 현재 |
|---|---|---|
| ui/src/styles/home-workspace.css:24 | font | 700 clamp(84px, 13vw, 176px) / 0.78 |
| ui/src/styles/home-workspace.css:40 | font | 700 clamp(24px, 2.8vw, 34px) / 1.08 |
| ui/src/styles/home-workspace.css:188 | font-size | clamp(20px, 2.5vw, 26px) |
| ui/src/styles/home-workspace.css:373 | font-size | clamp(84px, 22vw, 150px) |
| ui/src/styles/home-workspace.css:398 | font-size | clamp(64px, 26vw, 104px) |
| ui/src/styles/home-workspace.css:399 | font-size | clamp(26px, 8vw, 32px) |
| ui/src/styles/assets-workspace.css:45 | font-size | clamp(36px, 7vw, 72px) |

## 현재 실효 값 계산 (캐스케이드 반영)

.home-hero__mark는 세 곳에서 정의되고 미디어쿼리 특이성상 480 이하 > 768 이하 >
기본 순으로 이긴다. 실제로 렌더되는 값:

| 뷰포트 | .home-hero__mark | .home-hero__title |
|---|---|---|
| 320 | 83 | 26 |
| 480 | 104 | 32 |
| 481 | 106 | 24 |
| 767 | 150 | 24 |
| 768 | 150 | 24 |
| 769 | **100** | 24 |
| 1279 | 166 | 34 |
| 1280 | 166 | 34 |
| 1920 | 176 | 34 |

**역전 두 개가 실재한다.** 창을 1px 넓히면 마크가 768에서 150px, 769에서 100px로
50px 작아진다. 타이틀은 480에서 32px, 481에서 24px로 8px 작아진다. 둘 다 버그다.

## 확정 사다리

경계는 셀렉터마다 다릅니다. mark는 480/1024/1279, glyph는 480/768/1279,
title은 480/1279, h2는 1279만 씁니다(감사 wp3a2-F2 — 앞선 판이 "나머지 셋은
480/768"이라고 적었는데 768을 쓰는 것은 glyph뿐입니다).
값은 320~1920을 1px 단위로 전수 계산해 최대 이탈이 최소가 되도록 골랐습니다.
**모든 이탈과 경계 점프를 아래에 전부 공개합니다.**

**.home-hero__mark** (ui/src/styles/home-workspace.css:24 / :373 / :398)

| 범위 | 새 값 |
|---|---|
| <= 480 | 100px |
| 481~1024 | 125px |
| 1025~1279 | 150px |
| >= 1280 | 176px |

경계 점프: 480->481 **+25**, 1024->1025 **+25**, 1279->1280 **+26**.
최대 이탈: 769에서 **25.03px**.

**경계를 768에서 1024로 옮겼습니다**(감사 wp3a1-F1). 앞선 판은 480/768/1279
경계에 96/128/144/176을 놓아 이탈 44.03px, 점프 32px이었습니다. 경계 위치를
바꾸면 구간 수를 늘리지 않고도 이탈이 25.03px, 점프가 26px로 줄어듭니다.
구간은 그대로 4개라 유지 비용이 늘지 않습니다.

감사자는 96/125/150/176(경계 480/768/1024/1279, 5행)을 제안했습니다. 이탈은 같은
25.03px인데 481에서 점프가 29px입니다. 그 안은 2번과 3번 구간 값이 같아서 실질적으로
3경계 사다리이고, 하단을 96에서 100으로 올리면 같은 이탈에 점프만 26px로 줄어듭니다.
480/1024/1279 경계에서 단조 사다리를 전수 탐색하면 이탈 최소가 25.03px이고 그 안에서
점프 최소는 26px입니다. 중간/상단을 125/150/176으로 고정하면 하단은 **99~108**이
모두 그 최적값을 만족하므로(감사 wp3a2-F3) 100은 유일해가 아니라 그 구간에서 고른
읽기 쉬운 값입니다.

769에서 25px가 남는 것은 근사 오차가 아닙니다. 현재 CSS가 768에서 150px, 769에서
99.97px로 **떨어지는** 버그라서, 단조성을 지키는 사다리는 그 두 값 사이에 낀 값을
고를 수밖에 없습니다. 768쪽에 맞추면 769에서 벌어지고 769쪽에 맞추면 768에서
벌어집니다. 이 구조에서 이론적 최소 최대 이탈은 약 25.02px이고, 위 사다리는
25.03px로 사실상 그 하한에 붙어 있습니다.

앞선 판이 검토했던 "6구간 최대 이탈 18px" 대안은 실제로 계산해보면 146 -> 117px로
**감소하는** 비단조 사다리였습니다(감사 wp3a1-F1). 단조성이 목표의 일부이므로
애초에 후보가 아니었습니다. 구간 수를 늘리는 대신 경계를 옮기는 편이 같은 유지
비용으로 더 나은 값을 줍니다.

**4구간 + 최대 이탈 25.03px + 최대 점프 26px로 확정**합니다.

구현 위치도 못 박습니다(감사 wp3a2-F2). `ui/src/styles/home-workspace.css`에
1024 쿼리가 없으므로 새로 만듭니다. 저장소 전체에 `max-width: 1024px` 쿼리는
0건이고 1280 쿼리는 `ui/src/styles/agent-workspace-sidebar.css:41` 한 건뿐이라
추가는 순수 가산이고 기존 캐스케이드를 건드리지 않습니다.

| 위치 | 값 |
|---|---|
| 기본(`ui/src/styles/home-workspace.css:24` 축약) | 176px |
| `@media (max-width: 1279px)` | 150px |
| `@media (max-width: 1024px)` | 125px |
| `@media (max-width: 480px)` (`ui/src/styles/home-workspace.css:398`) | 100px |

기존 `@media (max-width: 768px)` 안의 mark 선언(`ui/src/styles/home-workspace.css:373`)은 **삭제**합니다.
남겨두면 481~768에서 768 쿼리가 1024 쿼리보다 나중에 선언돼 이기므로 사다리가 깨집니다.

### 반올림 정책

clamp의 유동 구간은 정수가 아니므로 이탈도 정수가 아닙니다(mark는 769에서 25.03px).
상한을 25로 두고 정확 산술로 비교하면 0.03 때문에 실패합니다. 정책을 못 박습니다:
**이탈 비교는 소수 둘째 자리까지 계산하고 상한에 0.5px 여유를 둡니다.** 즉 상한은
mark 25.5 / title 6.5 / h2 4.5 / glyph 16.5입니다. 0.5는
서브픽셀 반올림 폭이고, 실제 위반(값 하나를 8px로 바꾸는 등)은 수십 px 단위라
이 여유로 가려지지 않습니다.

**.home-hero__title** (ui/src/styles/home-workspace.css:40 / :399)

| 범위 | 새 값 |
|---|---|
| <= 480 | 28px |
| 481~1279 | 30px |
| >= 1280 | 34px |

경계 점프: 480->481 **+2**, 1279->1280 **+4**. 최대 이탈: 481에서 **6px**.

**.home-workspace h2** (ui/src/styles/home-workspace.css:188)

앞선 판이 이 셀렉터를 표에서 빠뜨렸다. 현재 clamp(20px, 2.5vw, 26px)이다.

| 범위 | 새 값 |
|---|---|
| <= 1279 | 22px |
| >= 1280 | 26px |

경계 점프: 1279->1280 **+4**. 최대 이탈 **4px**. 앞선 판의 20/24안은 1279에서
-6px이었고 상한도 26 -> 24로 줄여서 넓은 화면 제목이 작아졌다. 22/26이 더 낫다.

**.assets-tile__glyph** (ui/src/styles/assets-workspace.css:45)

| 범위 | 새 값 |
|---|---|
| <= 480 | 40px |
| 481~768 | 52px |
| 769~1279 | 64px |
| >= 1280 | 72px |

경계 점프: 480->481 **+12**, 768->769 **+12**, 1279->1280 **+8**.
최대 이탈: 481에서 **16px**. 앞선 판의 3구간 40/56/72안은 1279에서 -16px로
글리프가 **작아졌는데**, 4구간으로 나눠 그 감소를 없앴다.

## 이탈 상한과 점프 상한

테스트가 단조성만 보면 값이 조금씩 이상해져도 통과한다. 그래서 두 상한을 계약으로
박는다.

- 각 셀렉터의 **최대 이탈** 상한(0.5px 여유 포함): mark 25.5px, title 6.5px,
  h2 4.5px, glyph 16.5px. 경계를 옮긴 뒤로는 mark에 예외 구간이 필요 없어서
  "역전 구간 제외" 두 번째 상한도 없앴습니다.
- 각 셀렉터의 **최대 경계 점프** 상한: mark 26px, title 4px, h2 4px, glyph 12px.
- 모든 경계에서 값이 감소하지 않을 것(단조).

## 사다리를 계단으로 쓰는 이유

유동 타입은 뷰포트 폭에 비례해 글자가 커지므로, 같은 콘텐츠가 화면마다 다른 크기로
보인다. 반복 작업 도구에서는 크기가 예측 가능한 편이 낫고, 스킬도 뷰포트 비례
스케일링을 금지한다. 계단은 경계에서만 바뀌므로 캡처와 회귀 검증이 가능하다.

## 테스트: tests/ui-typography-rules-contract.test.ts

값을 확정했으니 테스트도 값을 본다. "뷰포트 단위 없음"만 보면 전부 8px로 줄여도
통과한다(감사 F4).

- letter-spacing 음수 선언 0개 단언.
- font-size **그리고** font 축약 둘 다 파싱해 vw/vh/vmin/vmax가 없는지 단언.
  축약을 빼면 false green이 된다.
- 위 사다리 표의 각 (셀렉터, 범위, 값)을 상수로 두고 CSS에 그 값이 그 미디어쿼리
  안에 선언돼 있는지 단언. 임의 값으로 바꾸면 실패한다. **네 셀렉터 전부**
  포함한다(h2 누락 재발 방지).
- 경계 단조성 단언: 사다리 값이 뷰포트가 커질 때 감소하지 않는지 확인.
- **이탈 상한 단언**: 각 셀렉터의 현재 clamp 식을 테스트 안에 기록해 두고,
  320~1920을 1px 단위로 계산해 사다리 값과의 차가 위 상한(0.5px 여유 포함)을
  넘지 않는지 확인. mark도 단일 상한 하나만 검사합니다 — 경계를 옮겨 예외 구간이 사라졌습니다.
- **점프 상한 단언**: 인접 구간 값 차가 위 상한을 넘지 않는지 확인.
- 변형 증명 6개: -0.01em 되살리기, font-size에 vw 되살리기, **font 축약에 vw
  되살리기**, 사다리 값 하나를 8px로 바꾸기(이탈 상한 위반), mark 상단 구간을 120px로
  낮추기(점프는 통과하지만 이탈 상한 위반), 경계를 1024에서 768로 되돌리기
  (이탈 상한 위반).

## overflow 판정은 wp3에서 한다 (감사 wp3a1-F3)

앞선 판은 완료 조건에 "아홉 폭에서 잘리지 않음"을 적어 두고 실제 기하 검사는
`devlog/_plan/260831_ui_polish_round/060_wp7_design_md_and_render_proof.md:69`에만
뒀습니다. 그러면 letter-spacing 보정이 필요한지가 wp7까지 미결이라 wp3 구현을
닫을 수 없습니다. 위 표의 "넘치면 `overflow-wrap: anywhere`" 같은 조건부 처방은
렌더 결과가 있어야 결정됩니다.

그래서 **binary overflow 판정을 wp3 C단계 게이트로 올립니다.** 브라우저에서 **열한 폭**
(320/480/481/767/768/769/**1024/1025**/1279/1280/1920)을 열고 확인합니다. 1024/1025는
새 mark 경계의 양쪽이라 빠지면 그 경계를 검증하지 못합니다(감사 wp3a2-F2):

- 네 사다리 요소의 computed `font-size`가 확정 표와 일치
- 네 사다리 요소와 letter-spacing 7곳에서 `scrollWidth <= clientWidth`
- 최소 en / ko / zh-Hans / zh-Hant 네 로케일의 실제 문자열로

**예외 (감사 wp3c3에서 확정):**

- **.home-hero__mark 320px clipping**: scrollWidth(269) > clientWidth(246)이지만
  이 요소는 `overflow: hidden; position: absolute; z-index: -1; aria-hidden: true;
  color: transparent`인 장식용 워터마크. 의도된 클리핑이며 레이아웃에 영향 없음.
- **.assets-tile__glyph null**: 빈 에셋 스토어에서는 타일이 렌더되지 않음.
  CSS 선언은 정적 계약 매니페스트(ui-typography-rules-contract.test.ts:188)로 잠금.
  실제 computed 측정은 에셋 fixture가 있는 wp7 렌더 증거에서 수행.
- **.home-workspace h2 선택자**: `.home-workspace__recent > h2`만 사다리 대상.
  `.home-modes__title`(11px, `!important`)는 의도적 별도 스타일.

스크린샷 보관과 before/after 종합 비교는 wp7에 남깁니다. 여기서 필요한 것은
판정이고, 아카이브가 아닙니다.

## 완료 조건

두 규칙 위반 0개, 사다리 값이 표와 일치(네 셀렉터 전부), 이탈/점프 상한 통과,
위 열한 폭 x 네 로케일에서 computed font-size 일치와 overflow 0건.
위 예외 3건은 근거가 확인된 것으로 overflow 0건 집계에서 제외.
스크린샷 아카이브는 wp7.

**wp3에서 검증하는 computed font-size**: mark, title, .home-workspace__recent > h2
(3개). glyph는 빈 스토어로 렌더 불가하므로 computed 측정을 wp7로 이관.
CSS 선언은 정적 매니페스트로 wp3에서 잠금.
