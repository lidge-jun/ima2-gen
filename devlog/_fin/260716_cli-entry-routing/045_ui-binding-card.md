# 045 — wp4 슬라이스 4: UI — binding 카드 + MCP composer 캐릭터 슬롯 (diff-level)

상위 스펙: 041 결정 4, 001 D2/D5. wp6-ui work-phase 명세. 선행: 042(저장), 043(요청).

## NEW `ui/src/components/assets/CharacterBindingsCard.tsx`

ElementDetail 전용 카드. props: `elementId`, `bindings: CharacterProviderBinding[]`,
`refs: string[]`, `onChange(bindings)`.

- kind=character일 때만 ElementDetail이 렌더.
- Runway 행: provider 칩 + mode(stateless refs) + tag 편집 input(1-32자 패턴 검증)
  + refs 수 표시(n/3, cap 초과 시 경고 칩 — 043 §3 서버 규칙과 같은 문구).
- Higgsfield 행: 결제/연결 전이므로 Train 버튼 disabled + "유료 플랜 필요" 배지.
  비활성 근거는 capabilities contract의 executable=false(051 결정 5와 같은 소스,
  ad-hoc 추정 금지). status/trainedAt이 있으면 status chip으로 표시.
- drift 경고: bindingDrift(refs, binding) true면 "refs가 학습 시점과 다릅니다" 칩.
- 문법: 312ce1b chrome grammar — radius 토큰, status chip, 조용한 pill
  (element-detail.css 패턴 준용, 새 컬러 도입 금지).

## MODIFY `ui/src/components/assets/ElementDetail.tsx`

- `CharacterProviderBinding` 미러 타입 import(`ui/src/lib/characterBinding.ts`).
- 저장 페이로드에 characterBindings 포함(draft 확장 — PATCH /api/assets/:id가
  metadata를 통째로 받으므로 라우트 변경 없음).
- refs 제거 시 서버 409 REFS_BOUND_TO_CHARACTER를 기존 error state로 표시.

## NEW `ui/src/lib/characterBinding.ts` (순수 함수, 계약 테스트 대상)

```ts
export function characterSlotEligible(inputRoles: string[] | undefined): boolean
  // capabilities contract inputRoles에 "image_references" 포함 시 true
export function resolveCharacterConflict(args: { mentionElementIds: string[]; characterElementId?: string }): "ok" | "conflict"
  // 클라이언트 선제 안내용 — 서버 409(043 §2)와 같은 규칙
export function bindingDrift(refs: string[], binding: CharacterProviderBinding): boolean
  // 042 §4와 같은 규칙의 프론트 미러
```

주의(이중 구현): drift 규칙은 서버(042)와 여기 두 곳에 존재한다. 규칙 변경 시
양쪽을 함께 바꾸고, 테스트 케이스 행렬(042 테스트 6 = 여기 테스트 3)이 같은
입력/기대값을 쓰는지 diff로 확인한다. 규칙이 복잡해지면 shared 모듈로 승격한다.

## MODIFY MCP 슬롯 — `ui/src/components/settings/McpGenerationControls.tsx`

- 선택된 MCP 모델의 inputRoles에 image_references가 있을 때만 "Character" 선택
  슬롯 노출(characterSlotEligible).
- 슬롯은 character element 목록(GET /api/assets?kind=element&elementKind=character)에서
  1개 선택. 선택 시 요청 body에 characterElementId.
- mention(@)으로 element가 이미 붙어 있으면 슬롯 비활성 + 안내 툴팁
  (resolveCharacterConflict="conflict" — 서버 409를 UX로 선제 회피).

## 계약 테스트 — NEW `tests/character-binding-ui-contract.test.ts`

(ui 로직은 순수 함수로 격리해 node:test로 검증 — 기존 ui-contract 테스트 패턴 준용)

1. characterSlotEligible: image_references 포함/미포함/undefined.
2. resolveCharacterConflict: mention만/character만/둘 다/없음.
3. bindingDrift 프론트 미러: 042 테스트 6과 같은 케이스 행렬.
4. refs 4장 + runway 바인딩 → cap 경고 조건(n>3) true.

## Activation 시나리오

- 충돌 선제 비활성: 테스트 2의 "둘 다" 케이스.
- cap 경고: 테스트 4.
- 시각 확인: C에서 assets 워크스페이스를 띄워 카드 렌더를 스크린샷 관측
  (C-RENDER-GROUNDING-01 — 신규 컴포넌트).

## Accept

`npm run typecheck` + 신규 4건 green + `cd ui && npm run build` green +
렌더 관측 증거(devlog에 스크린샷).
