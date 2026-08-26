---
created: 2026-08-23
tags: [ima2-gen, devlog, comfyui, minimax-h3, evidence]
---

# 010 — wp1 업데이트 실행 기록

## 수행

| 단계 | 결과 |
|---|---|
| git fetch + checkout | v0.27.0-15 → **v0.33.3** (detached at 4da9e2db) |
| pip install -r requirements.txt | exit 0 |
| 재시작 | 구 PID 912433 kill → 신 PID 927686 |
| /system_stats | comfyui_version **0.33.3**, frontend 1.49.6 요구 충족 |
| /object_info | 1792 nodes; H3 네이티브 노드 확인: EmptyMiniMaxH3LatentAV, MiniMaxH3ImageToVideo, MiniMaxH3ReferenceToVideo, MiniMaxH3SigmaShift (+ API 노드 계열 MinimaxHailuo03*) |

감사자 잔여 지적("H3 노드 없으면 020 전 하드스톱")은 실측으로 해소 —
코어 업데이트만으로 노드가 존재하며 커스텀 노드 팩은 불필요하다.

## torch 결정: cu128 유지

torch 2.11.0+cu128을 유지한다. 근거:

- NVFP4 가중치는 cu128에서도 로드·실행된다(가속만 손해, FP8 대비 느림).
- 생성 검증이 이 유닛의 1차 목표이고, venv 교체는 검증 전 리스크만 늘린다.
- cu130 업그레이드는 T2V/I2V 검증 후 성능 최적화 단계로 이연 가능.

드라이버 580.173.02는 CUDA 13 세대라 향후 cu130 전환에 장애물이 없다.
