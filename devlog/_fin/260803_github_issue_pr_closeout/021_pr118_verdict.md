# 021 — PR #118 판정 (실증 리뷰 결과)

대응 work-phase: `wp2` / 대응 기준: `c-pr-verdict`
조사 수행: 독립 explorer 서브에이전트, 분리 worktree, 2026-08-03

> WP0(로드맵 사이클) 중에 병렬로 수집한 증거를 보존한 문서다. WP2 사이클의 P에서
> 이 내용을 현재 트리 기준으로 재검증한 뒤 최종 확정한다.

## 1. 실행 환경

| 항목 | 값 |
|------|-----|
| 리뷰 worktree | `/tmp/pr118-review` (분리 worktree, 사용 후 제거) |
| PR HEAD | `521ff8532b322dbdc08ff038fb19500f7239f7d9` |
| Node / npm | v24.17.0 / 11.18.0 |
| 루트 `npm ci` | 성공 (288 packages) |
| UI `npm --prefix ui ci` | 성공 (126 packages) |
| 메인 체크아웃 영향 | 없음. HEAD `65b0ecc` 유지, 워킹트리 변경 0 |

## 2. 브랜치 지형

```
origin/main   = f06db103539c61f2c115450a5c13f6e603af278b
origin/dev    = f06db103539c61f2c115450a5c13f6e603af278b   (동일)
merge-base    = f06db103...
PR HEAD       = 521ff853...  (단일 커밋)
diff          = 32 files, +728 / -54
git merge-tree origin/dev HEAD → exit 0, 충돌 파일 0
```

base가 `main`인 것은 현재 코드 충돌을 일으키지 않는다. 다만 main에만 머지하면 dev는
자동 갱신되지 않으므로 32개 파일 변경이 dev에 반영되지 않는다. 별도 반영이 필요하다.

## 3. 게이트 결과

빌드 산출물 생성 **전** 실행은 위양성이다. 아래 표는 그 구분을 포함한다.

| 명령 | 종료코드 | 결과 |
|------|---------:|------|
| `npm ci` | 0 | 설치 성공 |
| `npm run typecheck` | 0 | 통과 |
| `npm run typecheck:tests` (빌드 전) | 2 | UI 의존성 미설치로 위양성 |
| `node --test tests/minimax-provider-contract.test.ts` (빌드 전) | 1 | `ERR_MODULE_NOT_FOUND: lib/refs.js` 위양성 |
| `npm --prefix ui ci` | 0 | 설치 성공 |
| `npm run build:server` | 0 | emit 성공 |
| `npm run build:cli` | 0 | emit 성공 |
| `npm run ui:build` | 0 | Vite 빌드 성공 (chunk-size 경고만) |
| `npm run typecheck:tests` (빌드 후) | 0 | 통과 |
| `node --test tests/minimax-provider-contract.test.ts` (빌드 후) | 0 | 9/9 통과 |
| `npm test` (빌드 후) | **1** | 2,052 tests: pass 2,049 / **fail 1** / skip 2 |
| `npm run test:inventory` | 0 | 통과 |
| `git diff --check` | 0 | whitespace 문제 없음 |
| `gh pr checks 118` | 1 | **no checks reported** |
| `gitleaks` (PR 커밋 범위) | 0 | 시크릿 유출 없음 |

유일한 실제 실패는 구조 문서 line-count 계약이다:

```
structure/01 line-count drift (11 files):
  server.ts: doc=545 actual=567
  config.ts: doc=388 actual=398
  routes/edit.ts: doc=433 actual=448
  lib/generatePipeline.ts: doc=619 actual=638
  lib/multimodePipeline.ts: doc=557 actual=571
  lib/nodeGeneration.ts: doc=509 actual=532
  lib/providerOptions.ts: doc=106 actual=120
  lib/runtimeContext.ts: doc=187 actual=196
  lib/imageModels.ts: doc=235 actual=251
  lib/capabilities.ts: doc=139 actual=140
  lib/agentImageVideoGen.ts: doc=407 actual=416
```

