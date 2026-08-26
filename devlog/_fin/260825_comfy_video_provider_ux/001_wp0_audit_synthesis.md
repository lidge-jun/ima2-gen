---
created: 2026-08-25
tags: [ima2-gen, devlog, audit, synthesis, phase0]
---

# 001 — wp0 A: 감사 합성과 계획 수정

리뷰어: 독립 explorer (anthropic/claude-fable-5, REVIEW-DECORRELATE-01에 따라 main과
다른 모델 계열). 최종 판정 `VERDICT: GO-WITH-FIXES (blockers=6)`.

main이 6개 블로커를 전부 실제 소스로 재확인했다. 아래는 각 블로커의 근거 재검증과
계획 수정(fold-back) 결정이다.

## B1 [High] comfy-ui-contract 테스트가 wp1이 지우는 UI 동작을 고정한다 — ACCEPT

재확인: tests/comfy-ui-contract.test.ts:49-57이 GenProviderModelSelect.tsx 소스에
대해 `disabled: true`, `entry.lockReason`, `videoCatalogShort`, `title: entry.reason`,
`stacked: true`를 정규식으로 단언한다. 계획은 models-endpoint-contract만 깨진다고
적었다. 소스 문자열 단언이므로 wp1 §6 편집 즉시 실패한다.

수정: 010의 §8에 이 파일을 필수 교체 대상으로 추가한다.

## B2 [High] 필드 체인에 UI/CLI 소비자 3곳이 빠졌다 — ACCEPT

재확인:

- ui/src/lib/api-comfy.ts:17-25가 ComfyWorkflowBindings를 **복제**한다 (UI는 lib 타입을
  import하지 않는다). :50에서 keyof로 ComfyBindField를 만든다.
- ui/src/components/settings/ComfyWorkflowManager.tsx:36의 BIND_FIELDS가 7개 필드를
  하드코딩하고, :128-133 제출 루프가 그 배열만 순회한다 → 새 binding이 등록에서
  **조용히 버려진다**. 이 파일은 010의 scope IN에도 없었다.
- bin/commands/comfy.ts:190-197 플래그 맵과 :228-231 flagFor에 length/fps 없음.

수정: 010의 필드 체인 표와 scope IN에 세 파일을 추가한다.

## B3 [Medium] 세 번째 lock 계층이 계획에 없다 — ACCEPT (가장 중요한 발견)

재확인: lib/providerOptions.ts:75-87이 comfy + mediaKind video 조합에서
`COMFY_VIDEO_EXECUTION_LOCKED`를 반환한다. 이건 표시용 신호가 아니라 **실제 거절**이다.
routes/video.ts:188과 routes/models.ts:317의 lock을 걷어도 이 계층이 남아 있으면
comfy video는 계속 400을 받는다. 계획이 이걸 놓쳤다면 wp1은 실패한다.

단, 이 가드는 **이미지 경로**의 가드다: video workflow를 이미지 파이프라인에 넣는
요청을 막는 역할은 wp1 후에도 유효하다. 따라서 삭제가 아니라 분리다.

수정: 010에 새 항목을 추가한다 — providerOptions는 이미지 경로에서 video workflow를
거절하되 사유를 "video workflow는 video 경로로 보내라"로 바꾼다. 실행 미지원이라는
거짓 문구를 없앤다. 고정 테스트 comfy-routes-contract.test.ts:176과
comfy-cli-contract.test.ts:51, structure/03-server-api.md:266도 함께 갱신 대상이다.

## B4 [Medium] fps FIELD_RULE 예시가 발화 불가 — ACCEPT

재확인: 등록된 그래프 실측 결과

    92  SaveVideo               [video, filename_prefix, format, codec]
    130 CreateVideo             [images, audio, fps, bit_depth]
    131 MiniMaxH3ImageToVideo   [clip, vae, prompt, width, height, length]

