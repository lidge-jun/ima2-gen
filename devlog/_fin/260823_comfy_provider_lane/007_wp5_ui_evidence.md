---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, evidence, ui, phase5]
---

# 007 — wp5 UI: Design Read, 렌더 관찰, 관찰이 잡은 결함

## Design Read (실행 기록)

**Design System Detection이 먼저다.** `ui/src/components/settings/`가 이
표면을 이미 지배한다 — `McpProviderConnections`의 `article.settings-row`,
`McpModelPresetControls`의 파라미터 계약 렌더링, 그리고 결정적으로
`GenProviderModelSelect`가 **이미 MCP 레인용 런타임 카탈로그를 다룬다**
(`mcpCatalog`, `modelsLoading`, AbortController 가드 fetch). comfy는 문법을
새로 만드는 게 아니라 물려받는다.

    surface:  dense local-GPU tool의 설정 패널
    audience: 이미 ComfyUI를 돌리며 노드 id와 input 이름을 읽는 사람

    DESIGN_VARIANCE: 2
    MOTION_INTENSITY: 1
    density: D8 (developer/expert control surface)

시각적 변주는 정보 밀도를 방해할 뿐이고, **옆 설정 행들과 이질감이 생기면
그게 곧 결함**이다.

UX-CONCEPT-GEN-01 개념 생성은 스킵했다. 스킵 조건에 정확히 해당한다:
지배적 디자인 시스템 존재, 유틸리티 설정 패널, 브랜드 가시 합성물 아님.
아이콘도 기존 레이어를 따랐다 — 새 라이브러리 도입 자체가 일관성 위반이다.

## 렌더 접지 (C-RENDER-GROUNDING-01)

실제로 서버를 띄우고 브라우저로 열어 **에이전트가 스크린샷을 읽었다.**
사용자가 예시로 든 두 이름을 그대로 등록해 부분 오프라인을 재현했다.

    $ ima2 comfy workflow add ... --id kukuru --label "쿠쿠루삥뽕" --origin http://127.0.0.1:18188
    $ ima2 comfy workflow add ... --id euh    --label "어흐"      --origin http://127.0.0.1:18189

18188은 lidge ComfyUI로 터널링돼 살아있고, 18189는 아무것도 없다.

증거물: `evidence/005_wp5_settings_manager.png`

    COMFYUI WORKFLOWS
    Workflow        Instance                    Status
    어흐             http://127.0.0.1:18189      offline    Remove
    쿠쿠루삥뽕        http://127.0.0.1:18188      ready      Remove

**설계의 핵심이 화면에서 확인된다**: 워크플로마다 자기 origin과 자기
상태를 갖는다. 죽은 인스턴스 하나가 살아있는 워크플로를 가리지 않는다.

## 관찰이 잡은 결함 둘 (정적 검사로는 안 잡혔다)

### 1. 테이블에 스타일이 없었다

첫 스크린샷에서 셀이 서로 붙어 있고 Remove가 버튼이 아니라 텍스트처럼
보였다. `ui/src/styles/settings-controls.css`에 `.comfy-workflow-table`
규칙이 없었기 때문이다 — TypeScript도 테스트도 이걸 잡을 수 없다.
D8 밀도에 맞는 컬럼 구분, 모노스페이스 origin, 우측 정렬 액션을 추가했다.

### 2. 라벨이 위 행으로 파고들었다

"ComfyUI address" 라벨이 파일 입력 행으로 줄바꿈돼 겹쳤다. label과 input이
블록 레이아웃 없는 inline 형제였기 때문이다. `.comfy-field` 래퍼로
라벨-위-컨트롤 구조를 만들어 해결했다.

두 결함 모두 **재빌드 후 재관찰로 수정을 확인**했다.

## 뷰포트 관찰 노트

좁은 폭(500px)에서는 모바일 셸이 적용돼 설정 패널이 화면 절반에서 잘린다.
1440px에서 정상 렌더된다. 이는 comfy 고유 문제가 아니라 기존 모바일 셸의
동작이며, 이번 유닛 범위 밖이다 — 다만 관찰했으므로 기록한다.

## 셀렉터

`getImageModelOptionsForProvider("comfy")`가 **빈 배열**을 내고, 셀렉터가
`/api/models`의 comfy lane에서 워크플로를 읽는다. 이게 없으면 default 분기가
`OPENAI_IMAGE_MODEL_OPTIONS`를 돌려줘 ComfyUI를 고른 사용자에게
gpt-5.6-luna가 보인다.

오프라인 워크플로는 **목록에 남되 선택 불가**다. 지우면 "내 워크플로가
사라졌다"가 되고, 그냥 두면 실패가 확정된 생성을 시작하게 된다.

`setProviderImpl`은 comfy 전환 시 선택을 비운다. 자동 선택은 하지 않는다 —
등록 순서에 의미가 없어 임의의 그래프를 사용자 GPU에서 돌리게 된다.

**셀렉터 드롭다운의 실제 열림 상태는 관찰하지 못했다.** agbrowse가 해당
combobox를 visible/enabled로 잡지 못했고, DOM 조회는 타임아웃됐다. 대신
`tests/comfy-ui-contract.test.ts`가 세 배선 지점을 소스 레벨로 고정한다.
이건 렌더 관찰이 아니라 정적 근거이므로 그렇게 표시한다.

## i18n

27개 키를 en/ko/zh-Hans/zh-Hant 4종에 넣었다. 빈 상태 문구는 **다음 행동을
지시**한다("ComfyUI에서 Workflow > Export (API)로 내보내거나..."). 한국어는
번역투와 AI 관용구를 피했다.

## 남은 것

동적 파라미터 폼(`ComfyParamControls`)은 만들지 않았다. 워크플로의
`params` 계약은 wp1에서 도출되고 API로 노출되지만, UI 렌더링은 다음
유닛으로 미룬다 — 이번 사이클은 등록·선택·상태까지가 범위다.
