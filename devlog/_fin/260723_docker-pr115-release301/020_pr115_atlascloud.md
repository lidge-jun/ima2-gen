# 020 WP2 — PR #115 Atlas Cloud provider 재구축 (REBUILD_ON_DEV)

## Decision evidence

- merge-tree: 충돌 12개소 / changed-in-both 26파일 / dev 삭제 파일
  (`ui/src/components/ProviderSelect.tsx`) 수정 → MERGE_AS_IS 불가.
- 신규 어댑터/테스트 2파일은 충돌 없음 → 핵심 가치는 이식 가능.
- 사용자 지시 "최대한 머지" → REBUILD_ON_DEV, Co-authored-by 크레딧.

## Rebuild plan — full changed-file ledger (감사 blocker #3/#4 fold)

PR 36파일 전수 판정 (port = dev에 이식, rework = dev 구조로 재구현, drop = 대상 없음):

| PR 파일 | 판정 | dev 대응 / 비고 |
|---|---|---|
| `lib/atlasCloudImageAdapter.ts` (신규) | port | 동일 경로 신규 |
| `tests/atlascloud-provider-contract.test.ts` (신규) | port | + `node scripts/classify-tests.mjs`로 inventory 문서 재생성 후 `npm run test:inventory` (blocker #5) |
| `lib/imageModels.ts`/`.js` | port | provider union + atlas 모델 상수 |
| `lib/generatePipeline.ts` | port | atlascloud 분기 |
| `lib/multimodePipeline.ts` | port | multimode 경로 |
| `lib/nodeGeneration.ts` | port | node 경로 |
| `lib/agentImageVideoGen.ts` | port | agent 경로 |
| `lib/agentSettings.ts` | port | agent provider 설정 |
| `lib/providerOptions.ts` | port | 옵션 해석 |
| `lib/runtimeContext.ts` | port | atlasApiKey 컨텍스트 |
| `lib/capabilities.ts`/`.js` | port | capabilities 노출 |
| `routes/edit.ts` | port | edit 경로 |
| `routes/keys.ts` | port | 키 저장/검증 |
| `server.ts` | port | 키 상태 노출 |
| **`routes/models.ts`** | **rework (blocker #3)** | core lane 목록에 atlascloud lane 추가 (models.ts:159 인근, 폐쇄형 DTO) |
| **`bin/lib/modelResolver.ts`** | **rework (blocker #3)** | `Lane` union + `LANES`에 atlascloud 추가, key-missing/ready 상태 |
| `bin/commands/gen.ts`/`edit.ts`/`multimode.ts`/`node.ts` | rework | dev lane/resolver 방식 — PR의 구식 플래그 코드는 drop, resolver 등록으로 대체 |
| `docs/CLI.md` | port | provider 문서 |
| `ui/src/components/ProviderSelect.tsx` | **drop→rework** | dev에서 삭제됨 → `GenProviderModelSelect.tsx`에 항목 추가 |
| `ui/src/components/AccountSettings.tsx` | port | 키 입력 카드 |
| `ui/src/components/ApiKeyInput.tsx` | port | provider prop |
| `ui/src/components/ResultMetadataModal.tsx` | port | 라벨 |
| `ui/src/components/home/HomePromptComposer.tsx` | port | provider 표시 |
| `ui/src/hooks/useKeyStatus.ts` | port | atlas 키 상태 |
| `ui/src/lib/imageModels.ts` | port | 프론트 모델 목록 |
| `ui/src/store/storeHelpers.ts` | port | provider 헬퍼 |
| `ui/src/store/storePersistence.ts` | port | **폐쇄형 validator(322행)에 atlascloud 추가** |
| `ui/src/store/storeSettingsImpl.ts` | port | provider-family 분기(358행) 반영 |
| `ui/src/types.ts` | port | `Provider` union 확장 |
| `ui/src/i18n/en.json`/`ko.json` | port | atlas 키/라벨 |

**비대상 명시 (blocker #4):** `lib/contracts/*`와 `lib/mcp/providerRegistry.ts`는
MCP 전용 계층 — Atlas는 direct provider이므로 등록하지 않는다.

**Acceptance matrix:** classic generate / edit / multimode / node / agent 각 경로 +
key lifecycle(등록/검증/삭제) + UI persistence 왕복 + CLI `--provider atlascloud`
resolve가 각각 테스트 또는 계약 검증으로 커버될 것.

## Execution

1. `git cherry-pick -n pr-115` 시도 → 충돌 파일별 수동 해소, ledger 판정대로 처리
2. Sol worker에게 위임 가능(write scope: 위 ledger 파일로 한정)
3. 게이트: typecheck ×2, `node scripts/classify-tests.mjs` 재생성 + test:inventory,
   관련 스위트(atlascloud/cli/models 계약), ui:build, 전체 npm test
4. 커밋에 `Co-authored-by: binyangzhu000-sudo <224954946+binyangzhu000-sudo@users.noreply.github.com>`
5. PR #115 영어 코멘트: 재구축 커밋 참조 + base 노후 사유 + **"mock-green,
   live-unverified" 명시 (blocker #6)** — Atlas 실계정 없이 계약 테스트만 통과,
   실 API와 다르면 이슈 환영 → close

## Risk

- Atlas Cloud API 실계정 없음 → 라이브 검증 불가. "mock-green, live-unverified"
  상태로 명시 유지 (blocker #6). 공식 스키마 확보 시 fixture 기반 전환 후속.
- adapter의 `/model/result/{id}` → 404시 `/model/prediction/{id}` fallback은 PR
  구현 그대로 보존(공식 문서 검증 불가로 동작 변경 리스크 회피).
