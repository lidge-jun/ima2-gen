---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, outcome]
---

# 090 — 유닛 결론

**결과: DONE** (wp0-wp6). wp7은 머지 경계 밖으로 이연.

ima2가 로컬 ComfyUI를 **호출해서** 이미지를 받는다. `/v1` shim 없고,
감시 자식 프로세스 없다.

## 사이클별 착지

| WP | 내용 | 커밋 |
|---|---|---|
| wp0 | docs-only 로드맵 11문서, 감사 3라운드 | `ed05621f` + 머지 `da1b2ea9` |
| wp1 | 스키마·스토어·바인딩·tEXt 리더·레지스트리 이음매 | `dbf4b588` |
| wp2 | 어댑터 제출/폴링/수신/취소/헬스 | `ac5ebc2e` |
| wp3 | 파이프라인·라우트·inflight meta·표면 가드 | `ab489471` |
| wp4 | CLI 워크플로 서브커맨드 | `a9be0310` |
| wp5 | UI 관리자·셀렉터·4개국어 | `7bbc3573` |
| wp6 | SoT·게이트·정리 | 본 커밋 |

**머지 상태 정정**: 060은 `codex/comfy-provider-lane`에서 작업 후 dev로
머지한다고 적었으나, wp0의 머지가 HEAD를 dev에 남겼고 wp1-wp5가 dev에 직접
쌓였다. 목표의 "merged into local dev"는 구조적으로 충족돼 있다.
브랜치를 인위적으로 만들어 문서에 맞추지 않았다 — 그건 겉모습을 위해 실제
이력을 다시 쓰는 일이다. `git log origin/dev..dev` = 로컬 전용 커밋들,
원격 ref 생성 0건.

## 게이트 (2026-08-23, exit code 실측)

    npm run typecheck                              0
    npm run typecheck:tests                        0
    cd ui && npx tsc -p tsconfig.app.json --noEmit  0
    npm test                                       0   (2493 tests, 2491 pass, 0 fail, 2 skip)
    npm run test:inventory                         0
    generate-provider-types.mjs --check            0
    refresh-structure-line-counts.mjs --check      0
    check-devlog-citations.mjs                     0
    cd ui && npm run build                         0

시작 시점 2434 → 2493. 신규 59개.

## 근거 등급 — 무엇이 1차이고 무엇이 아닌가

**1차 근거 (실기 확인)**

| 항목 | 기록 |
|---|---|
| 프로토콜 계약 전반 | 001 |
| 클라이언트 지정 UUID prompt_id 수용 | 001 |
| `/queue delete`가 running에 200을 주고도 무시 | 001 |
| `/interrupt`가 running을 중단, history에 completed:false | 001 |
| PNG tEXt에 API 그래프 임베드 | 001 + wp1 테스트가 실제 파일로 검증 |
| 어댑터 단독 왕복 (3.7초) | 004 |
| 파이프라인 왕복 + 사이드카 쌍 저장 (3.6초) | 005 |
| CLI 등록·거부·생성 (2.9초) | 006 |
| 설정 UI 렌더 + 부분 오프라인 | 007 |
| **취소가 ComfyUI 큐를 실제로 비움** | 완료 감사 (아래) |

### 완료 감사 재현 (2026-08-23, 최종 트리)

wp6 종료 후 **처음부터 다시** 확인했다. 소스 재빌드 → 새 스크래치 config로
서버 기동 → 빈 레인 → PNG에서 워크플로 등록 → 생성 → 거부 경로들.

    1) 빈 레인          "No workflow registered. Add one with: ..."
    2) PNG에서 등록      ✓ audit -> http://127.0.0.1:18188
    3) /api/models      status=ready  models=['audit']  desc=['http://127.0.0.1:18188']
    4) CLI 생성          ✓ 2.9s
    5) 사이드카          provider=comfy  comfyPromptId=d3384c30-...  comfyOrigin=http://127.0.0.1:18188
                        comfyWorkflow=audit  format=png
    6) 미등록 id         COMFY_WORKFLOW_NOT_FOUND
    7a) multimode       COMFY_SURFACE_UNSUPPORTED (SSE error, status 400)
    7b) node            COMFY_SURFACE_UNSUPPORTED [400] + parentNodeId
    8) probe 형식오류    COMFY_URL_NOT_LOCAL [400]
       probe 도달불가    {ok:true, health:{ok:false}} [200]

**취소 실기 승격**: 1536x1536 / 60 steps 작업을 3.5초 뒤 abort했다.

    threw code = GENERATION_CANCELED status = 499 after 4436 ms
    queue_running after cancel = 0
    queue_pending after cancel = 0

ComfyUI 큐가 실제로 비었다 — wp2에서 고친 sleep 버그가 남아 있었다면
GPU가 계속 돌았을 것이다. 이로써 취소는 stub이 아니라 **1차 근거**다.

