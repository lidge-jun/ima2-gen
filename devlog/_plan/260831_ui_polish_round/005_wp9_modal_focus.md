---
created: 2026-08-31
tags: [ima2-gen, devlog, ui, a11y, modal]
---

# 005 — wp9: 모달 포커스 계약 (최우선)

> 감사 2라운드 반영본. 인벤토리를 28개로 정정하고, MobileComposeSheet를 모달로
> 재분류하고, 탐색을 AST 기반으로, 그리고 backdrop/inert와 Escape 스택을 범위에
> 넣었습니다.

## 왜 최우선인가

색 토큰과 radius는 보기에 관한 문제입니다. 이건 키보드 사용자가 모달에서 나올 수
없는 문제입니다. `aria-modal="true"`는 보조기술에 "이 밖은 존재하지 않는 것으로
처리하라"고 지시합니다. 포커스 트랩과 Escape가 없으면 스크린리더 사용자는
대화상자 밖으로 이동할 수도, 닫을 수도 없습니다.

## 계약의 구멍

`tests/a11y-modal-contract.test.ts:10`의 `DIALOG_SURFACES`는 손으로 적은
8개 경로 배열입니다. 트리 조사 결과:

```
role="dialog" 리터럴 선언:        26개 파일
조건부 role 포함:                 28개 파일
계약이 직접 검사하는 것:           8개
aria-modal 선언 가능:             24개
공유 포커스 훅이 없는 것:          9개
```

조건부 role 2곳은 정규식으로 못 잡습니다:

```
ui/src/components/RightPanel.tsx:89
  role={isMobile && open ? "dialog" : undefined}
ui/src/components/assets/AssetsWorkspace.tsx:183
  role={isMobile ? "dialog" : undefined} aria-modal={isMobile ? true : undefined}
```

계약 파일 주석은 이미 "Rolling your own Escape listener drops focus trapping and
focus restore"라고 경고합니다. 규칙은 옳았고 적용 범위가 좁았습니다. 기존 8개
테스트는 전부 통과합니다 — false green이 문제였다는 증거입니다.

## 공유 훅을 쓰지 않는 대화상자 (독립 AST 측정으로 정정)

독립 측정 에이전트가 TypeScript 5.9 컴파일러 AST로 전수 조사한 결과, "훅이 없는
9개"라는 앞선 서술은 **부정확했습니다**. 정확히는 두 층으로 나뉩니다. 이 구분이
중요한 이유는, 자체 구현이 일부라도 있는 쪽은 "훅 붙이기"가 아니라 "중복 제거 후
이전"이 되기 때문입니다.

**A. 포커스 관리가 전혀 없음(5개). 초기 포커스/Tab 격리/포커스 복원 셋 다 없음.**

| 컴포넌트 | 현재 상태 | aria-modal |
|---|---|---|
| `ui/src/components/ResultMetadataModal.tsx:237` | 없음 | true |
| `ui/src/components/assetgen/SpriteAnchorGate.tsx:2` | 없음 | true |
| `ui/src/components/assetgen/KeyingPanel.tsx:278` | Escape만 | true |
| `ui/src/components/canvas-mode/CanvasStylePopover.tsx:29` | Escape만 | 비모달 |
| `ui/src/components/UpscalePopover.tsx:31` | 없음 | 비모달 |

앞선 초안이 `UpscalePopover`와 `CanvasStylePopover`를 "비모달 처분" 절로만
보냈는데, 실제로는 포커스 관리가 아예 없는 쪽에 같이 속합니다.

**B. 자체 구현이 일부 있으나 공유 훅이 아님(5개). Tab 트랩이 빠진 것이 공통.**

| 컴포넌트 | 가진 것 | 빠진 것 |
|---|---|---|
| `ui/src/components/PromptImportDialog.tsx:273` | 초기 포커스/복원 :59, Escape :277 | Tab 트랩 |
| `ui/src/components/MobileComposeSheet.tsx:128` | 초기/복원/Escape :66, :89 | Tab 트랩 |
| `ui/src/components/assetgen/ProjectSearchPopup.tsx:32` | 초기 포커스/Escape :13 | 트랩, 복원 |
| `ui/src/components/assets/AssetsWorkspace.tsx:183` | 로컬 훅 :21 (초기/트랩/복원 전부) | 공유 훅 미사용 |
| `ui/src/components/node-canvas/NodeStudioOverlays.tsx:51` | 로컬 `DialogFrame` 트랩/Escape :23 | 공유 훅 미사용 |

