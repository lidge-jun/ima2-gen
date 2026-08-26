---
created: 2026-08-25
tags: [ima2-gen, devlog, phase1, stale-check]
---

# 011 — wp1 P: stale check

010은 wp0 사이클에서 선작성됐고 감사 후 수정됐다. B 진입 전 현재 트리와 대조한다.

## 대조 결과

| 010의 주장 | 현재 트리 | 판정 |
|---|---|---|
| routes/models.ts:55 lock 상수 | 동일 | 유효 |
| routes/models.ts:317-321 무조건 lock | 동일 | 유효 |
| routes/video.ts:188 grok-only 게이트 | 동일 | 유효 |
| GenProviderModelSelect.tsx onModelChange 조기 return | :197-198에 존재 | 유효 |
| storeVideoImpl.ts :129 / :297 강제 캐스팅 | 둘 다 존재 | 유효 |
| collectImages가 images만 수집 | :234-245 동일 | 유효 |
| downloadImage의 detectImageMimeFromB64 | :274-277 동일 | 유효 |
| lib/providerOptions.ts:75-87 세 번째 lock | 동일 | 유효 |
| 등록 workflow의 노드 구성 | SaveVideo 92 / CreateVideo 130 / MiniMaxH3ImageToVideo 131 | 유효 |

010은 stale하지 않다. 수정 없이 그대로 실행한다.

## 추가 실측: 폴링 루프 구조

comfyImageAdapter.ts:393-440의 루프는 history 부재 시 queue를 교차 확인하고
`missing >= 3`에서 포기한다. 010이 말한 "video일 때 허용치 상향"은 이 카운터를
가리킨다. 실제로는 **history 지연**과 **job 소멸**이 같은 카운터를 공유하므로,
video 경로에서 이 값을 올리면 소멸 감지도 함께 둔해진다. B에서는 카운터를 나누는
대신 `entry.status.completed === true`인데 outputs만 비어 있는 경우를 **별도 분기**로
처리한다 — 이게 실제 race의 모양이고, queue 소멸과 구분된다.

## 환경 제약 (실측)

    curl http://127.0.0.1:18188/system_stats
    curl: (7) Failed to connect to 127.0.0.1 port 18188

등록된 H3 workflow의 origin이 죽어 있다. 이는 사용자의 로컬 GPU 박스이며 이 루프의
쓰기 범위 밖이다. 영향:

- c-2 (route 수락 + 검증된 artifact): 테스트 fixture와 fired-branch trace로 닫을 수
  있다. 라이브 GPU 실행은 필요 없다.
- c-3 (UI에서 H3 선택 가능): 010이 "origin이 살아 있을 때"로 조건을 걸었다. origin이
  죽어 있으면 UI는 의도대로 offline disable을 유지하므로, 이 상태로는 선택 가능성을
  증명할 수 없다. B에서 로컬 stub origin을 띄워 workflow 하나를 등록하고 렌더 관측을
  수행한다 — 사용자의 GPU 박스를 건드리지 않고 UI 계약을 증명하는 방법이다.

이 제약과 우회 방법을 D에 명시한다.