SaveVideo에 fps가 없다. inferBindCandidates는 `rule.input in node.inputs`를 요구하므로
그 규칙은 후보를 절대 만들지 못한다 — C-ACTIVATION-GROUNDING-01 위반이다.
EmptyMiniMaxH3LatentVideo도 그래프에 없다.

수정: 010의 FIELD_RULES 예시를 실측으로 교체한다.
length → MiniMaxH3ImageToVideo.length, fps → CreateVideo.fps. 존재하지 않는
EmptyMiniMaxH3LatentVideo 규칙은 삭제한다.

## B5 [Medium] CLI video 표면이 comfy에 도달할 수 없다 — ACCEPT

재확인: bin/commands/video.ts:130이 --provider를 grok|grok-api|runway|higgsfield로
열거하고 :201이 `body: { provider: "grok", ... }`로 하드코딩한다. lock 제거 후
modelResolver는 comfy 타깃을 통과시키지만 커맨드는 여전히 grok으로 제출한다.

수정: bin/commands/video.ts를 010의 scope IN과 파일 맵에 추가한다. wp3가 아니라
wp1이다 — 실행 경로의 일부이지 help 문구 문제가 아니다.

## B6 [Medium] 두 번째 grok 강제 캐스팅 — ACCEPT

재확인: storeVideoImpl.ts:297의 image-to-video 경로에 :129와 동일한 캐스팅이 있다.

수정: 010 §7의 대상에 :297을 추가한다.

## B7 [Low] validateBindings 심볼 부재 — ACCEPT

실제 역직렬화 검사는 normalizeWorkflowRecord (lib/comfyWorkflowStore.ts:124)다.
010의 §1 문구를 고친다.

## B8 [Low] binding/param 충돌 — ACCEPT

MiniMaxH3ImageToVideo.length(=243)가 현재 미바인딩 스칼라라 deriveParams가 params로
노출한다. length 바인딩을 추가하면 같은 입력을 param과 binding이 동시에 쓴다.

수정: 010에 우선순위 규칙을 명시한다 — 바인딩이 param을 이긴다. bindGraph에서
바인딩 대상 입력은 params 적용에서 제외한다. 기존 저장 레코드의 params 재유도는
필요 없다(적용 시점에 배제하므로).

## B9 [Low] VHS gifs 키 미검증 — ACCEPT AS-IS

리뷰어의 검색 예산이 소진됐다. 다만 main의 Luna lane이 VideoHelperSuite nodes.py
소스를 열어 확인했고, 등록된 그래프는 core SaveVideo를 쓰므로 이 경로는 호환성
보조일 뿐이다. 010에 이미 "core 계약이 아니다"라고 적혀 있으므로 추가 조치 없음.

## 리뷰어가 확인해준 사항 (수정 불요)

- tsconfig.json:37이 ui와 tests를 exclude → typecheck가 ui/src를 관측하지 않는다는
  계획의 주장은 참. ui build만이 UI 회귀를 잡는다.
- routes/models.ts:55/317-321, routes/video.ts:188, GenProviderModelSelect.tsx:197-198,
  collectImages 234-245, IMAGE_INVALID 275-278, FIELD_RULES 82-93 모두 일치.
- LEXICO-SPLIT-01 / DIFFLEVEL-ROADMAP-01 준수.
- 12 lane과 등록 H3 레코드(origin 127.0.0.1:18188, output node 92) 일치.

## 게이트 baseline (main이 직접 실행, 2026-08-25)

    npm run typecheck        exit 0
    npm run typecheck:tests  exit 0
    npm test                 exit 0 — tests 2547 / pass 2545 / fail 0 / skipped 2

참고: 리뷰어와 AGENTS.md는 테스트를 1094건으로 적고 있으나 실측은 2547건이다.
이 드리프트는 wp4의 SoT 동기화 대상이다.

## 판정

6개 블로커 전부 계획 문서 수정으로 흡수 가능하며, 잔여 블로커 없음.
main 판정: near-pass가 아니라 **pass** — 모든 High/Medium이 구체 수정으로 접혔다.
