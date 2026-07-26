---
created: 2026-07-11
tags: [ima2-gen, agent-mode, design, spec]
---

# WP2 Agent 탭 재설계 스펙 (Design Read + 구현 계약)

## Design Read

```yaml
---
name: ima2-agent-workspace
colors: 기존 ima2 디자인 시스템 토큰 상속 (신규 팔레트 금지)
typography: 기존 앱 스택 상속
---
```

Reading this as: **비디오/이미지 생성 에이전트의 반복 작업용 dense work tool**,
for 로컬 스튜디오 파워 유저(ko/en), with a **quiet·utilitarian·truthful** language.
레퍼런스: Google Flow Agent(대화/미디어 분리, 승인 경계), Runway Session(영속
잡 히스토리). 마케팅 표면 아님 — 밀도와 정직한 상태가 전부.

- DESIGN_VARIANCE: 3 / MOTION_INTENSITY: 2 / density: D4-D5
- Reasoning: 반복 작업 도구 — 모션은 피드백 전용, 레이아웃은 예측 가능해야 함.
- **UX-CONCEPT-GEN-01 skip 사유**: utility work-tool 표면 + 기존 앱 디자인
  시스템이 지배(신규 브랜드 표면 아님) — 스킬 명시 면제 조항 적용.
- Do: 큐/진행/실패를 1급 시민으로; 모든 상태 변화에 피드백; ko/en 완전 대칭.
- Don't: 가짜 진행률(합성 %), 히어로형 여백, 새 팔레트/그라디언트, 장식 모션.

## 구현 계약 (workers 공통 — 위반 금지)

### C-API. 백엔드 계약 추가 (W1이 구현, W2/W3가 소비)

1. `AgentQueueItem` projection에 `startedAt: number | null` (running 전환 시각,
   epoch ms) 추가. 완료/실패 시에도 보존.
2. 큐 요약(`summarizeQueue`)은 **활성 잡 없고 최신 완료가 실패보다 이후면 failed를
   노출하지 않는다** — "가장 최근 종료 이벤트" 기준으로 교체 (F5).
3. `POST /api/agent/queue/:id/cancel`이 `running` 잡도 수용: AbortController
   레지스트리로 실행 중 생성 중단 → status `canceled`(신규 상태, `failed` 재사용
   금지) + reason 기록. UI 계약: canceled는 회색 뱃지.
4. 서버 시작 시 stale `running` 복구: startup에서 `running` → `failed`
   (`reason: "server restarted mid-run"`) + retry 가능 (F3).
5. 비디오 생성 진행: `agentImageVideoGen`이 잡 실행 중 큐 아이템에
   `progressStage: "requesting" | "polling" | "downloading"` 갱신 (기존 update
   경로 재사용). 합성 % 금지 (claim P1/Q2).
6. 워커 레벨 타임아웃: 비디오 잡 30분 / 이미지 잡 10분 AbortSignal.timeout 결합,
   초과 시 failed(reason: timeout) (Mill B5와 별개로 Agent 큐 레이어에 적용).

### C-UI1. 워크스페이스/레이아웃/모바일 (W2 소유)

- 파일 소유: `AgentWorkspace.tsx`, `AgentTopBar.tsx`, `AgentImageSheet.tsx`,
  `agentLayout.ts`, `useAgentWorkspaceLayout.ts`, `agentApi.ts`,
  `agentTypes.ts`, `agent-workspace.css`, i18n 키 `agent.workspace*`/`agent.boot*`.
- F1: AgentTopBar에 모드 이탈 버튼(기존 UIModeSwitch 재사용 불가 시 "Studio로"
  아이콘 버튼 — lucide 계열 기존 아이콘 프리미티브 `AgentIcons` 확장).
- F2: mobile-sheet 레이아웃에서 큐 접근 — AgentTopBar에 큐 칩(활성 N 카운트)
  → 큐 시트(AgentImageSheet 패턴 재사용) 오픈.
- F6: bootstrap 실패 시 전용 에러 상태(재시도 버튼 + 원인 1줄) 렌더;
  mutation `.catch(console.error)` 전부 → 상태/토스트 경유.
- F13: 폴링 레이스 가드 — 요청 seq 토큰, 구식 응답 폐기; 세션 전환 시 이전
  요청 무시. 폴링 주기 600ms → 1500ms(활성 잡 있을 때) / 4000ms(유휴).
- F16: 낮은 높이에서 rail→mobile-sheet 급락 대신 stacked 유지 (agentLayout 조정).
- 상태 유지: 기존 로컬 state 구조 유지(전면 Zustand 이관은 이번 스코프 아님).

### C-UI2. 채팅/큐/프리뷰 표면 (W3 소유)

- 파일 소유: `AgentRunStatusBar.tsx`, `agentRunProgress.ts`, `AgentQueuePanel.tsx`,
  `AgentQueueRow.tsx`, `AgentMessageList.tsx`, `AgentResultThumb.tsx`,
  `AgentSafeImage.tsx`, `AgentImagePane.tsx`, `AgentSidebarTabs.tsx`,
  `agentQueueFormatting.ts`, `agent-workspace-panels.css`,
  `agent-workspace-image.css`, `agent-workspace-sidebar.css`, i18n 키
  `agent.queue*`/`agent.progress*`/`agent.media*`/`agent.empty*`.
- F4: 상태바 = 단계 라벨(대기 중/생성 중/다운로드 중, `progressStage` 소비) +
  경과 시간(`startedAt` 기준 mm:ss, 1s tick) + 잡 종류(image/video)와 변형 수.
  합성 진행률 금지.
- F7: `AgentResultThumb`은 `<button>` 안에 `<video>` 넣지 않는다 — 썸네일은
  poster 프레임(비디오 metadata 로드 후 첫 프레임 or 정지 상태 muted video
  `pointer-events:none` + playsInline)으로, controls는 메인 pane에서만.
- F10: 메인 비디오 pane — poster/로딩 스켈레톤/`onError` 시 실패 상태 + 재시도,
  다운로드 버튼, duration 메타 표기. `aria-label` 부여 (F18).
- F8: 큐 행 취소 버튼을 `running`에도 노출 (백엔드 C-API-3 소비), `canceled`
  상태 뱃지 추가.
- F5/F11: 큐 요약 칩을 상태바에 상시 노출(활성/실패 카운트, 클릭 → 큐 탭 전환).
- F9: 빈 상태 카피를 이미지+비디오 포괄로 교체 (en/ko).
- F12: 큐 행 카피 인간화 — `3v/2p · llm-planner` 같은 내부 용어 제거, i18n 경유
  ("변형 3개 · 병렬 2"), 원문 reason은 접힘 상세로.
- F15: auto-scroll은 사용자가 하단 근처(120px)에 있을 때만; 아니면 "새 메시지"
  점프 버튼.
- F18: 사이드바 탭 `aria-controls`/`id` 연결, 큐 상태 변화 `aria-live="polite"`
  리전, 에러 스피너 애니메이션 제거(정지 아이콘).

### 공통 규칙

- 이모지 UI 금지, 신규 그라디언트 금지, 기존 CSS 변수/토큰 재사용.
- 모든 사용자 노출 문자열은 en.json/ko.json 동시 추가 (`agent.*`).
- 계약 테스트: 기존 `tests/agent-*` 유지 + 신규 동작(취소/복구/요약/canceled)
  계약 테스트 추가. `npm test` 0 fail.
- dead 컴포넌트(`AgentGenerationSettingsPanel`, `AgentModelSheet`,
  `AgentSessionRail`)는 이번 라운드 삭제하지 않음(후속 판단).
