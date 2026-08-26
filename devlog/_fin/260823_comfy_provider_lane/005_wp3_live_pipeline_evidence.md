---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, evidence, live, phase3]
---

# 005 — wp3 파이프라인 실기 왕복 기록

030의 accept criteria 1번을 stub이 아닌 **실제 왕복**으로 충족한 기록이다.
wp2는 어댑터 단독이었고, 이번엔 `POST /api/generate` → `runGeneratePipeline`
전 구간이다.

## 결과

    [inflight.start]        requestId="live-wp3-1787418473990" kind="classic"
    [inflight.phase]        phase="streaming"
    [generate.request]      provider="comfy" model="pipe-sdxl" size="768x768" webSearchEnabled=false
    [comfy.generate:start]  workflow="pipe-sdxl" origin="http://127.0.0.1:18188"
    [comfy.generate:done]   promptId="6af32b84-0950-4479-9a6f-dd53eba4fad2"
    [generate.saved]        imageCount=1 elapsedMs=3632 filename="pipe-sdxl_1x1_20260822_a-single-red-maple-l_0.png"
    [inflight.finish]       status="completed" durationMs=3635 httpStatus=200

    http 200 elapsed_ms 3659
    sidecar.provider        comfy
    sidecar.comfyPromptId   6af32b84-0950-4479-9a6f-dd53eba4fad2
    sidecar.comfyOrigin     http://127.0.0.1:18188
    sidecar.comfyWorkflow   pipe-sdxl
    sidecar.format          png

증거물: `evidence/003_wp3_pipeline_roundtrip.png`.

## 확인된 것

| 항목 | 결과 |
|---|---|
| 라우트 → providerOptions → 디스패치 | `activeProvider`가 comfy로 유지 — oauth 대체 없음 |
| inflight 수명주기 | start → phase → finish(completed, 200) |
| **prompt_id + origin 쌍 저장** | 사이드카에 세 필드가 함께 기록됨 |
| 파일명 규칙 | 워크플로 id가 모델 자리에 들어감 |
| **포맷 유지** | `png` — comfy를 `providerForcesJpeg`에 넣지 않은 결정이 실제로 알파 보존 경로를 만든다 |
| 매직바이트 mime 신뢰 | `providerReportsMime`에 comfy가 있어 PNG가 PNG로 저장됨 |

마지막 두 줄이 이 사이클의 핵심 설계 결정이다. 다른 로컬-이미지 레인들은
전부 JPEG를 강제하는데 comfy만 예외로 뒀다. 워크플로가 배경 제거 노드로
끝날 수 있고, 그 경우 JPEG 강제는 방금 만든 알파를 납작하게 만든다.

## queuePosition은 여전히 stub 근거

`onQueue`는 이번에도 발화하지 않았다. 8 steps 작업이 첫 폴링(1초) 전에
끝나기 때문이다. 004와 같은 이유이며, 큐 대기 경로는
`tests/comfy-provider-contract.test.ts`의
`waits while the job is queued and reports its position`이 덮는다.

**즉 phase가 queued↔streaming으로 전환되는 것은 stub 근거다.** 라이브에서
본 것은 streaming뿐이다.

## TTL 상호작용 조사 (030 accept 4)

`purgeStaleJobs`(lib/inflight.ts:438)는 `started_at` 기준으로 90분 초과
행을 DELETE만 하고 워커를 중단시키지 않는다. 코드를 읽어 확인한 결과:

- 행이 사라져도 `isJobCanceled`는 false다(터미널 기록이 없으므로).
- `setJobPhase`는 no-op이 된다(`getJob`이 null).
- 어댑터는 계속 폴링하다 성공하면 **파일을 정상 저장한다.**
- UI는 그 잡을 잊은 상태가 된다.

즉 고아 파일이 생기는 게 아니라 **추적을 잃은 정상 저장**이다.

**처분: 이번 유닛에서는 코드를 바꾸지 않는다.** 근거 셋.
첫째, 90분을 넘기는 로컬 큐는 관측된 적이 없다(실측 작업당 3.6초).
둘째, comfy만 TTL을 늘리면 inflight가 레인별 정책을 갖게 되어
`purgeStaleJobs`의 단일 기준이 무너진다.
셋째, `phase_at` 갱신으로는 해결되지 않는다 — purge는 `started_at`만 본다.

대안이 필요해지면 진짜 수정은 "TTL 초과 시 컨트롤러도 abort" 쪽이며,
그건 comfy가 아니라 inflight의 변경이라 별도 유닛에 속한다.

## 여전히 2차 근거

- 다중 인스턴스 prompt_id 격리 (8189가 다른 서비스)
- i2i `/upload/image` 왕복 (참조 바인딩 워크플로 미보유)
- 큐 위치 보고 (stub만)