`AssetsWorkspace`는 로컬 훅이 이미 세 가지를 다 하므로 a11y 결함이 아니라
**중복 구현**입니다. 공유 훅으로 이전하되, 이전이 회귀를 만들면 면제 목록에
이유와 함께 남기는 편이 낫습니다. `ui/src/components/node-canvas/NodeTemplatePicker.tsx:89`는
부모 `ui/src/components/node-canvas/NodeStudioOverlays.tsx:50`이 트랩을
제공하므로 별도 항목이 아닙니다.

`ui/src/components/MobileComposeSheet.tsx:129`은 열릴 때
`aria-modal="true"`를 냅니다. 앞선 초안에서 비모달로 분류한 건 틀렸습니다.

전체 대화상자 28개, 그중 `aria-modal`이 true가 될 수 있는 것 24개입니다.
공유 훅(`useModalFocus` 또는 `useAgentDialogFocus`)을 **호출**하는 파일은
**16개**이고(그중 15개가 모달, `ui/src/components/agent/AgentRightSidebar.tsx`가
의도적 비모달), 자체/부분 구현 5개, 전무 5개입니다. 앞선 판의 "13개"는
틀렸습니다.

## 분류 매니페스트 (감사 4·5라운드 F1/F5)

두 가지를 섞어 쓰면 테스트가 헐거워집니다(F5). **"훅 호출 면제"와 "트랩 면제"는
다른 것**이라 표를 나눕니다.

### 훅 호출 면제 — 딱 1개

| 컴포넌트 | 이유 |
|---|---|
| `ui/src/components/node-canvas/NodeTemplatePicker.tsx:89` | 부모 `DialogFrame`(`ui/src/components/node-canvas/NodeStudioOverlays.tsx:50`)이 포커스 소유자. 자손이 훅을 또 부르면 핸들러가 중복됨 |

이 하나만 공유 훅 호출이 없어도 통과합니다. 다른 어떤 대화상자도 훅 호출을
생략할 수 없습니다.

### 트랩 면제(비모달) — 4개, 훅 호출은 필수

| 컴포넌트 | 요구 |
|---|---|
| `ui/src/components/agent/AgentRightSidebar.tsx:117` | `trap: false` 호출 **필수**. 훅을 지우면 실패해야 함 |
| `ui/src/components/composer/InFlightPopup.tsx:109` | `trap: false` + 아래 포커스 옵션표대로 |
| `ui/src/components/UpscalePopover.tsx:31` | `trap: false` + Escape/복귀 신규 |
| `ui/src/components/canvas-mode/CanvasStylePopover.tsx:58` | `trap: false` 이전, 자체 Escape 제거 |

`AgentRightSidebar`는 앞선 판에서 "면제"로 적었는데 틀렸습니다. 이미 훅을 부르고
있고, 계속 불러야 합니다.

### 모달 이전 — 무조건

| 컴포넌트 | 분류 | 요구 |
|---|---|---|
| `ui/src/components/assets/AssetsWorkspace.tsx:183` | 모달(모바일만) | 공유 훅으로 이전. 로컬 훅이 초기 포커스/트랩/복원을 다 해도 Escape 스택에 참여하지 않으므로 이전이 필요합니다 |
| `ui/src/components/node-canvas/NodeStudioOverlays.tsx:51` | 모달 | 로컬 `DialogFrame`을 공유 훅 위에 다시 구현. `DialogFrame`이 트랩 소유자를 하나로 모으는 구조라 프레임 내부에서 공유 훅을 호출하면 됩니다 |

회귀를 이유로 나중에 면제를 추가하지 않습니다.

## 훅 옵션을 셋으로 쪼갠다 (감사 5라운드 F6)

