---
created: 2026-08-24
tags: [ima2-gen, devlog, rca, pyav, minimax-h3, phase2]
---

# 026 — PyAV duration 단위 RCA

H3 generation과 output 검증은 성공했지만 최초 summary의 duration이
`10125000000000.0`으로 잘못 기록됐다.

RCA: PyAV `container.duration`은 AV_TIME_BASE 단위이고 `av.time_base`는
1,000,000 상수다. runner가 곱셈을 사용했다.

Fix:

```diff
- container.duration * av.time_base
+ container.duration / av.time_base
```

기존 MP4를 다시 열어 corrected probe/result를 갱신한다. 비디오 생성 자체는
재실행하지 않는다.

추가 receipt 결함: `date -Ins`가 fractional seconds 앞에 comma를 출력해 CSV
열이 하나 밀렸다. 기존 104행은 7-field 위치 기반으로 복구했고, harness는
comma 없는 `%Y-%m-%dT%H:%M:%S%z` timestamp로 수정했다. generation verdict와
GPU 측정값은 손실되지 않았다.
