# 001 — 이슈 #119 원인 조사 (연구 문서, diff 없음)

## 신고 내용 요약

- 환경: ima2-gen 3.0.4, Chrome, Ubuntu 26.04
- 증상: 이미지 생성 화면 왼쪽 위 이미지 모델 드롭다운을 열고 목록 내부를 스크롤하면 즉시 닫힌다.
- 신고자 추정 원인: 포털 드롭다운이 `window.addEventListener("scroll", closeDropdown, true)`로
  캡처 단계 스크롤을 듣기 때문에, 목록 내부에서 난 스크롤도 핸들러에 도달한다.
- 신고자 로컬 수정: 이벤트 타깃이 목록 내부면 닫기를 건너뛴다.

## 코드 조사 결과

### 결함 위치 확정

공용 컨트롤 `ui/src/components/controls/Select.tsx`의 포털 위치 계산 effect가
가드 없는 close 핸들러를 캡처 단계로 등록한다.

`ui/src/components/controls/Select.tsx:157-190` (현재 dev HEAD `65b0ecc`):

```
  useLayoutEffect(() => {
    if (!portal || !open) return;
    ...
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [portal, open]);
```

`close`는 이벤트 인자를 아예 받지 않으므로, 목록(`listRef`) 내부에서 발생해 캡처 단계로
`window`에 도달한 스크롤도 구분 없이 메뉴를 닫는다. 포털 목록은
`ctl-select__list--portal` + 인라인 `maxHeight`를 갖고, `.ctl-select__list`에
`overflow-y: auto`가 걸려 있어(`ui/src/styles/controls.css:53-62`) 자체 스크롤 컨테이너다.
따라서 **옵션 목록 높이가 `maxHeight`를 넘으면** 내부 스크롤이 발생하고 결함이 드러난다.
이슈 신고자의 모델 목록이 바로 그 경우다.

### v3.0.4 태그에서도 동일함 (재현 버전 확인)

`git show v3.0.4:ui/src/components/controls/Select.tsx` 기준으로도 같은 무가드 `close`가
존재한다. 즉 신고 버전과 현재 dev HEAD의 결함이 동일하다.

### 과거 커밋에서 확인된 동일 패턴 (현재는 비활성 분기)

`ui/src/components/ImageModelSelect.tsx:133-149`의 사이드바 variant는 커밋 `b735565a`
("fix: keep sidebar model dropdown scrollable and inside viewport")에서 가드를 받았다.

```
    const close = (event?: Event) => {
      // Scrolling inside the menu itself must not dismiss it — only outside
      // scrolls (sidebar/page) detach the fixed menu from its trigger.
      if (event && menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
```

**다만 이 분기는 현재 렌더되지 않는다.** 전체 호출 검색 결과 `ImageModelSelect`의 유일한
사용처는 `ui/src/components/SettingsWorkspace.tsx:208`의 `variant="settings"`이고,
`variant="sidebar"` 렌더는 커밋 `9b42d633`("refactor(agent-ui): dead-code sweep")에서
제거됐다.

```
$ rg -n "<ImageModelSelect" ui/src --glob '*.tsx'
ui/src/components/SettingsWorkspace.tsx:208:  <ImageModelSelect variant="settings" />
```

따라서 이 코드는 "이미 고쳐진 형제 표면"이 아니라 **과거 커밋에서 확인된 수정 패턴의 선례**다.
WP1은 이 선례를 참고하되 죽은 분기를 건드리지 않고 활성 `Select` 경로만 고친다
(A-phase 감사 blocker 4 반영).

### 신고자가 본 드롭다운의 실제 정체

"왼쪽 위 이미지 모델 드롭다운"은 사이드바 상단의 provider/model 셀렉트다.
`ui/src/components/GenProviderModelSelect.tsx:273-299`가 `Select`를 `portal` 옵션으로 두 번
렌더한다(`sidebar-generation-provider`, `sidebar-generation-model`). 따라서 신고 경로는
이미 고쳐진 `ImageModelSelect` 사이드바 메뉴가 아니라 **`Select` 포털 경로**다.

### 영향받는 호출처 (portal=true, 전수)

`Select`는 14개 파일에서 19회 렌더되지만(JSX 노드 기준. 타입 참조 제외),
이 결함은 `portal`을 켠 호출에만 나타난다.
포털을 켜는 활성 호출은 정확히 6개다:

| 파일:라인 | 용도 |
|-----------|------|
| `ui/src/components/GenProviderModelSelect.tsx:281` | 사이드바 provider 셀렉트 |
| `ui/src/components/GenProviderModelSelect.tsx:297` | 사이드바 model 셀렉트 |
| `ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx:20` | 프롬프트 빌더 모델 메뉴 |
| `ui/src/components/settings/ProviderStatusSelect.tsx:161` | 설정 provider 상태 |
| `ui/src/components/settings/McpReferenceSlots.tsx:99,141` | MCP 레퍼런스 슬롯 |

공용 컴포넌트 한 곳을 고치면 이 6개 지점이 동시에 해결된다.
비포털 호출은 목록이 트리거 바로 아래 `position: absolute`로 붙어 함께 움직이므로
스크롤 dismiss 리스너 자체가 등록되지 않는다(`Select.tsx:158`의 조기 반환).

### 인접 표면 점검 대상

`ui/src/components/composer/InFlightPopup.tsx:63`도 캡처 단계 스크롤을 듣는다.

```
    window.addEventListener("scroll", schedulePosition, true);
```

다만 핸들러가 `close`가 아니라 `schedulePosition`(위치 재계산)이므로 증상이 다르다.
내부 스크롤에서 팝업이 닫히지는 않는다. WP1에서 재확인하되, 동작 변경 없이
"결함 아님"으로 판정될 가능성이 높다. 그 판정도 근거와 함께 기록한다.

`ui/src/hooks/useVisualViewportInset.ts:18`, `DeadTagMirror.tsx:77`,
`ElementMentionMenu.tsx:91`은 캡처 단계가 아니거나 특정 요소에 직접 붙은 리스너라
이 결함 클래스에 해당하지 않는다.

독립 감사에서도 "캡처 단계 window 스크롤로 dismiss"하는 컴포넌트는 활성 `Select.tsx`와
비활성 `ImageModelSelect.tsx` 사이드바 분기뿐임이 확인됐다.

## 테스트 환경 제약

이 저장소의 UI 계약 테스트(예: `tests/composer-tray-ui-contract.test.js`)는 소스 파일을
읽어 정규식으로 검사하는 정적 방식이고, DOM 런타임(jsdom/happy-dom/testing-library)이
의존성에 없다. 일부 테스트는 `ui/src`의 순수 함수를 직접 import해 호출한다
(예: `tests/element-mention-ui-contract.test.js:4-11`).

따라서 노드 테스트만으로는 "React effect가 리스너를 등록하고 그 핸들러가 `setOpen`을
호출하지 않는다"는 **사용자 관측 동작**을 증명할 수 없다. 순수 함수를 추출해 테스트하면
판정 로직의 발화는 증명되지만 배선은 증명되지 않는다. `c-scroll-activation`은 실행 중인
브라우저에서의 관측을 요구한다 — 수단은 `010`의 활성화 시나리오 절 참조.

## 참고 커밋/태그

- dev HEAD: `65b0ecc test(cli): type the fake TTY streams for the tests typecheck`
- 신고 버전 태그: `v3.0.4`
- 형제 수정: `b735565a`, 포털화 원 커밋: `37b6115a` (#79)
