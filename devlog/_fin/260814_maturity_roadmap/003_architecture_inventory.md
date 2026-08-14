---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, research, architecture]
---

# 003 — 아키텍처 인벤토리

기준: `dev` @ `d2fe420`. 모든 수치는 추적 파일 기준 실측이다.

## 1. 공급자 fanout

가장 최근에 추가된 공급자 `minimax`의 리터럴이 등장하는 추적 파일은 **72개**,
역사적 devlog 문서를 빼면 **54개**다.

| 계층 | MiniMax | Grok | Gemini |
|---|---:|---:|---:|
| 서버 어댑터/파이프라인 | 4 | 30 | 9 |
| 라우트/부트스트랩 | 5 | 13 | 6 |
| 설정/패키징 | 3 | 9 | 2 |
| 모델 카탈로그/런타임 | 6 | 6 | 6 |
| CLI | 5 | 14 | 5 |
| UI store | 3 | 9 | 6 |
| UI 컴포넌트/훅/타입 | 12 | 36 | 22 |
| i18n | 2 | 2 | 2 |
| 테스트/픽스처 | 11 | 51 | 14 |
| MCP/에이전트 스키마 | 3 | 5 | 2 |
| 문서/devlog | 18 | 215 | 95 |
| **합계** | **72** | **393** | **170** |

평가서는 PR #120이 60개 파일이었다는 점을 경고 신호로 읽었다. 측정 결과 그 수치는
예외가 아니라 **구조적 하한에 가깝다.** Grok의 393은 이미지·비디오·프록시·플래너를
모두 가진 특수 사례지만, MiniMax는 텍스트→이미지와 이미지→이미지만 하는 가장 단순한
공급자인데도 54개 소스/테스트 파일을 건드린다.

평가서의 "공급자 추가 시 수정 파일 5개 이하" 목표는 **현재 구조에서 10배 이상의
축소**를 요구한다. `001`에서 유보한 정량 목표를 이제 정할 수 있다: 5개는 registry가
생긴 뒤에도 비현실적이다. 현실적 목표는 **어댑터 1 + manifest 1 + 테스트 1 = 3개
신규 파일, 기존 파일 수정 0개**이며, 이때 카탈로그·UI·CLI·i18n은 manifest를 읽는다.

## 2. 공급자 지식이 중복된 지점

공급자 id 목록만 **9곳**에 독립적으로 존재한다.

| 위치 | 형태 |
|---|---|
| `ui/src/types.ts:5` | `Provider` union |
| `lib/capabilities.ts:13` | `VALID_PROVIDERS` 배열 |
| `lib/agentSettings.ts:4` | `PROVIDERS` Set |
| `bin/lib/modelResolver.ts:3` | `Lane` union |
| `bin/lib/modelResolver.ts:25` | `LANES` 배열 |
| `routes/models.ts:38` | lane union + MCP 추가 |
| `routes/keys.ts:36` | auth 어휘 (`openai`/`xai`/`gemini`/…) |
| `bin/commands/edit.ts:13` | 검증 집합 |
| `bin/commands/multimode.ts:75`, `bin/commands/node.ts:60` | 각자의 검증 집합 |

**어휘가 하나도 아니다.** `routes/keys.ts:36`은 auth 관점에서 `openai`/`xai`를 쓰고
나머지는 lane 관점에서 `oauth`/`grok-api`를 쓴다. 공급자 하나를 추가하면 두 어휘
사이의 매핑도 손으로 맞춰야 한다.

모델 목록은 4곳에 흩어져 있다: `lib/imageModels.ts:3` 이하 6개 Set,
`lib/capabilities.ts:70` 리터럴 배열, `routes/models.ts:126` 이하 lane별 엔트리,
`ui/src/lib/imageModels.ts:6` UI 배열.

참조 이미지 상한은 최소 5곳이다: `./config.ts` 95행 GPT 기본 5,
`ui/src/lib/referenceLimits.ts:12` Grok 3/MiniMax 1/비디오 7,
`lib/generatePipeline.ts:219` MiniMax 서버측 강제, `lib/imageModels.ts:150` 비디오 7,
`lib/elementCompiler.ts:57` 또 다른 gpt/gemini/grok 분류.

`supportsEdit`, `supportsMask`, `supportsStreaming`, `maxReferences`를 담은
**기계 판독 가능한 공급자 capability 객체는 존재하지 않는다.** MCP 공급자에게만
부분적 registry가 있다 — `routes/models.ts:27`이 `lib/mcp/providerRegistry.js`에서
`listProviders`를 가져온다. (`getProviderModels`는 `routes/models.ts:20`에서
`modelsCatalog.js`가 출처다. 2라운드 감사가 잡은 오기다.)

## 3. job 상태 어휘

