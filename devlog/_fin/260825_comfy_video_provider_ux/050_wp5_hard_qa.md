---
created: 2026-08-25
tags: [ima2-gen, devlog, phase5, qa, chrome, agbrowse, evidence]
---

# 050 — wp5: 하드 QA (chrome:control-chrome + agbrowse)

사용자가 지정한 두 브라우저 표면 모두로 실제 서비스(3333)를 구동했다.

- **chrome:control-chrome**: Node REPL browser-client 런타임, 사용자의 실제 Chrome.
  주 검증 표면. Playwright 로케이터, CDP 콘솔 수집, viewport 오버라이드.
- **agbrowse**: 교차 확인. 같은 DOM을 독립적으로 스냅샷.

## 발견한 결함 2건

### D1 [High] comfy workflow 선택이 새로고침을 못 넘긴다 — 수정 완료

실제 Chrome에서 관측:

    BEFORE reload: provider=ComfyUI  model=MiniMax H3 FL2VA pruned NVFP4
    AFTER  reload: provider=ComfyUI  model=(빈칸)

provider는 살아남고 workflow만 사라진다. 사용자 입장에서 이건 원래 신고한 "지정이
안된다"와 **구분되지 않는 증상**이다. 다른 lane의 선택은 전부 persist되는데 comfy만
아니었다.

원인 두 겹:

1. `comfyVideoWorkflow`가 persistence 계층에 아예 없었다. wp1에서 필드를 신설할 때
   저장 경로를 함께 만들지 않았다.
2. `setProviderImpl`이 comfy 진입 시 두 필드를 **무조건** 비웠다. 복원한 값이
   있어도 즉시 지워진다.

수정:

- `storePersistence.ts`: `comfyWorkflow`/`comfyVideoWorkflow` 읽기 추가.
- `setComfyVideoWorkflowImpl`: `saveGenerationDefaultsPatch`로 저장.
- `useAppStore.ts`: 초기값을 저장된 값에서 하이드레이트.
- `setProviderImpl`: **다른 lane에서 올 때만** 비운다. 이미 comfy면 보존.

재관측:

    BEFORE reload: provider=ComfyUI  model=MiniMax H3 FL2VA pruned NVFP4
    AFTER  reload: provider=ComfyUI  model=MiniMax H3 FL2VA pruned NVFP4

`tests/comfy-selection-persistence.test.js`가 두 층을 모두 고정한다.

### D2 [무효] 키보드 선택 — 내 하네스 결함이었다

처음에 ArrowDown이 하이라이트를 못 옮기는 것처럼 보였으나, 원인은 `locator.press`가
매번 로케이터를 재해석하며 포커스를 되돌린 것이었다. 같은 핸들로 연속 입력하니
정상 동작한다: 첫 ArrowDown이 목록을 열고, 이후 이동하며, index 9(ComfyUI)에서
Enter가 선택을 확정했다.

앱 결함이 아니다. 도구 결함을 앱 결함으로 보고하지 않기 위해 기록해둔다.

## 통과한 검증 클래스

| 클래스 | 표면 | 결과 |
|---|---|---|
| comfy video 선택 (origin down) | Chrome | H3가 aria-disabled, lockReason 없음, 라벨 미잘림 |
| comfy video 선택 (origin up) | Chrome | 행 활성화, 클릭으로 선택 확정 |
| 새로고침 지속성 | Chrome | D1 발견 → 수정 → 재관측 통과 |
| 빠른 provider 전환 5회 | Chrome | 상태 일관, comfy 재진입 시 자동선택 없음 |
| 죽은 origin 제출 | HTTP | `COMFY_OFFLINE` + 정확한 origin 명시 |
| 키보드 전용 | Chrome | 열기/이동/선택 정상 (APG) |
| 콘솔 에러 | Chrome CDP | JS 에러 0건 (favicon 404만, 기존 이슈) |
| 12 lane 배지 대조 | Chrome | **불일치 0건** |
| 모바일 390x844 | Chrome viewport | 잘림 0, 겹침 0 |
| MCP 그룹 분리 | Chrome + agbrowse | core 10 / MCP 별도 |
| 설정 화면 산문 | Chrome | "not supported" 잔존 0건 |
| 교차 확인 | agbrowse | Chrome 관측과 완전 일치 |

## 배지 대조 원문

    oauth       ready         want=''            got=''            OK
    api         key-missing   want='key missing' got='key missing' OK
    grok        ready         want=''            got=''            OK
    grok-api    key-missing   want='key missing' got='key missing' OK
    agy         ready         want=''            got=''            OK
    gemini-api  key-missing   want='key missing' got='key missing' OK
    atlascloud  key-missing   want='key missing' got='key missing' OK
    minimax     key-missing   want='key missing' got='key missing' OK
    nai         ready         want=''            got=''            OK
    comfy       disconnected  want='offline'     got='offline'     OK
    MISMATCHES: 0

gemini-api는 QA 도중 ready→key-missing으로 바뀌었고 배지가 따라갔다. 하드코딩이면
불가능한 일이다.

## Evidence

- `evidence/030_qa_chrome_comfy_video_dropdown.png` — 실제 Chrome, H3 offline-disabled
- `evidence/031_qa_chrome_lanes_mobile.png` — 실제 Chrome 390x844
- `evidence/032_qa_agbrowse_settings.png` — agbrowse 설정 화면
