---
created: 2026-07-11
tags: [ima2-gen, agent-mode, video, ux-research, claim-ledger]
---

# WP1 웹 리서치 — 비디오 에이전트 UI/UX claim ledger (sol explorer "Wegener")

2026-07-11 기준. Tier 2 = 공식 문서 또는 2개 이상 독립 소스 검증, Tier 1 = 단일
소스/설계 추론. 참고: Sora 웹/앱은 2026-04-26 서비스 종료 — 레퍼런스로만 사용.

## Queue / Job UX

- **Q1 (T2)** 내구성 있는 generation history가 지배적 패턴. Runway Session 스크롤,
  Flow 프로젝트 자동 저장, Luma boards/threads.
  > 출처: [Runway Generative Video](https://help.runwayml.com/hc/en-us/articles/37425232841875-Getting-Started-with-Generative-Video), [Google Flow Agent](https://support.google.com/flow/answer/17093911), [Luma video API](https://docs.lumalabs.ai/docs/video-generation)
- **Q2 (T2)** 잡 상태 모델은 coarse: queued/processing/completed/failed. 신뢰 가능한
  프레임 단위 %는 제공 안 됨 (Luma `dreaming/completed/failed`, Runway failure 필드).
  > 출처: [Luma video API](https://docs.lumalabs.ai/docs/video-generation), [Runway Task Failures](https://docs.dev.runwayml.com/errors/task-failures/)
- **Q3 (T2)** 병렬 생성은 1급 기능이되 동시성 바운드 존재 (Flow 배치 변형, Runway
  동시 생성 한도, Krea 플랜별 동시성).
- **Q4 (T1)** 큐 위치/ETA는 추정치로 표기해야 함 — Kling/Freepik 사용자 보고에서
  거짓 정밀도(93%에서 멈춤 등)와 취소 불가가 주요 불만.
- **Q5 (T2)** 우선순위 클래스(relaxed vs full-speed)를 잡 카드에 라벨링 (Luma
  Relaxed Mode, Freepik relaxed queue).

## Progress Feedback

- **P1 (T2)** 합성 0-100% 바보다 indeterminate 단계 피드백이 방어 가능.
- **P2 (T2)** 완료는 이벤트 드리븐 + 네비게이션 생존; 인앱 갱신 + 선택적 OS 알림.
- **P3 (T1)** 중간 프레임 프리뷰는 크로스 프로바이더 원시 기능이 아님 — 입력
  이미지/스토리보드 프레임/중립 포스터를 처리 중 표시로 사용.
- **P4 (T2)** "용량 대기"와 "생성 중"은 운영상 다른 단계 — 분리 표기.

## Result Presentation

- **R1 (T2)** 결과는 일시적 채팅 첨부가 아니라 영속 자산 스트림/보드로 제시.
- **R2 (T2)** 표준 후속 액션: reuse / refine / extend / frame 저장 / download.
- **R3 (T2)** 비파괴 lineage 표준화 (Flow History, Luma Edit Threads).
- **R4 (T2)** 멀티샷은 실제 타임라인 표면 필요 (Flow Scenebuilder).
- **R5 (T1)** 밀집 그리드는 hover-play, 검사/비교는 스크러버 플레이어.
- **R6 (T2)** 변형 비교는 이전 결과를 대체하지 않고 보존.

## Agentic / Chat-driven

- **A1 (T2)** 대화와 내구성 미디어 워크스페이스 분리 (Flow Agent 사이드 패널;
  세션 삭제해도 미디어는 프로젝트에 잔존).
- **A2 (T2)** 에이전트 플랜을 검사 가능한 산출물로: 스토리보드/샷 프롬프트/레퍼런스/변형.
- **A3 (T2)** 크레딧 소모 툴콜엔 승인 경계 (Flow: Ask/Always/Never).
- **A4 (T2)** 스티어링은 영속 레퍼런스 + 명시적 자산 선택으로.
- **A5 (T2)** 미드런 스티어링은 task/샷 경계에서 — 실행 중 잡 변조 시늉 금지.
- **A6 (T2)** 모든 미디어 이벤트에 provenance: 프롬프트/모델/설정/소스/비용/부모.

## Failure / Policy UX

- **E1 (T2)** 정책 거부와 프로바이더 실패는 별개 상태 (Runway failureCode 분류).
- **E2 (T2)** moderation 거부는 어떤 입력 클래스가 실패했는지 + 재시도 경로 제시.
- **E3 (T2)** 재시도 컨트롤은 실패 유형 인지형: 일시 장애→즉시 재시도/프로바이더
  전환, 정책 거부→프롬프트 편집 유도.
- **E4 (T1)** 실패의 크레딧 처리 명시 (프로바이더별 상이 — 전역 정책 표시 불가).

## 실행 가능 패턴 Top 10 (WP2 설계 입력)

1. 영속 잡 드로어: Queued/Generating/Completed/Failed/Canceled 필터.
2. 정직한 단계 피드백: 큐 대기 vs 생성 분리, ETA는 텔레메트리 있을 때만 범위로.
3. 병렬 잡 레인: 요청 단위 변형 그룹핑, 동시성 사용량 노출, 큐 잡 취소.
4. 이벤트 드리븐 완료: 새로고침 없이 갱신 + 오프스크린 완료 데스크톱 알림 옵션.
5. 안정적 처리 카드: 최종 종횡비 예약, 입력 프레임 포스터, 가짜 프리뷰 금지.
6. 검사 우선 플레이어: 그리드 muted hover-play + 스크러버/프레임 캡처 플레이어.
7. 비파괴 lineage: Retry/Extend/Edit/Upscale/Provider Switch = 자식 버전 + 계보 표시.
8. 에이전트 액션 타임라인: plan→승인→툴콜→샷별 상태→비용→미디어 결과를 구분 이벤트로.
9. 샷 단위 스티어링: 비싼 단계 전 일시정지, 대기 샷 편집, 잔여 배치 취소.
10. 타입드 실패: policy/invalid/capacity/outage/timeout/quality 구분 + 맞는 복구 액션.