`lib/eventBus.ts:3`의 `event`는 제약 없는 `string`이다. 그 아래로 각 모드가 자기
어휘를 길렀다.

| 표면 | 어휘 |
|---|---|
| inflight 활성 phase | `queued` → `streaming` → `decoding` (`lib/inflight.ts:67`), 추가로 `partial`, `planning`, `media-processing`, `uploading`, `provider-running`, `downloading` |
| inflight 종료 | `completed` / `error` / `canceled` (`lib/inflight.ts:212`) |
| SQLite `inflight` | `phase TEXT DEFAULT 'queued'`, CHECK 없음 (`lib/db.ts:63`) |
| SQLite agent queue | `queued`/`running`/`failed`/`canceled`, CHECK 없음 (`lib/db.ts:145`) |
| SQLite sprite | `pending\|queued\|running\|complete\|error\|canceled`, **CHECK 있음** (`lib/db.ts:317`) |
| Classic UI | `completed`/`error`/`canceled` (`ui/src/store/storeTypes.ts:83`) |
| Node UI | `empty`/`pending`/`reconciling`/`ready`/`stale`/`asset-missing`/`error` (`ui/src/store/storeTypes.ts:115`) |
| Multimode UI | `pending`/`partial`/`complete`/`empty`/`error`/`canceled` (`ui/src/types.ts:133`) |
| MCP CLI | `done`/`error`/`replay-gap`/`dropped` (`bin/lib/mcpJob.ts:97`) |

### 검증했으나 **버그가 아닌** 것 (기록해 둔다)

조사 중에 이런 불일치를 발견했다: MCP CLI는 종료 상태로 `error` 또는 `done`만
받아들이는데(`bin/lib/mcpJob.ts:154`), 공용 inflight 레지스트리는 성공 시 기본값을
`completed`로 저장한다(`lib/inflight.ts:212`). 이 조합이면 성공한 MCP 작업의
replay-gap 복구가 실패한다.

**실제로는 실패하지 않는다.** 성공 경로가 명시적으로 `done`을 넘기기 때문이다.

```
lib/mcp/commitMediaResult.ts:44
  finishJob(requestId, { status: "done", meta: { filename } });
```

MCP 라우트 4곳(`routes/mcpMedia.ts:282`, `routes/mcpMedia.ts:610`,
`routes/mcpMultishot.ts:107`, `routes/mcpRecover.ts:74`)의 `finishJob` 호출은 전부
오류 경로이고, 성공은 `commitMediaResult`를 통해 `done`으로 끝난다. 따라서 이것은
**잠재적 함정이지 현재 버그가 아니다.**

이 항목을 지우지 않고 남기는 이유: 이 계약은 `commitMediaResult`가 문자열
`"done"`을 정확히 넘긴다는 데 전적으로 의존하며, 그것을 강제하는 타입도 테스트도
없다. replay-gap 테스트는 `done` fixture가 복구된다는 것만 확인하고
`commitMediaResult → inflight 스냅샷 → CLI 복구` 전 구간을 잇지 않는다. 새 MCP
라우트가 `finishJob(requestId)`를 기본값으로 호출하면 그 순간 복구가 조용히
깨진다. `050`이 해결할 것은 "지금 난 불"이 아니라 **이런 종류의 암묵적 문자열
계약**이다.

따라서 `050`의 첫 작업은 "9개 어휘를 하나의 FSM으로 통합"이 아니라 **terminal
status 경계의 타입·정규화·통합 테스트**다(2라운드 감사 권고). UI 상태와 queue
상태까지 전부 단일 FSM이어야 한다는 증거는 아직 없고, 그 주장은 통합 범위를
정당화 없이 넓힌다.

`050`의 정당성을 "실재하는 복구 실패"로 적었다면 그것은 거짓이었을 것이다.
정당성은 더 약하지만 정직한 쪽이다: 어휘가 9개로 갈라져 있고, 그중 하나라도
어긋나면 조용히 깨지는 경로가 최소 한 곳 확인됐다.

## 4. 오류 분류

UI 레지스트리 `ui/src/lib/errorCodes.ts:5`에 31개 코드가 있고,
`resolveErrorSpec`은 레지스트리에 없는 코드를 **버린 뒤** 메시지 휴리스틱으로
재분류한다(`ui/src/lib/errorCodes.ts:169`). 결과:

| 공급자 | 타입된 코드 발행 | UI 레지스트리 등록 | 실제 결과 |
|---|---|---|---|
| OAuth/OpenAI | 다수 | 대부분 등록 | 정상 해석 |
| Agy | 6종 | 6종 등록 | 정상 해석 |
| MiniMax | 17종 | **1종만** | 16종이 `UNKNOWN`으로 접힘 |
| Gemini | 7종 | **0종** | 전부 접힘 |
| Grok | 35종 | **0종** | 전부 접힘 |

