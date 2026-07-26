# 043 — wp4 슬라이스 2: /api/mcp/generate characterElementId + lineage (diff-level)

상위 스펙: 041 결정 2(409 충돌)/결정 3(lineage/recover). wp4-mcp work-phase 명세.
선행: 042(storage). 본 슬라이스는 provider 전개(업로드)까지 포함하고,
상태 게이트 확정은 044에서 마무리한다.

## MODIFY `routes/mcpMedia.ts` — `/api/mcp/generate` (~line 231 진입부)

### 1. 요청 필드 수용

destructure에 `characterElementId` 추가. 값이 있는데 string이 아니거나 빈 문자열이면
400 `INVALID_CHARACTER_ELEMENT`.

### 2. 충돌 가드 (provider/executable 체크 직후, prompt 검증 전)

```ts
if (characterElementId && Array.isArray(req.body?.elementIds) && req.body.elementIds.length > 0) {
  return res.status(409).json({ error: { code: "CHARACTER_ELEMENT_CONFLICT",
    message: "use either elementIds or characterElementId, not both",
    fix: ["character 바인딩이면 mention(@) 없이 characterElementId만",
          "generic element refs면 characterElementId 제거"] } });
}
```

### 3. element 로드 + 바인딩 해석 (references 파싱 이전)

- `getElementById(characterElementId)`(lib/assetsStore.ts:280) → 없거나
  metadata.elementKind !== "character" → 400 `CHARACTER_ELEMENT_NOT_FOUND`.
- metadata.characterBindings에서 provider === adapter.provider인 binding 탐색.
  없으면 → 400 `CHARACTER_BINDING_MISSING` + fix(assets UI에서 바인딩 추가 안내).
  (400 rationale: 이 라우트의 요청-참조 실패는 INVALID_* 계열 400으로 통일돼 있고,
  409는 상태 충돌(CONFLICT/NOT_READY/LOCKED)에만 쓴다 — 044 게이트와 구분.)
- runway + stateless-refs: element.refs를 그대로 바인딩 레퍼런스로 사용.
  refs.length > 3이면 400 `CHARACTER_REFS_EXCEED_PROVIDER_CAP`
  (자동 trimming 금지 — 041 불변식 3) + fix(refs를 3장 이하로 줄이라는 안내).
- binding.status가 training|failed면 409 `BINDING_NOT_READY`(trained-id만 적용.
  게이트 순서 확정은 044).
- refs(1-3장)를 `rawReferences`에 `{ filename: ref, tag: binding.tag }`로 주입.
  요청 references/referenceFilenames와 동시 사용은 허용하되 합산 3장 초과 시
  기존 INVALID_MCP_REFERENCES 상한 검증이 잡도록 rawReferences 주입 시점을
  references 파싱 직후로 둔다(합산 상한 = 단일 규칙). **주입은 반드시 상한 검증
  이전에 일어난다** — 검증 후 주입하면 4장 이상이 통과하므로 그 구현은 계약 위반.

### 4. lineage 기록

- `startJob` meta에 `characterElementId` 추가(routes/mcpMedia.ts:257 부근의
  "generic parent lineage" 기록 패턴 준용).
- done 이벤트 payload와 결과 sidecar에 `characterElementId` 포함
  (runMediaJob 완료 경로 — writeSidecar 호출부).

### 5. recover 호환

recover는 taskId+provider+kind만 필요(routes/mcpRecover.ts:86-104, 001 D3).
추가 작업 없음 — 계약 테스트로 고정만 한다.

## 계약 테스트 — NEW `tests/mcp-character-route.test.ts`

(기존 tests/mcp-recover-route.test.ts의 라우트 harness 패턴 재사용:
registerMcpMediaRoutes에 deps stub 주입)

1. elementIds + characterElementId 동시 → 409 CHARACTER_ELEMENT_CONFLICT.
2. 존재하지 않는 element / 비-character element → 400.
3. 바인딩 없는 character → 400 CHARACTER_BINDING_MISSING.
4. refs 4장 바인딩 → 400 CHARACTER_REFS_EXCEED_PROVIDER_CAP (trimming 안 함을
   upload mock 호출 0회로 증명).
5. 정상: refs 2장 + tag → deps.upload가 2회 refs로 호출되고 execute까지 도달,
   startJob meta/done payload에 characterElementId.
6. 요청 references 2장 + 바인딩 refs 2장 → 합산 4장 → 400 INVALID_MCP_REFERENCES
   (합산 상한 단일 규칙).
7. recover: character 생성 job의 taskId+provider+kind만으로 recover 경로 호출 가능
   (mcp-recover-route harness에 character meta 케이스 추가).

## Activation 시나리오

- 409 충돌: 테스트 1. cap 가드: 테스트 4(upload 0회 관측). 합산 상한: 테스트 6.

## Accept

`npm run typecheck` + 신규 7건 + 기존 mcp-recover-route/mcp-provider-adapters
회귀 green.
