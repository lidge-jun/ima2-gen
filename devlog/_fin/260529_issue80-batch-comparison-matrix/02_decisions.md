# Issue #80 Decisions (2026-06-21 Interview)

## Confirmed

| Decision | Value | Rationale |
|----------|-------|-----------|
| 진입점 | **Classic Mode 확장** | Agent Mode가 아닌 Classic 생성 화면에 비교 옵션 추가 |
| 최대 셀 수 | **9 (3×3)** | 4×4는 과도, 3축 × 3옵션이면 충분 |
| 구현 시점 | **설계 확정, 구현 나중에** | 선행 의존 #78/#79 해소됨, 기술적 blocker 없음 |
| 선행 의존 | #78 CLOSED, #79 CLOSED | 해소 |

## Impact on MVP Design (01_phase1_mvp_design.md)

기존 설계는 Agent Queue 재사용 전제. Classic Mode 확장으로 변경 시:

1. **Agent Queue 불필요** — Classic generate API (`POST /api/generate`)를 N회 호출하는 방식으로 단순화
2. **UI 진입점**: Classic 모드 우측 패널 or 프롬프트 컴포저 옆에 "Compare" 토글
3. **그리드 상한**: 9셀 (기존 16 → 9). `MAX_COMPARISON_CELLS = 9`
4. **DB 변경 불필요** — agent_queue_items에 comparison_id 추가 안 함
5. **결과 표시**: 기존 갤러리 그리드 확장 or 별도 ComparisonGrid 오버레이

## Revised Implementation Shape

```
Classic Mode PromptComposer
  └─ [Compare] 토글 → ComparisonAxisPicker (model/quality/size 체크박스)
     └─ "Generate 6 variants" 버튼
        └─ 6× POST /api/generate (bounded concurrency)
           └─ ComparisonGrid 오버레이 (3×2 그리드, 축 라벨)
```

## Status

**CONFIRMED** — 설계 확정 완료. 구현은 별도 PABCD로 착수 시 진행.
