---
created: 2026-07-11
tags: [ima2-gen, canvas, design-decision]
---

# WP7 결정 — 구워진 노트 revert 경로 (G1)

원 RCA: `devlog/_fin/260711_canvas-i2i-annotation-cleanup/010_rca.md` 후속 과제.

선택: **옵션 (c) provenance 마커** (옵션 (a)를 fallback으로 내장).

- Apply가 만든 버전에 `annotationsBaked` provenance + 당시 주석 벡터 스냅샷을
  버전 메타데이터에 보존한다 (Apply 시 벡터 삭제는 유지하되 스냅샷을 남김).
- "노트 되돌리기" 액션: 대상 버전이 annotation-only(다른 픽셀 편집 누적 없음)면
  clean 베이스로 재구성 + 스냅샷 벡터를 편집 가능한 draft로 복원.
- 그 외(클린업 픽셀 편집이 섞인 버전)는 확인 다이얼로그(픽셀 편집 소실 경고)
  후 clean 소스로 revert — 옵션 (a) 동작.

근거: (b) 단독은 클린업 편집과의 충돌 해결이 회귀 위험(RCA 명시), (a) 단독은
주석만 구운 흔한 케이스에서 벡터를 불필요하게 잃음. (c)는 위험 케이스를
명시적 사용자 확인 뒤로 격리하면서 흔한 케이스의 비파괴 복원을 제공.