숫자를 세는 명령을 함께 남긴다(A phase 감사 blocker 4 반영). 단일 줄 인용은 계열의
존재만 보여줄 뿐 개수를 재현하지 못한다.

```
rg -c '^\s+[A-Z_]+:' ui/src/lib/errorCodes.ts              → 29 (레지스트리 항목)
rg -o 'MINIMAX_[A-Z_]+'   lib/minimaxImageAdapter.ts | sort -u | wc -l  → 17
rg -o 'GEMINI_API_[A-Z_]+' lib/geminiApiImageAdapter.ts | sort -u | wc -l → 7
rg -o 'GROK_[A-Z_]+'      lib/grok*.ts | sed 's/.*://' | sort -u | wc -l → 35
```

레지스트리 정의는 `ui/src/lib/errorCodes.ts:53`의
`export const errorCodes: Record<ImaErrorCode, ErrorSpec>`이다.

공급자가 성실하게 `MINIMAX_INSUFFICIENT_BALANCE`를 만들어 SSE로 보내도 UI는
"알 수 없는 오류"를 보여준다. 잔액 부족과 안전 필터 차단이 사용자에게 같은 화면으로
보인다. 평가서의 "공급자 오류 95%를 공통 코드로"는 새 분류 체계를 발명하자는 것이
아니라 **이미 발행되는 코드를 잃어버리지 말자는 것**이다.

## 5. 크기와 drift

`.ts`와 나란히 추적되는 컴파일 산출물 `.js`는 **18쌍**이다(`ui/`, `vendor/`,
`node_modules/` 제외): `bin/ima2.js`, `config.js`, `lib/capabilities.js`,
`lib/imageModels.js`, `routes/index.js` 등.

재현 명령:

```
for f in $(git ls-files '*.js' | grep -vE '^(ui/|vendor/|node_modules)'); do
  git ls-files --error-unmatch "${f%.js}.ts" >/dev/null 2>&1 && echo "$f"
done | wc -l          # → 18
```

같은 필터에서 `.ts` 짝이 없는 `.js`는 149개이고 전부 `tests/` 아래의 손으로 쓴
테스트다. drift가 아니다. 자세한 내역은 `002`의 C-08.

저장소 크기의 진짜 원인은 소스가 아니다.

| 디렉터리 | 추적 바이트 |
|---|---:|
| `devlog/` | 228,362,562 |
| `ui/` | 97,095,415 |
| `assets/` | 12,873,457 |
| `site/` | 11,546,895 |
| `lib/` | 1,203,425 |

그리고 `devlog/` 228MB 중 **126MB가 파일 두 개**다.

| 바이트 | 파일 |
|---:|---|
| 94,146,560 | `devlog/_fin/260714_git-index-fix/artifacts/wt7174-untracked.tar.gz` |
| 32,103,190 | `devlog/_fin/260714_git-index-fix/artifacts/gitdir-foreign-files.tar.gz` |

`git cat-file -s`로 blob 크기를 직접 확인했다. 2026-07-14 git index 사고를
수습하며 남긴 백업 tarball이고, 그 뒤로 아무도 읽지 않는다.

평가서는 저장소 크기 문제를 "패키지에 UI·assets·vendor가 함께 포함"으로 진단했다.
측정해 보면 **npm 패키지 범위와 저장소 크기는 다른 문제**다. `package.json`의
`files`는 `bin/**/*.js`, `lib/**/*.js`, `routes/**/*.js`, `ui/dist/`, `docs/`,
`vendor/` 등으로 이미 좁혀져 있고 `devlog/`는 포함되지 않는다. 저장소 clone 비용을
지배하는 것은 devlog에 커밋된 백업 압축파일 두 개다. 이 둘을 정리하는 것과 npm
tarball을 줄이는 것은 서로 다른 작업이며, `010`에서 분리해 다룬다.

## 이 인벤토리가 로드맵에 미친 영향

1. 공급자 registry 목표치를 "수정 파일 5개 이하"에서 "신규 3파일, 기존 수정 0"으로
   구체화(`040`).
2. job FSM의 정당성을 "실재하는 MCP CLI 복구 실패"로 적으려다 **직접 확인해서
   철회**했다. 성공 경로가 `done`을 명시하므로 지금 깨지지 않는다. 남은 정당성은
   "9개로 갈라진 어휘 + 타입도 테스트도 없는 암묵적 문자열 계약"이다(`050`).
3. 오류 분류의 성격이 "새 taxonomy 설계"에서 "발행되는 코드의 유실 차단"으로 바뀜(`060`).
4. 저장소 크기 과제가 "패키징 범위 축소"에서 **"devlog 백업 tarball 2개 처리"**로
   바뀜(`010`). 이건 훨씬 쉽고 효과는 훨씬 크다.