계약: `tests/structure-line-counts-contract.test.js:6-16`. CI에서는 fast-fail 스텝이기도
하다(`.github/workflows/ci.yml:48-49`).

## 4. 발견 목록

### F1 [High] Web UI와 legacy CLI 등록 누락 — 사용자 표면이 없다

백엔드는 등록됐지만(`lib/providerOptions.ts:45-56`, `routes/models.ts:176-195`,
`lib/capabilities.ts:70-78`) `ui/src/**`에는 MiniMax가 전혀 없다. 미등록 지점:

| 파일:라인 | 누락 내용 |
|-----------|-----------|
| `ui/src/types.ts:5` | provider union |
| `ui/src/types.ts:9-13` | image model union |
| `ui/src/components/GenProviderModelSelect.tsx:25-33` | provider picker |
| `ui/src/hooks/useKeyStatus.ts:10-12` | 키 상태 타입 |
| `ui/src/hooks/useProviderAvailability.ts:49-80` | availability map |
| `ui/src/components/AccountSettings.tsx:165-195` | API key 입력 |
| `ui/src/store/storePersistence.ts:322-324` | persistence allowlist |
| `ui/src/lib/imageModels.ts:6-28,72-77` | 모델 카탈로그 |
| `ui/src/lib/referenceLimits.ts:15-28` | 1-reference 상한 안내 |

따라서 웹 UI에서는 provider 선택도, 키 입력도 불가능하다. UI 빌드가 성공한 것은 누락된
union이 기존 타입과 모순되지 않기 때문이지 구현됐다는 증거가 아니다.

legacy `edit` CLI는 provider만 추가하고 모델 allowlist를 갱신하지 않았다
(`bin/commands/edit.ts:13-14,48-50,69-74`). 실제 실행:

```
$ node bin/ima2.js edit fake.png --prompt x --provider minimax --model image-01-live
✗ --model must be one of: ... nano-banana-pro
exit 2
```

### F2 [High] API 키 "검증"이 실제 과금성 이미지를 생성하고, region을 무시하며, fail-open이다

`routes/keys.ts:220-230`이 `{model:"image-01", prompt:"ima2 key check"}`로 실제
`POST /image_generation`을 호출한다. MiniMax 스펙상 model/prompt만 필수이고 나머지는
기본값이 적용되므로 이건 검증 요청이 아니라 **이미지 1장 생성**이다. 결과는 버려진다.
키를 저장하거나 교체할 때마다 quota/credits가 소모될 수 있다.

코드 주석은 "유효한 키는 input-validation 오류(2013)를 반환한다"고 가정하지만, 공식
스펙상 `aspect_ratio`는 `1:1`, `response_format`은 `url`, `n`은 `1`이 기본값이라
이 요청은 불완전 요청이 아니라 정상 생성 요청이다. `image-01` 단가는 이미지당 $0.0035다.

또한 어댑터는 region별 base URL을 쓰지만(`config.ts:324-333`) 키 검증 URL은 global로
하드코딩돼 있다(`routes/keys.ts:46-52`). `cn_zh` 설정에서 불일치한다.

**fail-open 결함(반대 관점 검증에서 추가 발견).** 검증기는 `401` / `1004` / `2049`만
거부하고, `403`·`429`·`500`, 비정상 JSON, 알 수 없는 오류 응답은 전부 "유효한 키"로
간주해 저장한다(`routes/keys.ts:227-249`). 즉 네트워크 장애나 rate limit 상황에서 잘못된
키가 조용히 저장된다. 검증의 기본값이 거부가 아니라 수용이다.

### F3 [High] 선택한 모델을 강제로 바꾸면서 provenance에는 원래 모델을 기록한다

`lib/minimaxImageAdapter.ts:113-116`은 reference가 있으면 사용자가 `image-01`을 골라도
`image-01-live`로 바꾼다. 그런데 MiniMax 공식 I2I 스펙/예제는 `image-01 + subject_reference`를
지원한다. 강제 전환의 근거가 없다.