`modal` 하나로 모든 동작을 묶으면 비모달 이전이 회귀를 만듭니다. 실제 예:
`ui/src/components/composer/InFlightPopup.tsx:76`은
`focusOnOpen`이 true일 때만 제목에 포커스를 줍니다. 호버로 열릴 때는 일부러
포커스를 훔치지 않고, 키보드로 열 때만 가져갑니다
(`ui/src/components/composer/InFlightBadge.tsx:29`가 그 상태를 들고 있습니다).
`modal: false`만 주고 초기 포커스를 항상 걸면 호버할 때마다 포커스가 튑니다.

그래서 옵션을 독립적으로 둡니다.

`restoreFocus`도 boolean 하나로는 부족합니다(감사 6라운드 F1).
`ui/src/components/composer/InFlightPopup.tsx:15`의 콜백이
`onRequestClose(restoreFocus: boolean)`이고 **닫힌 이유에 따라 값이 다릅니다**:
바깥 포인터 클릭은 `false`(`ui/src/components/composer/InFlightPopup.tsx:83`),
Escape는 `true`(`ui/src/components/composer/InFlightPopup.tsx:88`), 닫기 버튼은
`true`(`ui/src/components/composer/InFlightPopup.tsx:124`).
`ui/src/components/composer/InFlightBadge.tsx:76`의 `closePopup`이 그 값으로
트리거 복귀를 결정합니다. `restoreFocus`를 상수 true로 박으면 사용자가 바깥에서
방금 클릭한 요소에서 포커스를 훔쳐옵니다.

그래서 복귀는 **이유를 받는 함수**도 허용합니다.

```ts
type CloseReason = "escape" | "closeButton" | "outsidePointer" | "programmatic";

type FocusOptions = {
  trap?: boolean;      // Tab 순환 격리. 모달만 true
  autoFocus?: boolean; // 열릴 때 초기 포커스
  restoreFocus?: boolean | ((reason: CloseReason) => boolean);
};
```

| 컴포넌트 | trap | autoFocus | restoreFocus |
|---|---|---|---|
| 모달 (현재 훅 사용 15개 -> 최종 23개) | true | true | true |
| `ui/src/components/agent/AgentRightSidebar.tsx:117` | false | true | true |
| `ui/src/components/composer/InFlightPopup.tsx:109` | false | 호출자 `focusOnOpen` | `r => r !== "outsidePointer"` |
| `ui/src/components/UpscalePopover.tsx:31` | false | true | `r => r !== "outsidePointer"` |
| `ui/src/components/canvas-mode/CanvasStylePopover.tsx:58` | false | true | `r => r !== "outsidePointer"` |

모달 15개는 상수 `true`로 충분합니다. 모달은 backdrop이 바깥 클릭을 막으므로
포커스가 바깥 요소로 갈 수 없고, 어느 경로로 닫혀도 트리거 복귀가 맞습니다.
이유를 보는 것은 비모달 3개뿐입니다.

훅은 자기가 처리하는 Escape에 `"escape"`를 넘기고, 호출자가 닫는 경로는 호출자가
이유를 전달합니다. `InFlightPopup`은 기존 boolean 콜백을 그대로 두고 훅에
`restoreFocus` 함수만 넘기면 되므로 외부 시그니처 변경이 없습니다.

Escape 스택 참여는 위 세 옵션과 무관하게 항상 켭니다 — 그게 이 유닛의 핵심입니다.

비모달에 Escape를 붙이면서 생기는 위험 하나: 지금 `UpscalePopover`는 Escape로
닫히지 않습니다. 붙이면 동작이 늘어나는 방향이라 회귀는 아니지만, 모달 부모 안에
열린 비모달이면 Escape 한 번에 비모달만 닫히고 부모 모달은 남아야 합니다. 스택이
최상위에게만 전달하므로 이게 자동으로 성립하고, 아래 테스트로 고정합니다.

## 비모달 처분

`ui/src/components/agent/AgentRightSidebar.tsx:110`이 올바른 본보기입니다:
`useAgentDialogFocus(..., { modal: false })`에 이유 주석까지 있습니다. WAI-ARIA
APG대로 모달만 트랩합니다.

