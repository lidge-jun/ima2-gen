# 020 — Phase 2: PR #118 MiniMax provider 실증 리뷰/판정

대응 work-phase: `wp2` / 대응 기준: `c-pr-verdict`

## 스코프

IN

- PR #118 브랜치를 분리 worktree로 체크아웃해 실제 게이트 실행
- provider 등록 규약 준수 감사 (`lib/providerOptions.ts`, `lib/capabilities.ts`,
  `routes/models.ts`, `routes/keys.ts`, `lib/imageModels.ts`, `bin/lib/modelResolver.ts`)
- 보안 감사 (키 하드코딩, 로그 유출, `routes/auth.ts` 리댁션)
- 외부 API 스펙 대조 (MiniMax `POST /v1/image_generation`)
- 판정 결과를 이 유닛 문서로 기록

OUT (사용자 승인 필요)

- PR 머지, 클로즈, 리뷰/코멘트 제출, 라벨 변경
- 원격 push, 릴리스, 배포

즉 이 work-phase의 산출물은 **판정과 근거**이며, GitHub 상태 변경이 아니다.

## 브랜치 지형 (실측)

```
git rev-parse origin/main origin/dev
f06db103539c61f2c115450a5c13f6e603af278b   (origin/main)
f06db103539c61f2c115450a5c13f6e603af278b   (origin/dev)
```

`origin/main`과 `origin/dev`는 **같은 커밋**을 가리킨다. 따라서 "PR base가 main인데 개발은
dev에서 한다"는 초기 우려는 실제로는 문제가 아니다. `git merge-base origin/pr-118 origin/main`
= `f06db10`으로, PR은 현재 두 브랜치의 공통 tip 바로 위에 얹혀 있다.
PR 커밋: `521ff85 Add MiniMax image generation provider (text-to-image and image-to-image)`.

로컬 `dev`(HEAD `65b0ecc`)는 원격보다 v3.0.4 릴리스 버전 범프(`ba96269`) 만큼 뒤에 있고,
같은 내용의 커밋이 서로 다른 sha로 존재한다(로컬 `65b0ecc` ↔ 원격 `f06db10`).
WP1 작업 시 이 갈라짐을 인지하되, 사용자 승인 없이 rebase/force 조작은 하지 않는다.

## 변경 파일 원장 (32개, 전수)

`git diff --name-status origin/main...origin/pr-118` 실측. 모든 파일에 검토 범주와
실패 조건을 지정한다 (A-phase 감사 blocker 2 반영).

### 범주 1 — 신규 어댑터 (외부 스펙 대조 필수)

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| A | `lib/minimaxImageAdapter.ts` | endpoint/인증/요청 필드/응답 파싱/에러 매핑이 MiniMax 공식 스펙과 일치 | 필드명·enum·status_code 매핑 불일치, 타임아웃 오분류, 응답 타입 가정 오류 |

### 범주 2 — provider 등록 (완전성)

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| M | `lib/providerOptions.ts` | provider 해석 + 모델 검증이 기존 lane과 동형 | 누락된 옵션 게이팅 |
| M | `lib/imageModels.ts` / `lib/imageModels.js` | TS↔JS parity | 한쪽만 갱신 |
| M | `lib/capabilities.ts` / `lib/capabilities.js` | TS↔JS parity | 한쪽만 갱신 |
| M | `routes/models.ts` | 새 lane이 key-missing 상태로 노출 | 상태 계산 누락 |
| M | `routes/keys.ts` | 키 저장/검증/삭제/핫업데이트 | **검증이 과금성 호출인지**, region 반영 여부 |
| M | `lib/runtimeContext.ts`, `server.ts` | 키 로딩/노출 배선 | 재기동 없이 반영 안 됨 |
| M | `lib/agentSettings.ts`, `bin/lib/modelResolver.ts` | provider 목록 등록 | 목록 누락 |
| M | `config.ts` / `config.js` | region/baseURL/기본모델/타임아웃 블록 TS↔JS parity | 한쪽만 갱신 |
| M | `.env.example` | `MINIMAX_API_KEY` 안내 | 누락 |