더 나쁜 것은 실제로는 `image-01-live`를 전송하면서 저장 메타데이터에는 변경 전 모델을
기록한다는 점이다: `lib/generatePipeline.ts:341-350,448-475`,
`lib/multimodePipeline.ts:277-305`, `lib/agentImageVideoGen.ts:110-117,147-150`,
`routes/edit.ts:266-279,331-383`. 히스토리가 거짓 모델을 남긴다.

계약 테스트가 이 잘못된 동작을 고정하고 있다: `tests/minimax-provider-contract.test.ts:101-124`.

### F4 [Medium] 타임아웃을 504가 아니라 네트워크 502로 분류한다

`AbortSignal.timeout()`은 Node 24에서 `TimeoutError`를 던지는데 catch는 `AbortError`만
검사한다(`lib/minimaxImageAdapter.ts:142-145,229-237`). 재현:

```json
{"code":"MINIMAX_NETWORK_FAILED","status":502,
 "message":"MiniMax request failed: The operation was aborted due to timeout"}
```

`GENERATION_TIMEOUT`/504 경로에 도달하지 않는다.

### F5 [Medium] 문자열 metadata를 안전 차단으로 인식하지 못한다

MiniMax 공식 응답 예시는 `success_count:"3"`처럼 **문자열**을 보여주는데 구현은 number만
검사한다(`lib/minimaxImageAdapter.ts:182-187,205-209`). 문자열 `failed_count:"1"` 재현:

```json
{"code":"MINIMAX_NO_IMAGE","status":502,
 "message":"MiniMax image generation did not return an image"}
```

실제 content-safety 차단이 upstream 장애로 잘못 노출된다.

### F6 [Medium] 구조 문서 계약 실패로 `npm test`가 깨진다

3절 참조. 11개 파일의 line count 미갱신.

### F7 [Low] 문서 표면이 `docs/CLI.md` 한 곳뿐

README, API 문서, 다국어 README, site 문서에 MiniMax가 없다. 기존 Atlas/Gemini 패턴 대비
설치·키 설정·오류 코드 안내가 빠졌다.

### F8 [Medium] 결과 이미지 다운로드에 크기 상한이 없다

`lib/minimaxImageAdapter.ts:195-202`가 응답 URL을 `arrayBuffer()`로 통째로 메모리에
적재한다. 크기 제한도 content-type 검사도 없다. 같은 저장소의 Grok 다운로더는
HTTP(S) 스킴 제한과 50MB 스트리밍 상한을 둔다(`lib/grokImageCore.ts:140-176`).
MiniMax가 반환한 URL을 신뢰하는 경계이므로 SSRF보다는 메모리 고갈/가용성 위험이지만,
저장소에 이미 올바른 선례가 있으므로 머지 전 정렬 대상이다.

## 5. 보안 감사

| 항목 | 결과 |
|------|------|
| 하드코딩 시크릿 | 없음 (gitleaks exit 0) |
| 키 검증 fail-open | **있음** — 알 수 없는 오류 응답을 유효 키로 수용 (F2) |
| 새 의존성 / lockfile 변경 | 없음 |
| 로그 키 유출 | 없음. logger가 authorization/apiKey/base64 리댁션 (`lib/logger.ts:11-32,48-77`) |
| `routes/auth.ts` 자식 env 리댁션 | 정상 추가됨 (`routes/auth.ts:138-144`) |
| 어댑터 로그 | request ID / model / aspect ratio / ref 수 / base64 길이만. 키 없음 |
| upstream 에러 노출 | `status_msg` 또는 raw 응답 앞 200자를 반환. 키 반사 증거는 없으나 allowlist보다 넓다 |
| 출력 URL 다운로드 | 크기/content-type 제한 없음 (F8로 승격) |

## 6. 외부 스펙 대조 (확인 시점 2026-08-03)

| 항목 | 공식 | 구현 | 판정 |
|------|------|------|------|
| Endpoint | `POST /v1/image_generation` | 일치 | ✅ |
| 인증 | Bearer | 일치 | ✅ |
| `subject_reference` | `{type:"character", image_file}` | 일치 | ✅ |
| aspect ratio | 8개 enum | 일치 | ✅ |
| 응답 | `image_urls` / `image_base64` | 일치 | ✅ |
| `base_resp.status_code` | 0/1002/1004/1008/1026/2013/2049 | 대체로 일치 | ✅ |
| I2I 모델 | 공식 예제는 `image-01` | 강제로 `image-01-live` 전환 | ❌ F3 |
| T2I 모델 | global 문서는 `image-01`만 열거 | ref 없이도 `image-01-live` 허용 | ⚠️ |

