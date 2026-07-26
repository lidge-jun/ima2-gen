# 044 — wp4 슬라이스 3: provider 브리지 — runway 전개 마무리 + higgsfield 상태 게이트 (diff-level)

상위 스펙: 041 결정 3/5, 040 §2. wp5-bridge work-phase 명세. 선행: 043.

## 배경 (실측 확인 2026-07-20)

- runway adapter는 이미 `referenceImages[{url,tag}]` 인자를 지원한다
  (lib/mcp/adapters/runway.ts:123-131 referenceImagesArg, :145/:162 generate 호출).
  따라서 runway 전개는 043의 refs→localReferences→upload→referenceImages
  파이프라인으로 완결되며 adapter 변경은 없다.
- higgsfield adapter는 catalog-only — buildGenerateCall 등 전부 MCP_EXECUTION_LOCKED
  throw. /api/mcp/generate는 executable 체크가 먼저 닫는다(routes/mcpMedia.ts:235).

## MODIFY `routes/mcpMedia.ts` — 상태 게이트 순서 확정

043 §3의 status 규칙을 이 순서로 고정(게이트 순서가 계약):

1. `!adapter.executable` → 409 MCP_EXECUTION_LOCKED (기존, 어떤 게이트보다 먼저).
2. binding.status === "training" | "failed"(trained-id) → 409 `BINDING_NOT_READY`
   + `{ status, fix: ["wait for training to finish or retrain"] }`.
3. runway stateless-refs는 status가 없어도 ready로 간주(생성마다 refs를 재전송하므로
   사전 준비 상태가 없다 — 040 Runway stateless 판정).

## MODIFY `lib/mcp/adapters/higgsfield.ts` — 주석만

unlock 사전조건 목록(기존 G2 주석, :7)에 한 줄 추가: character bridge 시
trained-id binding은 externalId(soul_id)를 params.soul_id로 전달하고 status를
trainedAt과 함께 갱신한다(041/044). unlock 구현 때 tests/mcp-character-route.test.ts의
BINDING_NOT_READY 케이스를 실제 adapter로 교체할 것.

## 계약 테스트 — `tests/mcp-character-route.test.ts`에 추가

8. higgsfield lane + characterElementId → 409 MCP_EXECUTION_LOCKED
   (게이트 순서 증명: 바인딩 없는 element로도 바인딩 에러가 아니라 LOCK이 먼저).
9. 실행 가능 adapter stub(deps 주입으로 executable=true higgsfield 모사)
   + status=training binding → 409 BINDING_NOT_READY.
10. runway stateless binding에 status 없음 → 정상 전개(게이트 미적용).

## Activation 시나리오

- 게이트 순서: 테스트 8(바인딩 에러가 먼저 나오면 순서 위반).
- BINDING_NOT_READY: 테스트 9가 stub adapter로 도달 증명(실 higgsfield로는 도달
  불가 — 결제 게이트, 040/001).

## Accept

`npm run typecheck` + 누적 10건 green + higgsfield.ts 주석 외 adapter 무 변경을
`git diff lib/mcp/adapters/`로 확인.
Higgsfield unlock 구현 시에는 BINDING_NOT_READY의 stub adapter 테스트를 실제
adapter activation으로 교체하는 것이 unlock work-phase의 Accept에 포함된다
(stub green만으로 unlock 완료를 주장하지 않는다).