### 범주 3 — 생성 파이프라인 (provenance 정합성)

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| M | `lib/generatePipeline.ts` | classic 경로 디스패치 + 저장 메타데이터 | **전송 모델과 기록 모델 불일치** |
| M | `lib/multimodePipeline.ts` | multimode 경로 | 동일 |
| M | `lib/nodeGeneration.ts` | node 경로 | 동일 |
| M | `lib/agentImageVideoGen.ts` | agent 경로 | 동일 |
| M | `routes/edit.ts` | i2i 참조 처리, 마스크 미지원, ref 상한 | 상한 우회, 잘못된 에러 코드 |

### 범주 4 — CLI 표면

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| M | `bin/commands/gen.ts`, `multimode.ts`, `node.ts` | lane 등록 | 실행 시 거부 |
| M | `bin/commands/edit.ts` | provider **및 모델 allowlist** 등록 | provider만 추가하고 모델 미등록 |

CLI는 타입체크로 검증되지 않는다. 실제 실행으로 확인한다.

### 범주 5 — 보안 표면

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| M | `routes/auth.ts` | 자식 프로세스 env에서 키 리댁션 | 리댁션 누락 |

### 범주 6 — 테스트 / 문서 / 생성물

| 상태 | 파일 | 검토 계약 | 실패 조건 |
|------|------|-----------|-----------|
| A | `tests/minimax-provider-contract.test.ts` | 계약이 **올바른** 동작을 고정하는가 | 잘못된 동작을 계약으로 고착 |
| M | `tests/models-endpoint-contract.test.ts`, `cli-model-resolver.test.ts`, `cli-capabilities-contract.test.js`, `cli-feature-parity-contract.test.js` | 기존 계약 갱신 정합성 | 계약 약화 |
| M | `docs/migration/runtime-test-inventory.md` | 생성물 재생성 여부 | 손편집 흔적 |
| M | `docs/CLI.md` | lane 문서화 | 다른 문서 표면 누락 |

**미변경인데 변경돼야 하는 파일**도 결함이다. 특히 Web UI(`ui/src/**`)에 MiniMax 등록이
전혀 없다면 백엔드만 있고 사용자 표면이 없는 상태다. 이 항목을 명시적으로 확인한다.

## 게이트 계획 (로컬 재현 subset + live CI)

`typecheck`만으로는 emitted JS와 CLI 표면을 검증할 수 없다. 다만 이 저장소의 CI는
OS × npm 매트릭스로 도는 20여 개 스텝이므로 로컬 실행은 **subset**이다. 재현하는 것과
생략하는 것을 명시적으로 구분한다.

### 로컬에서 재현하는 게이트

```
node scripts/refresh-structure-line-counts.mjs --check   # CI fast-fail (ci.yml:48-49)
npm ci
npm run test:native-deps
npm --prefix ui ci
npm run test:install-policy
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm run build:server
npm run build:cli
npm --prefix ui run build
npm test
npm run lint:pkg
node scripts/audit-gate.mjs --audit-level high --omit dev
node scripts/audit-gate.mjs --prefix ui --audit-level high
node bin/ima2.js capabilities --json                     # CLI smoke
node bin/ima2.js --version
```

빌드 산출물 생성 전에 테스트를 돌리면 `ERR_MODULE_NOT_FOUND`로 위양성 실패가 난다.
빌드 후 재실행한 결과를 기준으로 판정한다.

### 로컬에서 생략하는 게이트 (사유 명시)

| 생략 항목 | 사유 |
|-----------|------|
| Ubuntu/Windows 매트릭스 | 로컬은 macOS 단일. OS 고유 실패를 배제할 수 없다 |
| npm 12 pending-script oracle | npm 버전 고정이 로컬 환경을 오염시킨다 |
| package-install / global-update smoke | 전역 설치를 건드린다. 15분 타임아웃 |
| graceful shutdown, installer parity, publish dry-run | 릴리스 경로. 이 리뷰 범위 밖 |

생략분은 **live CI 상태로 대체 확인**한다: `gh pr checks 118`과 PR HEAD의 최신 check-run
결과를 `021`에 기록한다. 로컬 통과를 CI 통과로 간주하지 않는다.