출처: [Global T2I](https://platform.minimax.io/docs/api-reference/image-generation-t2i),
[Global I2I](https://platform.minimax.io/docs/api-reference/image-generation-i2i),
[China I2I](https://platform.minimaxi.com/docs/api-reference/image-generation-i2i),
[Image Generation Guide](https://platform.minimax.io/docs/guides/image-generation)

## 7. 기여자 배경

- 계정: [octo-patch](https://github.com/octo-patch), GitHub API 유형 `User`, `is_bot=false`
- 이 저장소 association: `FIRST_TIME_CONTRIBUTOR`, PR 1건, 이슈 0건
- 계정 생성 2026-03-10, 조사 시점 public repos 1,493개, 최근 표본 10개가 전부 fork
- 자동화 활동 가능성은 높으나 봇으로 확정할 직접 증거는 없다

커밋 메시지의 "checks pass" 자기 신고는 검증되지 않았다. 실제로 `npm test`는 실패하고
GitHub CI는 승인 대기 상태라 실행된 적이 없다.

## 8. 판정

**`CHANGES-REQUESTED` (blockers=4)** — F1, F2, F3, F6. (F8은 머지 전 정렬 권고)

이 판정은 반대 관점 적대적 재검증을 거쳤다. F1은 전례 조사(Grok `9c91f4b`,
Gemini `d91a2ee`, AtlasCloud `71bb3f2`/`b66f93f` 모두 같은 커밋에서 `ui/src` 동반 변경),
F2·F3는 MiniMax 공식 문서 대조, F6은 계약 도입 시점 추적(`6383fc4`, 2026-06-28로
PR base에 이미 존재)으로 각각 반박을 시도했으나 전부 유지됐다.

`020`의 판정 규칙 대비:

| 조건 | 결과 |
|------|------|
| 1. 원장 6범주 실패 조건 없음 | ❌ Web UI 미등록(F1), 파이프라인 provenance 불일치(F3) |
| 2. 로컬 게이트 전부 exit 0 | ❌ `npm test` 실패(F6) |
| 3. live CI fail-closed 검증 | ❌ **UNVERIFIED** — run `30551464222`가 `action_required`(maintainer 승인 대기). 기여자 책임 아님 |
| 4. 외부 스펙 불일치 없음 | ❌ 모델 강제 전환(F3) |

네 조건 모두 미충족이므로 `MERGEABLE` 판정은 불가능하다. 다만 조건 3의 미충족은
기여자가 아니라 저장소 소유자의 승인 대기에서 비롯된 것이므로 변경 요청 항목이 아니다.

## 9. 사용자 결정 사항 (NEEDS_HUMAN)

아래는 스코프 밖이라 자동으로 수행하지 않았다:

1. **이 PR을 받을 것인가** — MiniMax provider 자체를 제품에 넣을지는 제품 판단이다.
2. **받는다면 방식** — 기여자에게 변경 요청 코멘트를 남길지, 직접 후속 커밋으로 보완할지.
   F1(Web UI 등록)은 분량이 커서 사실상 별도 작업에 가깝다.
3. **CI 워크플로 승인** — run `30551464222`가 승인 대기 중이다. 승인하면 실제 CI 결과를
   확인할 수 있다. 첫 기여자 워크플로 승인은 fork 코드를 실행하는 행위이므로 소유자가
   코드를 훑어본 뒤 결정할 사안이다. 참고로 이 PR의 시크릿 스캔은 clean이고 새 의존성도
   추가하지 않았다.
4. **base 브랜치** — 현재 `main`. dev 반영 계획이 필요하다.
5. GitHub 상태 변경(코멘트/라벨/머지/클로즈)은 전부 승인 후 별도 수행.