| 컴포넌트 | 상태 |
|---|---|
| `ui/src/components/agent/AgentRightSidebar.tsx:110` | 정상 (비모달 + 훅 + 이유 주석) |
| `ui/src/components/composer/InFlightPopup.tsx:109` | 정상 (`aria-modal="false"`, 초기 포커스/Escape/복원 있음) |
| `ui/src/components/UpscalePopover.tsx:31` | 포커스 관리 전무 -> 수리 (위 A표) |
| `ui/src/components/canvas-mode/CanvasStylePopover.tsx:29` | Escape만 -> 수리 (위 A표) |

## SpriteAnchorGate: 포커스만으로는 부족하다

스프라이트 앵커 **승인** 확인 모달이고 승인은 되돌리기 어렵습니다. 결함 세 개가
겹칩니다.

- 배경 투명(`--bg-primary` 미정의). wp4 소유.
- 포커스 트랩/Escape 없음. wp9 소유.
- **backdrop과 inert 계층이 없음.** APG는 밖과의 상호작용이 차단되고 밖 내용이
  시각적으로 가려질 때만 `aria-modal="true"`를 허용합니다. 지금은 밖을 그대로
  클릭할 수 있습니다. wp9 소유.

세 개를 같이 고치지 않으면 "모달이라고 선언했지만 모달이 아닌" 상태가 남습니다.

## Escape 스택 (신규)

`ui/src/hooks/useModalFocus.ts:61`과
`ui/src/components/agent/useAgentDialogFocus.ts`가 각각
`document.addEventListener("keydown")`을 답니다. 최상위 모달 개념이 없습니다.

두 훅 모두 `preventDefault()`는 부르지만 `stopImmediatePropagation()`을 부르지
않고, 자기가 최상위인지도 확인하지 않습니다. 그래서 한 번의 Escape가 두 리스너에
모두 도달합니다.

도달 가능한 중첩(독립 측정으로 경로 확인): 모바일에서
`ui/src/components/RightPanel.tsx:50`이 `useModalFocus`로 드로어를 열고,
그 안의 라이브러리(`ui/src/components/RightPanel.tsx:166`)에서
`ui/src/components/PromptLibraryRow.tsx:59`를 거쳐
`ui/src/components/PromptDetailModal.tsx:22`가 두 번째 `useModalFocus`
리스너를 답니다. Escape 한 번에 두 층이 같이 닫힙니다. 훅을 더 붙이면 이 위험이
배가되므로, 스택 도입이 훅 확산보다 **먼저** 와야 합니다.

그래서 wp9는 공유 훅에 모달 스택을 넣습니다: Escape와 Tab 격리를 최상위 모달에만
전달하고, 두 훅이 같은 스택을 공유하게 합니다.

## 소유권 충돌

`ui/src/components/node-canvas/NodeStudioOverlays.tsx:50`이
`NodeTemplatePicker`를 감쌉니다. 둘에 독립적으로 훅을 붙이면 핸들러가
중복됩니다. 포커스 소유자를 하나로 정하거나 `role="dialog"`를 공유 프레임으로
올립니다.

## 적용

1. 공유 훅에 모달 스택 도입(최상위만 Escape/Tab 수신), 두 훅이 스택 공유.
   이게 1번인 이유는 위 중첩 위험이 훅 확산으로 증폭되기 때문입니다.
2. A표 5개에 공유 훅 연결. 자체 Escape 리스너를 새로 쓰지 않습니다.
3. B표에서 Tab 트랩이 없는 3개(`PromptImportDialog`, `MobileComposeSheet`,
   `ProjectSearchPopup`)를 공유 훅으로 이전하고 중복 리스너를 제거합니다.
4. `AssetsWorkspace`와 `NodeStudioOverlays`를 공유 훅으로 이전합니다(위 면제
   매니페스트대로 무조건). 로컬 구현이 기능적으로 완전해도 Escape 스택 밖에 있으면
   중첩 시 두 층이 같이 닫히므로, 이전이 곧 버그 수정입니다.
   `NodeStudioOverlays`는 `DialogFrame` 내부 한 곳에서만 호출합니다.
5. 비모달 4개(`InFlightPopup`, `UpscalePopover`, `CanvasStylePopover`,
   그리고 이미 맞는 `AgentRightSidebar`)를 공유 훅 `trap: false`로
   통일하고 위 포커스 옵션표를 적용합니다. 자체 `document` keydown 리스너를
   제거합니다. `InFlightPopup`의 바깥 포인터 리스너
   (`ui/src/components/composer/InFlightPopup.tsx:80`)는 훅 밖 동작이라 유지하되,
   닫을 때 `"outsidePointer"` 이유를 넘깁니다.