**fail-closed 원칙.** "체크 없음"은 통과가 아니다. 실측 결과 이 PR에는 check가 0개다:

```
$ gh pr checks 118
no checks reported on the 'octo/20260730-text-to-image-tool-recvqgSocrkiIr' branch
```

따라서 생략한 게이트들은 현재 **아무도 검증하지 않은 상태**이며, 이 사실 자체를
판정에 반영한다.

PR 저자 `octo-patch`는 첫 기여자이고 커밋 메시지가 "checks pass"를 자기 신고한다.
그 신고를 신뢰하지 않고 위 게이트를 직접 재실행한 출력만 증거로 삼는다.

## 외부 스펙 대조 기준

확인 대상 계약: `POST /v1/image_generation`, Bearer 인증, `subject_reference`
(`{type:"character", image_file}`), `aspect_ratio` enum, `image_urls`/`image_base64`,
`base_resp.status_code`, 모델 `image-01` / `image-01-live`의 T2I/I2I 적용 범위.
출처 URL과 확인 시점을 `021`에 기록한다.

## 판정 규칙

`MERGEABLE`은 다음 네 가지가 **모두** 충족될 때만 부여한다:

1. 변경 파일 원장의 6개 범주 전부에서 실패 조건에 걸리는 항목이 없다.
2. 로컬 재현 게이트가 전부 exit 0이다.
3. live CI가 **fail-closed 기준으로 검증됨**:
   - check-run의 head SHA가 PR HEAD SHA와 정확히 일치하고,
   - 요구되는 CI workflow가 실제로 존재하며,
   - 모든 required check가 `completed` + `success`다.
   - check가 0개이거나 `pending`/`skipped`/`cancelled`이면 `UNVERIFIED`로 기록하고
     `MERGEABLE` 판정을 **금지**한다. 이 경우 생략했던 로컬 게이트를 직접 실행하거나
     `CHANGES-REQUESTED` / `NEEDS_HUMAN`으로 남긴다.
4. 외부 스펙 대조에서 불일치가 없다.

- `CHANGES-REQUESTED`: 기능 방향은 타당하나 위 조건 중 하나 이상이 깨진다.
  blocker 각각을 `path:line`과 재현 출력과 함께 기록한다.
- `REJECT`: 스펙 불일치나 보안 문제로 현 상태 수용 불가.

현재 PR은 GitHub상 `mergeable=MERGEABLE`이지만 `mergeStateStatus=UNSTABLE`이다.
GitHub의 `MERGEABLE`은 "충돌 없음"만 의미하므로 이를 승인 근거로 삼지 않는다.

어느 경우든 GitHub에 자동으로 반영하지 않는다. 판정과 근거를 사용자에게 제출하고
실제 조치(머지/코멘트/클로즈)는 승인 후 별도로 수행한다 — 이는 `NEEDS_HUMAN` 잔여로 보고한다.

## 산출물

`021_pr118_verdict.md`를 다음 섹션 구조로 작성한다:

1. 실행 환경 (worktree 경로, PR HEAD sha, node/npm 버전, 설치 결과)
2. 브랜치 지형 (merge-base, 충돌 파일, dev 반영 영향)
3. 게이트 결과 표 (명령 / 종료코드 / 요약) — 빌드 전/후 구분
4. 발견 목록 — 각 항목: 심각도 / 제목 / `path:line` 근거 / 재현 출력 / 수정 제안
5. 보안 감사 결과
6. 외부 스펙 대조 표 + 출처 URL + 확인 시점
7. 기여자 배경
8. 최종 판정 + 사용자에게 남기는 결정 사항

## 리스크

- PR worktree에서 `npm ci`가 네이티브 의존성(`better-sqlite3`, `sharp`) 때문에 오래 걸리거나
  실패할 수 있다. 실패 시 그 사실과 정확한 출력을 기록하고, 게이트를 "미검증"으로 남긴다.
  추정으로 통과 처리하지 않는다.
- 외부 API 스펙은 변할 수 있다. 확인 시점과 출처 URL을 함께 기록한다.
