---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, evidence, live, phase2]
---

# 004 — wp2 어댑터 실기 왕복 기록

020의 accept criteria 4번("라이브 재현, 가능할 때")을 충족한 기록이다.
stub 테스트가 아니라 **프로덕션 `generateViaComfy`를 실제 ComfyUI에 대고**
돌렸다.

## 경로

    ssh -N -L 18188:127.0.0.1:8188 lidge
    node <probe> -> generateViaComfy(...) -> http://127.0.0.1:18188

ComfyUI 0.27.0, RTX 5090, 체크포인트 `rinFlanimeIllustrious_v30`.
워크플로는 wp1의 `putWorkflow`로 스크래치 configDir에 등록했고, 그래프는
001과 같은 7노드 SDXL이다.

## 결과

    [comfy.generate:start] requestId="9f8e7d6c-5b4a-4392-8281-706f5e4d3c2b" workflow="live-sdxl" origin="http://127.0.0.1:18188" refs=0
    [comfy.generate:done]  requestId="9f8e7d6c-..." workflow="live-sdxl" promptId="9f8e7d6c-..."
    elapsed_ms      3657
    promptId        9f8e7d6c-5b4a-4392-8281-706f5e4d3c2b
    origin          http://127.0.0.1:18188
    effectiveModel  live-sdxl
    mime            image/png
    bytes           656038
    providerUrl     http://127.0.0.1:18188/view?filename=ima2_wp2_00001_.png&subfolder=&type=output
    queueEvents     []

증거물: `evidence/002_wp2_adapter_roundtrip.png` (768x768, 프롬프트
"a small wooden sailboat on a calm lake at sunrise" 와 내용 일치, 육안 확인).

## 확인된 것

| 항목 | 결과 |
|---|---|
| 워크플로 스토어 → 바인딩 → 제출 | prompt/negative/size/seed가 모두 그래프에 주입됨 |
| UUID requestId 재사용 | `promptId === requestId` — 서버가 우리 id를 그대로 채택 |
| `/history` 폴링 + `completed === true` 판정 | 정상 종료 |
| `/view` URL 조립 | `URLSearchParams`로 만든 URL이 실제로 이미지를 반환 |
| 매직바이트 MIME 판정 | `image/png`, 656,038 바이트 |
| `origin` 페어링 | 결과에 origin이 promptId와 함께 실림 |

`queueEvents`가 비어 있는 건 정상이다. 8 steps 작업이 첫 폴링(1초) 전에
끝나 큐 상태를 관측할 창이 없었다. **큐 대기 관측은 stub 테스트가 담당**
한다(`waits while the job is queued and reports its position`) — 001에서도
같은 이유로 pending을 못 봤고, 그래서 그 경로를 합성 테스트로 덮었다.

## 이 사이클에서 테스트가 잡은 실제 버그

취소 경로에 결함이 있었다. 폴링 루프 마지막 줄이
`await sleep(cfg.pollIntervalMs, options.signal)`이었는데, abort가 sleep
안에서 던져지면 **루프 상단의 취소 처리를 건너뛰고** 함수를 빠져나갔다.
ima2는 취소로 응답하지만 ComfyUI는 아무 통보도 받지 못해 **GPU가 아무도
기다리지 않는 작업을 계속 돌린다.**

수정: sleep에 signal을 넘기지 않고, 루프 상단의 검사가 먼저
`cancelComfyJob`을 호출하도록 했다. 계약 테스트
`cancels on abort and fires both cancel endpoints`가 이 회귀를 잡는다.

## 여전히 2차 근거로 남은 것

- **다중 인스턴스 prompt_id 격리**: 8189는 여전히
  `comfyui_hooking_server`다. origin 페어링 설계의 N대 부분은 미검증.
- **`/upload/image` → LoadImage i2i 왕복**: 어댑터에 구현했으나 실기
  미검증(참조 바인딩을 가진 워크플로가 없다).
- **깊은 큐 + 90분 TTL 상호작용**: wp3에서 다룬다.