6. `SpriteAnchorGate`에 backdrop + inert 계층 추가.
7. 초기 포커스를 `data-modal-initial-focus`로 표시. `SpriteAnchorGate`는
   취소 버튼에 둡니다 — 되돌리기 어려운 확인의 안전한 기본값.
8. `NodeTemplatePicker`는 부모가 트랩을 제공하므로 별도 훅을 붙이지 않습니다.
9. `DIALOG_SURFACES` 손목록을 AST 탐색으로 교체.

## 테스트: tests/a11y-modal-contract.test.ts 개정

손목록을 늘리는 것으로는 안 됩니다 — 목록이 구멍의 원인이었습니다. 그리고
정규식으로도 안 됩니다: 조건부 role을 놓치고, 주석을 잡고, 훅을 import만 해도
통과합니다.

- TypeScript JSX AST로 `ui/src/components`를 파싱해 `role` 속성이
  `"dialog"`/`"alertdialog"`인 JSX 요소를 찾습니다. 조건식의 문자열 분기와
  boolean 분기도 따라갑니다.
- `aria-modal`이 true가 될 수 있는 요소는 공유 훅 **호출**을 단언합니다(import
  존재만으로는 불충분).
- 자체 `keydown`/Escape 리스너가 없는지 단언(기존 규칙 유지).
- 비모달 4개는 트랩을 요구하지 않되 훅 **호출은 요구**합니다(`trap: false`).
  훅을 아예 안 쓰는 것은 훅 면제표의 **1개**만 허용하고, 이유 문자열이 비면 실패.
- `ui/src/components/agent/AgentRightSidebar.tsx`의 훅 호출을 지우면 실패하는지
  단언(앞선 판에서는 면제로 잡혀 통과했을 것).
- `InFlightPopup`이 `autoFocus`를 호출자 값으로 넘기는지 단언. 상수 true로
  바꾸면 실패(호버 포커스 회귀 방지).
- 비모달 3개의 `restoreFocus`가 `"outsidePointer"`에서 false를 돌려주는지 단언.
  상수 true로 바꾸면 실패(바깥 클릭 포커스 탈취 방지).
- **술어만 검사하면 부족합니다**(감사 7라운드 잔여 위험): 바깥 클릭 경로가 실제로
  `"outsidePointer"`를 **넘기는지**도 단언합니다.
  `ui/src/components/composer/InFlightPopup.tsx:83`과
  `ui/src/components/canvas-mode/CanvasStylePopover.tsx`의 바깥 클릭 핸들러가
  다른 이유(기본값 `"programmatic"` 등)를 넘기면 술어가 true를 돌려주어 포커스를
  훔치게 됩니다. 이유 인자를 지우거나 바꾸면 실패해야 합니다.
- 호버 타임아웃, 트리거 토글, 선택 완료, 개수 0, 언마운트 경로는 모두
  `"programmatic"`으로 넘깁니다. 네 가지 이유로 모든 닫기 경로가 덮입니다.
- 모달 부모 안의 비모달에서 Escape 한 번에 비모달만 닫히는지 단언.
- 모달 스택: 두 층이 열렸을 때 Escape가 최상위만 닫는지 단언.
- 변형 증명: 훅 호출을 지워 실패 확인, 조건부 role을 가진 임시 컴포넌트를 만들어
  자동 탐지되는지 확인 후 삭제, 훅을 import만 하고 호출 안 하는 경우가 잡히는지
  확인.

## 완료 조건

`aria-modal`이 true가 될 수 있는 대화상자 24개 중 훅 면제 1개를 제외한 전부가
공유 훅을 호출하고, 비모달 4개가 `trap: false`로 통일되고,
`InFlightPopup`의 호버 개방이 포커스를 훔치지 않고, 계약이 AST 탐색 기반이며,
Escape가 최상위 층만 닫고, `SpriteAnchorGate`가 backdrop과 불투명 배경을 갖고,
조건부 role을 가진 임시 모달이 목록 수정 없이 검사에 걸림.
