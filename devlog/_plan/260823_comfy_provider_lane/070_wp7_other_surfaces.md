---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, phase7]
---

# 070 — wp7: multimode · node · agent 표면 지원

의존: 060(1차 레인 완주). **이 phase는 A-phase 감사(#10)로 추가됐다.**

## 왜 별도 phase인가

030은 classic generate + edit만 배선한다. 나머지 세 표면은 각자 provider
if-체인을 갖는다:

| 파일 | 성격 |
|---|---|
| `lib/multimodePipeline.ts` | 배치 다중 생성 |
| `lib/nodeGeneration.ts` | 노드 그래프 워크플로 |
| `lib/agentImageVideoGen.ts` | Agent Mode |

060까지에서는 이 표면들이 comfy를 **명시적으로 거부**한다
(`COMFY_SURFACE_UNSUPPORTED`, 030 §6.5). 조용한 oauth 대체를 막기 위한
장치이지 지원이 아니다.

한 사이클에 넣지 않는 이유는 의존성이다. 세 표면 모두 classic 파이프라인이
확정한 어댑터 계약·에러 어휘·inflight meta 형태를 소비한다. 그게 흔들리는
동안 세 곳을 같이 고치면 네 번 고치게 된다.

## 변경 지도 (예비 — 060 완주 후 재검증)

| 파일 | 동작 |
|---|---|
| `lib/multimodePipeline.ts` | MODIFY — comfy 디스패치 + mime/JPEG 분기 |
| `lib/nodeGeneration.ts` | MODIFY — 동일 |
| `lib/agentImageVideoGen.ts` | MODIFY — 동일 + agent 설정 노출 |
| `lib/agentSettings.ts` | MODIFY — comfy 허용 |
| `ui/src` 해당 표면 | MODIFY — comfy 노출 |
| 각 표면 계약 테스트 | MODIFY |

**이 문서는 지금 diff-level이 아니다.** 근거: 대상 코드가 wp1~wp6에서
이동한다(어댑터 시그니처, 에러 코드, meta 형태). 지금 정확한 before/after를
쓰면 060 시점에 전부 stale이 된다.

DIFFLEVEL-ROADMAP-01은 로드맵의 **모든 phase**에 diff-level 문서를 요구한다.
이 문서는 그 기준을 **아직 충족하지 않으며**, 충족 시점은 wp7의 P다:
그때 060이 남긴 실제 시그니처를 읽고 이 문서를 diff-level로 승격한다.
이것은 규칙 위반을 인정하는 표시이지 면제 주장이 아니다.

대안이었던 "지금 추측으로 써두기"는 더 나쁘다 — 복붙 가능해 보이지만
실제로는 맞지 않는 PRD가 되고, 그게 정확히 감사가 030에서 잡아낸
`allLive` 같은 결함의 형태다.

## 미리 확정할 수 있는 것

세 표면 전부 **동일한 어댑터**를 부른다. 표면마다 다른 comfy 동작을 만들지
않는다. 표면 고유 문제는 셋뿐이다:

1. **multimode 동시성** — 배치 N건이 ComfyUI 큐에 N건으로 쌓인다. GPU는
   순차 실행이므로 배치 하나가 큐를 독점한다. 다른 사용자/작업과의 공정성
   정책이 필요한지 060의 TTL 조사 결과와 함께 판단한다.
2. **node 그래프 참조** — 노드 모드는 이전 결과를 참조로 넘긴다.
   `/upload/image` 왕복이 매 노드마다 일어나므로 업로드 캐시가 필요할 수
   있다.
3. **agent 계획** — Agent Mode의 플래너가 모델을 고른다. 워크플로 id는
   의미를 담지 않는 사용자 문자열이라 플래너가 고를 근거가 없다.
   사용자가 지정한 워크플로를 고정하는 편이 정직하다.

## Accept criteria (예비)

1. 세 표면에서 comfy 생성이 실제로 동작한다.
2. `COMFY_SURFACE_UNSUPPORTED` 가드가 제거된다 — 해당 표면에 한해.
3. 표면별 계약 테스트 통과.
4. wp7의 P에서 이 문서가 diff-level로 승격된 기록.
