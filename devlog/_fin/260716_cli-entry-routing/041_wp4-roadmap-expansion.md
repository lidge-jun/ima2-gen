# 041 — wp4 로드맵 확장: 현재 기능 반영 amendment

**Amendment 범위 (Sol 감사 blocker 3 반영):** 이 문서는 040의 다음을 치환한다 —
§1 데이터 모델의 `refFilenames` 필드와 저장 모델 설계, Accept 목록. 040의 조사 결론
(Runway stateless / Higgsfield trained-id 판정, 소스 근거 표)과 §2~§4의 방향은 유지한다.
040과 이 문서가 충돌하면 **041이 우선**하고, 언급 없는 항목은 040이 유효하다.
근거 인벤토리는 001(D1~D5), 실행 순서는 060이 소유한다.

## 결정 1 — 저장 모델: element.refs 재사용 + 보존 불변식

040 §1의 `refFilenames` 매니페스트를 폐기하고, 바인딩 레퍼런스는 `element.refs`를
canonical 저장소로 재사용한다(001 D1: refsCount/droppedRefs 관측성이 이미 갖춰짐).
이중 저장 drift를 없애는 대신, 040이 `refFilenames`로 지키려던 것(재학습 가능성)을
아래 불변식과 파생 필드로 보전한다.

```ts
type CharacterProviderBinding = {
  provider: "runway" | "higgsfield";
  mode: "stateless-refs" | "trained-id";
  externalId?: string;          // higgsfield soul_id (opaque)
  tag?: string;                 // runway @tag
  status?: "ready" | "training" | "failed";
  trainedAt?: string;
  trainedFromRefs?: string[];   // 파생 스냅샷 — train 호출 시점의 element.refs 복사본.
                                // canonical이 아니라 drift 감지/감사용 기록이다.
};
// element.meta.characterBindings?: CharacterProviderBinding[]
```

불변식 (반드시 문서와 계약 테스트로 고정):

1. 어떤 binding이든 `element.refs`를 참조하는 동안, 해당 refs는 cleanup/dedupe/asset move의
   대상이 되지 않는다. 제거하려면 명시적 unlink(binding 삭제 또는 retrain)가 먼저다.
2. `trainedFromRefs`는 저장소가 아니라 기록이다. `trainedFromRefs`와 현재 `element.refs`가
   다륾면 drift로 표시하고, retrain을 제안한다(자동 재학습 금지).
3. Runway stateless 모드는 매 생성 시 `element.refs`에서 최대 3장을 선택한다.
   자동 trimming은 하지 않는다 — 3장 초과 선택은 명시 에러(결정 5의 봉투)로 닫는다.

## 결정 2 — characterElementId × elementIds 충돌은 409

MCP 요청에 generic `elementIds`(mention 경유, 001 D1)와 `characterElementId`가 동시에 오면
머지하지 않고 fail-closed로 닫는다(060 경고의 계약 승격). 의미는 validation conflict이며
HTTP 409 + JSON 봉투로 반환한다:

```json
{"ok":false,"code":"CHARACTER_ELEMENT_CONFLICT",
 "fix":["character 바인딩을 쓰려면 mention(@)을 빼고 --character만 지정",
        "generic element refs를 쓰려면 characterElementId를 제거"]}
```

## 결정 3 — lineage/recovery: 강화 파이프라인 탑승 + 계약 테스트

WP4 전용 복구를 설계하지 않는다. recover의 입력 계약은 실측상
taskId+provider+kind뿐이다(`routes/mcpRecover.ts:86-104`, 001 D3). 따라서 lineage에
`taskId`와 `characterElementId`를 기록하는 것으로 recover 호환이 성립한다.
Accept에 "lineage(taskId+provider+kind)만으로 recover 재개" 계약 테스트를 둔다.
만약 구현 중 recover가 추가 입력을 요구하게 되면, ad-hoc 우회가 아니라 lineage 스키마
확장을 이 문서에 먼저 기록하고 진행한다.

## 결정 4 — UI: assets ElementDetail + mention 어휘 + capabilities 게이트

- 바인딩 카드는 `ui/src/components/assets/ElementDetail.tsx`에 추가. 새 chrome grammar
  (radius tokens, status chip — `312ce1b`)를 따른다.
- 캐릭터 선택은 `ElementMentionChip`/`ElementMentionMenu` 어휘를 재사용한다(001 D2).
  MCP composer의 캐릭터 슬롯은 capabilities contract(`lib/capabilities.js` contracts 요약,
  `modelsCatalog` inputRoles)에 `image_references`를 선언한 모델에서만 노출한다.
- Higgsfield 카드는 결제 전까지 Train 비활성 + 크레딧 고지 배지(040 §3 유지).

## 결정 5 — CLI: fail-closed + 봉투 코드

`ima2 gen/video --character <element-id|name>`는 wp1 resolver 위에 올리고, 미충족은 전부
JSON 봉투로 닫는다: `CHARACTER_BINDING_MISSING`(바인딩 없음/삭제됨),
`CAPABILITY_MISMATCH`(모델이 image_references 미선언), `CHARACTER_ELEMENT_CONFLICT`
(결정 2), `BINDING_NOT_READY`(status=training/failed — activation 시나리오는 각 상태를
fixture로 만든 계약 테스트).

## Accept (wp4 구현 사이클) — 040 Accept를 이것으로 치환

1. character element에 binding 저장/조회 roundtrip 테스트 green (불변식 1의 unlink 가드 포함).
2. element.refs만으로 재학습 매니페스트가 재구성됨을 보이는 roundtrip 테스트
   (trainedFromRefs 스냅샷과 현재 refs 비교, drift 감지 경로 activation 포함).
3. `elementIds`+`characterElementId` 동시 입력 → 409 `CHARACTER_ELEMENT_CONFLICT` 계약 테스트.
4. lineage(taskId+provider+kind)만으로 recover 재개 계약 테스트.
5. 바인딩 없음/training/failed/capability 미스매치 각각의 fail path 계약 테스트.
6. Runway 캐릭터 생성 1건(사용자 승인 시) refs+tag 통과 + lineage에 characterElementId 기록.
   → **완료 (2026-07-20, 사용자 승인)**: `ima2 gen "@jipy watering flowers…"
   --model runway/gen-4 --character Jipy` — requestId `req_cli_gen_mrsy66we_shxc9l`,
   sidecar에 `characterElementId: a_01KXMRWE2GHA7KMZ76NYAEF38D`,
   `referenceParents: [{filename: 1780486863325_efd3b33c_0.png, role: image-reference,
   tag: jipy}]`, providerTaskId 기록. uploading phase 관측, 결과 이미지는 레퍼런스와
   같은 캐릭터(시각 확인).
7. Higgsfield 트랙은 결제 전까지 UI 배지 + train 비활성(계약 테스트로 고정).
