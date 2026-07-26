# 046 — wp4 슬라이스 5: CLI `ima2 gen/video --character` (diff-level)

상위 스펙: 041 결정 5, 000 A1(fail-closed)/A2(lane id). wp7-cli work-phase 명세.
선행: 042-044(서버 계약). CLI는 서버 계약의 thin client다.

## MODIFY `bin/commands/gen.ts`, `bin/commands/video.ts`

- 플래그: `--character <element-id|name>` (gen, video 공통).
- MCP 레인(runway/higgsfield)에서만 유효. 코어 레인에서 --character 사용 시
  exit 2 + `CAPABILITY_MISMATCH`(코어 레인은 generic mention/elementIds 경로 —
  060의 구분 경고와 일치).
- id|name 해석: id 정확 매치 우선, 없으면 name 정확 매치, 복수/없음은 exit 2
  + 후보 리스트(wp1 resolver의 모델 해석 패턴 준용).
- 해석된 element를 서버에서 조회해 아래 프리체크 후 body에 characterElementId를 실어
  bin/lib/mcpJob.ts submitJob으로 전달(body 필드 추가만, mcpJob 구조 변경 없음).

## NEW `bin/lib/characterResolve.ts`

```ts
export async function resolveCharacterElement(serverBase, idOrName): Promise<ElementRecord>
  // GET /api/assets?kind=element&elementKind=character → id/name 매치
export function precheckCharacterBinding(element, provider, inputRoles): CliError | null
  // 아래 봉투 코드 반환 규칙
```

## JSON 에러 봉투 (exit 2, --json 시 stdout 구조화 — wp1 봉투 계약)

원칙: CLI 프리체크는 빠른 UX hint일 뿐이고, 최종 의미 판정은 항상 서버 응답이다.
서버 규칙이 변하면(새 status 등) 프리체크를 통과한 요청이 서버에서 거부될 수 있고,
그 경우 서버 코드가 그대로 노출된다 — 이 우선순위가 drift 시의 안전 방향이다.

| 코드 | 조건 | fix |
|---|---|---|
| `CHARACTER_ELEMENT_NOT_FOUND` | id/name 매치 없음 | character element 목록 안내 |
| `CHARACTER_BINDING_MISSING` | 선택 provider lane의 binding 없음 | assets UI에서 바인딩 추가 안내 |
| `CAPABILITY_MISMATCH` | 모델 inputRoles에 image_references 없음 / 코어 레인 사용 | image_references 선언 모델 리스트 |
| `BINDING_NOT_READY` | status training/failed | training 완료 대기/retrain 안내 |
| `CHARACTER_ELEMENT_CONFLICT` | --character와 mention 계열 플래그 동시 사용 | 한쪽만 쓰라는 안내 |

서버가 409/400으로 닫는 경로는 서버 코드를 그대로 통과(mcpJob의 responseError가
code를 보존하므로 매핑 테이블만 추가 — bin/lib/output.ts die 경로 유지).

## 계약 테스트 — NEW `tests/cli-character-contract.test.ts`

(기존 tests/cli-commands.test.js의 로컬 서버 harness 패턴 확인 후 준용)

1. --character + 코어 레인 → exit 2 CAPABILITY_MISMATCH.
2. binding 없는 character → exit 2 CHARACTER_BINDING_MISSING.
3. image_references 미선언 모델 → CAPABILITY_MISMATCH.
4. 서버 409 CHARACTER_ELEMENT_CONFLICT 응답 → CLI가 코드 보존해 exit 2.
5. name 정확 매치/복수 매치/없음 3분기.
6. --json 시 stdout이 구조화 봉투(code+fix)임을 파싱으로 증명.

## Activation 시나리오

- 각 봉투 코드: 테스트 1-4가 해당 분기를 실제로 침(행복 경로 없음 —
  실생성은 과금이라 범위 밖, 041 Accept 6은 사용자 승인 별도).

## 문서 반영

- `skills/ima2/SKILL.md`의 CLI 레퍼런스에 --character 한 줄 추가(패키지 스킬이
  CLI 표면의 SoT — wp2 이관 규칙).

## Accept

`npm run typecheck` + `npm run typecheck:tests` + 신규 6건 + cli-commands 회귀 green.
