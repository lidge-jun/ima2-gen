---
created: 2026-07-11
tags: [ima2-gen, agent-mode, audit]
---

# WP1 Agent 탭 감사 종합 (sol explorers "Heisenberg" + "Peirce")

정적 read-only 감사. Agent Mode는 `routes/multimode.ts`가 아니라 전용
`/api/agent/*` 런타임을 사용한다.

## 코드맵 요약

- 프론트: `ui/src/components/agent/` 약 30개 컴포넌트. 오케스트레이터는
  `AgentWorkspace.tsx`(425줄) — bootstrap/600ms 폴링/optimistic turn/세션 CRUD/큐
  액션/히스토리 미러링을 전부 로컬 state로 처리. **전용 Zustand slice 없음**.
- 레이아웃: `lib/agentLayout.ts` (three-pane / rail / stacked / mobile-sheet),
  `useAgentWorkspaceLayout.ts`, 모바일 분기점 800px.
- 백엔드: `routes/agent.ts`(325) + `lib/agentStore.ts`(422, SQLite) +
  `agentQueueStore.ts`(316) + `agentQueueWorker.ts`(148, 글로벌 2슬롯/세션당 1) +
  `agentRuntime.ts`(409) + `agentImageVideoGen.ts`(368, Grok T2V/I2V) +
  `agentGenerationPlanner.ts`(352).
- 미사용(dead) 컴포넌트: `AgentGenerationSettingsPanel`, `AgentModelSheet`,
  `AgentSessionRail` — 프로덕션 임포터 없음.

## P1 결함 (8건)

| # | 결함 | 근거 |
|---|---|---|
| F1 | 모바일에서 Agent 모드 진입 후 **모드 탈출 UI 없음** (사이드바 숨김, MobileAppBar는 Classic 전용, AgentTopBar에 모드 스위치 없음) | `agent-workspace.css:10-38`, `MobileAppBar.tsx:11-20`, `AgentTopBar.tsx:18-32` |
| F2 | 모바일-시트 레이아웃에서 **큐/실패 잡 컨트롤 전체 소실** (우측 사이드바 미렌더, ImageSheet는 이미지만) | `AgentWorkspace.tsx:221-222,402-422`, `AgentImageSheet.tsx:20-42` |
| F3 | **서버 재시작 시 running 잡 영구 고아** — worker는 `status='queued'`만 claim, startup 복구 없음; 취소/재시도 불가 상태로 고착 | `agentQueueStore.ts:127-160,186-192`, `agentQueueWorker.ts:27-33` |
| F4 | **비디오 진행 표시가 범용 스피너뿐** — 경과 시간/폴링 단계/provider 상태 없음; 비디오 생성 중 running tool turn 미기록 | `agentRunProgress.ts:47-60`, `AgentRunStatusBar.tsx:10-23`, `agentImageVideoGen.ts:252-284` |
| F5 | **과거 실패가 세션을 영구 error 상태로 유지** — summarizeQueue가 idle일 때 보존 80건 중 임의 failed를 선택 | `agentQueueStore.ts:274-284`, `agentRunProgress.ts:26-34` |
| F6 | **부트스트랩 실패가 조용히 "Ready"로 변환** — console.error 후 빈 워크스페이스; 대부분의 mutation도 `.catch(console.error)` | `AgentWorkspace.tsx:189-195,283-339` |
| F7 | **버튼 안에 `<video controls>` 중첩** — invalid nested interactive, 재생/스크럽 클릭이 선택으로 오동작 가능 | `AgentResultThumb.tsx:21-36`, `AgentSafeImage.tsx:24-25` |
| F8 | **running 잡 취소 불가** — UI/백엔드 모두 queued만 취소 허용; AbortSignal은 하위에 존재 | `AgentQueueRow.tsx:13-14`, `agentQueueStore.ts:186-192` |

## P2 결함 (10건 요약)

빈 상태가 이미지 전용 카피(F9), 비디오 poster/에러 상태 부재(F10), 큐가 6번째
탭 뒤에 은닉(F11), 큐 행에 내부 플래너 용어 노출·미번역(F12), 600ms 전체
워크스페이스 폴링 + out-of-order 적용 레이스(F13), 턴/이미지 무페이지네이션
(F14), 강제 auto-scroll(F15), 높이 560px 미만 급락 레이아웃(F16), 서버 생성
prose 영어 고정(F17), a11y 부분 결손 — tab에 aria-controls 없음, 큐 라이브
리전 없음, 비디오 라벨 없음(F18).

## 기존 레인 잔여 스코프 (Peirce)

260516/260517 계획 대비: 이중 접힘/durable queue/bounded fanout/세션별
spinner = DONE. 잔여 = pane preference, 실제 context projection(Refs/Web 항상
empty), forms/style-lock 확장, top chip→사이드바 연동, settings UI polish
(Quality가 bare select), tool compact/truncate polish.

## 비디오 persistence (WP4/5 입력)

두 레인의 권장 수정은 **이미 현재 코드에 반영됨**: `persistenceRegistry.ts:31`,
`storePersistence.ts:237`, `useAppStore.ts:145,388`, `storeSettingsImpl.ts:77`,
`storeUIImpl.ts:66`, `continueFromItem.ts:31`. 잔여: 계약 테스트 증거 확보 +
continue 시 lineage 원본 모델 미복원(현재 모델 없으면 grok-imagine-video-1.5
선택)의 소소한 갭.

## stabilize-split Phase 3 (WP6 입력)

`routes/multimode.ts` 564 / `routes/generate.ts` 547 / `routes/nodes.ts` 530 /
`lib/oauthProxy/generators.ts` 501. 분할 지침은
`260605_stabilize-split/00_plan.md:135` — nodes→`lib/nodeGeneration.ts`+
`lib/nodeValidation.ts`, generate→`lib/generatePipeline.ts`,
multimode→`lib/multimodePipeline.ts`; generators.ts는 설계 없음(신규 설계 필요).
`lib/agentRuntime.ts`는 409줄로 이미 통과.