**2차 근거 (미검증으로 남음)**

| 항목 | 이유 |
|---|---|
| 다중 인스턴스 prompt_id 격리 | 8189가 ComfyUI가 아닌 `comfyui_hooking_server` |
| i2i `/upload/image` → LoadImage 왕복 | 참조 바인딩을 가진 워크플로 미보유 |
| 큐 위치 보고 (`onQueue`) | 작업이 첫 폴링(1초) 전에 끝남. stub 테스트만 |
| 셀렉터 드롭다운 열림 상태 | agbrowse가 combobox 미해결. 소스 단언만 |
| 깊은 큐 + 90분 TTL | 조사만 하고 코드는 안 바꿈 (아래) |

origin 페어링 설계는 **보수적으로 옳지만 N대 실증은 없다.**

## 계획이 틀렸던 지점 셋

로드맵을 그대로 따랐다면 나빠졌을 곳들이다. 전부 P 단계 stale-check가 잡았다.

1. **PNG 파서** (000 → 001): "저장소에 PNG-info 파서가 있다"고 적었으나
   `lib/pngInfo.ts`는 26줄 IHDR 리더다. tEXt 리더를 새로 만들었다.
2. **modelResolver 우회** (040 → 006): "파생 집합으로 검증하니 우회가
   필요"라 적었으나 실제로는 라이브 카탈로그로 해석한다. 우회를 넣었다면
   `MODEL_NOT_FOUND`와 `LANE_UNAVAILABLE`을 **제거**했을 것이다.
3. **파리티 정규식** (040 → 006): 그 목록은 comfy를 거부하는 legacy 표면
   것이다. 거기 적었다면 코드가 거부하는 기능을 문서가 광고했을 것이다.

## 테스트가 잡은 실제 버그

**취소 시 GPU 고아 작업** (wp2). 폴링 루프가
`await sleep(interval, options.signal)`로 끝나서, abort가 sleep 안에서
던져지면 루프 상단의 취소 처리를 건너뛰었다. ima2는 "취소됨"이라 답하는데
ComfyUI는 통보를 못 받아 아무도 안 기다리는 작업을 계속 돌린다. 로컬
GPU에서는 다음 작업이 그만큼 밀리는 실질 피해다.

**공허하게 통과하던 테스트** (wp2). 어댑터 등록 직후 계약 테스트가 전부
통과했는데 거짓이었다 — 빌드 산출물이 없어 comfy가 순회 대상에서 조용히
빠졌다. 빌드 후 진짜 실패 둘이 드러났고, 그중 하나는 리뷰어가 예고한
빈배열-대-빈배열 비교였다.

**CSS 부재** (wp5). 타입체크도 테스트 2493개도 UI 빌드도 못 잡았다.
화면을 봐야만 보이는 결함이었다.

## TTL 처분 (030 accept 4)

`purgeStaleJobs`는 `started_at` 기준 90분 초과 행을 DELETE만 하고 워커를
중단시키지 않는다. 조사 결과 고아 파일이 생기는 게 아니라 **추적을 잃은
정상 저장**이다.

**코드를 바꾸지 않았다.** 실측 작업이 3.6초고, comfy만 TTL을 늘리면
inflight가 레인별 정책을 갖게 되어 단일 기준이 무너지며, `phase_at`
갱신으로는 해결되지 않는다(purge는 `started_at`만 본다). 진짜 수정은
"TTL 초과 시 컨트롤러도 abort"이며 그건 comfy가 아니라 inflight의 변경이라
별도 유닛에 속한다.

## 다음 결정권자에게

**wp7 (070)**: multimode/node/agent 지원. 현재 세 표면은
`COMFY_SURFACE_UNSUPPORTED` 400으로 거부한다 — 조용한 OAuth 대체를 막기
위한 장치이지 지원이 아니다. 070은 아직 diff-level이 아니며, 승격 시점은
wp7의 P다(문서 안에 명시).

**후속 후보**

- 동적 파라미터 폼: `params` 계약은 도출·노출되지만 UI 렌더링은 미구현
- 마스크 인페인팅: `LoadImageMask` 바인딩 확장 필요
- WS `/ws` 진행률: 폴링으로 충분해 미구현. origin당 연결이 하나 더 는다
- 워크플로 재바인딩: `add --replace`로 대체 중

**운영 메모**: 검증 중 lidge의
`llama-server-qwen38.service`를 정지시키고 ComfyUI를 8188에 띄웠다.
되돌리려면 `systemctl --user start llama-server-qwen38.service`.
둘은 GPU 32GB를 두고 경합한다(llama 약 5.4GB 상주). 검증 중 NVIDIA
드라이버 불일치(커널 580.159.03 vs 패키지 580.173.02)를 발견해 모듈
재로드로 복구했다 — 이건 comfy와 무관한 선행 사고이며 001에 기록했다.
