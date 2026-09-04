# 검증기 실측 (001)

P 단계에서 실제로 실행한 결과. PLAN-VERIFIER-REAL-01.

| 검증기 | exit | 이 유닛의 변경 대상을 읽는가 |
|---|---|---|
| `npm run typecheck` | 0 | **아니오.** `tsconfig.json`의 `exclude`에 `"ui"`가 명시되어 있고 `include`는 server/config/lib/routes/bin/types뿐이다. UI 변경을 전혀 관찰하지 않는다. 이 유닛에서는 회귀 감시용일 뿐 게이트가 아니다. |
| `npm run typecheck:tests` | 0 | **부분적으로 예.** `tsconfig.tests.json`이 `tests/**/*.test.ts`를 포함하므로 새로 추가하는 `.test.ts` 회귀 테스트는 타입 검사된다. UI 소스 자체는 테스트가 import할 때만 따라 들어온다. |
| `node --experimental-strip-types --test tests/comfy-ui-contract.test.ts tests/comfy-selection-persistence.test.js` | 0 (12 pass / 0 fail) | **예.** 두 파일 모두 `readFileSync`로 `ui/src/components/GenProviderModelSelect.tsx`, `ui/src/store/storeSettingsImpl.ts`, `ui/src/store/storePersistence.ts`, `ui/src/store/useAppStore.ts`를 직접 읽는다. |
| `cd ui && npm run build` | B 이후 측정 | **예.** `tsc -b` + `tsc -p tsconfig.e2e.json --noEmit` + `vite build`. `ui/tsconfig.app.json`이 `ui/src` 전체를 컴파일하므로 UI 타입 오류를 잡는 **유일한 정적 게이트**다. |
| `cd ui && npx playwright test` | B 이후 측정 | **예.** `ui/playwright.config.ts`가 `testDir: "./e2e"`, viewport 1280x720. `e2e/fixtures/appServer.ts`의 `startApp`/`seedBrowser`가 실제 서버와 브라우저를 띄운다. 렌더 관찰 증거를 여기에 붙인다. |
| `npm run test:inventory` | B 이후 측정 | **예(간접).** `scripts/classify-tests.mjs`가 `tests/` 하위 테스트 파일을 자동 탐색해 `docs/migration/runtime-test-inventory.md`를 재생성한다. 수동 등록 파일은 없다. |

## 여기서 얻은 정정

계획 000은 `npm run typecheck`를 이 유닛의 검증기로 적었으나 **틀렸다.** UI는 루트
tsconfig에서 제외되어 있다. UI 타입 안전성의 실제 게이트는 `cd ui && npm run build`
하나뿐이며, 000의 검증기 표는 이 문서로 대체된다.

## 테스트 하네스 지형 (조사 레인 B)

이 저장소의 UI 계약 테스트는 세 패턴으로 나뉜다.

1. **소스 문자열 계약** — `readFileSync` + `assert.match`.
   `tests/comfy-selection-persistence.test.js`, `tests/comfy-ui-contract.test.ts`,
   `tests/provider-ui-polish-contract.test.js`, `tests/mcp-provider-ui-contract.test.js`.
2. **순수 함수 직접 import** — `tests/model-default-projection-contract.test.ts`가
   `ui/src/lib/imageModels.ts`를 import해 값으로 검증.
3. **서버 라우트** — Express 임시 서버 + fetch.

jsdom/Vitest/RTL 하네스는 없다. 따라서 셀렉트 트리거를 DOM으로 검증하려면 Playwright
e2e가 유일한 실행 경로이며, 그것이 이미 존재한다. 신규 테스트 런타임 도입은 불필요하다.

**설계 함의:** 표시 값 계산 로직을 컴포넌트 안에 인라인으로 두면 순수 함수로 검증할 수
없고 문자열 정규식(우회 가능한 조기 경보)에만 의존하게 된다. 그러므로
`coreModelValue` 계산을 `ui/src/lib/imageModels.ts`의 **순수 함수로 추출**해
패턴 2로 값 검증한다. 이것이 PLAN-BYPASS-NAMED-01의 잔여 위험을 실제로 낮추는 유일한
수단이다.

