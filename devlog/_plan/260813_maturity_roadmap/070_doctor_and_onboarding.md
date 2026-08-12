---
created: 2026-08-13
updated: 2026-08-13
tags: [ima2-gen, devlog, phase, doctor, onboarding]
---

# 070 — doctor 확장과 온보딩

- work-phase: WP5 첫 문서
- 소비: `040` registry (공급자·자격증명·모델), `060` 오류 클래스
- 소비되는 곳: 없음. **`080`은 이 문서를 소비하지 않는다** — J1~J5 어디에도 doctor
  실행이 없다. 초안의 간선은 장식이었고 A phase 감사가 확인했다

## 신규 구현이 아니다

평가서는 Phase 1의 핵심 과제로 "`ima2 doctor` 구현"을 든다. **이미 있다**
(`002` C-12). `bin/commands/doctor.ts`가 236줄이고 다음을 검사한다.

| 현재 검사 | 위치 |
|---|---|
| Node.js major >= 20 | `bin/commands/doctor.ts:135` — **npm 버전은 보지 않는다** |
| `package.json` 존재 | `bin/commands/doctor.ts:146` |
| 런타임 의존성 해석 가능 | `bin/commands/doctor.ts:155` |
| `.env` 존재 | `bin/commands/doctor.ts:163` |
| 설정된 provider | `bin/commands/doctor.ts:171` |
| 스토리지 / 하드닝 | `bin/lib/storage-doctor.ts`, `bin/lib/doctor-checks.ts` |
| **포트 충돌** | `bin/lib/doctor-checks.ts:23`의 `probePort()`가 실제 `listen()`으로 검사하고 `standardDoctor()`가 호출한다 (`bin/commands/doctor.ts:185`) |
| SQLite 로드 | `bin/lib/doctor-checks.ts:34` — `:memory:` DB만 연다. **설정된 `dbPath`의 쓰기 권한은 보지 않는다** |
| GPT OAuth 파일 기반 세션 | `bin/commands/doctor.ts:217` |
| 이미지 probe | **별도 하위 명령** `ima2 doctor image-probe` (`bin/commands/doctor.ts:231`) |

### `image-probe`는 유료다 — 그리고 이미 분리돼 있다

`ima2 doctor image-probe`는 `lib/responsesDoctor.ts:306`에서 `POST`로
`/v1/responses`를 호출하고 `action: "generate"` 페이로드를 보낸다
(`lib/responsesDoctor.ts:79`). **실제 생성이고 과금된다.**

중요한 것은 이것이 **별도 하위 명령이라는 점**이다. `bin/commands/doctor.ts:231`이
`args[0] === "image-probe"`일 때만 그 경로로 들어간다. 즉 그냥 `ima2 doctor`는
지금도 생성을 호출하지 않는다.

따라서 이 phase의 규칙은 **기존 동작의 수정이 아니라 유지**다. 아래 `g1`은 새
제약을 거는 것이 아니라 **이미 참인 성질을 테스트로 고정**한다. 확장 과정에서
공급자별 검증을 추가하다가 그 성질을 깨뜨리는 것이 실제 위험이다.

`--probe`라는 새 플래그 이름은 쓰지 않는다. 이미 `image-probe` 하위 명령이 있어
혼동을 부른다. 공급자 키 검증용 플래그는 `--verify-keys`로 명명한다.

`002` C-14는 `scripts/package-global-update-smoke.mjs:134`가 unauthed 상태에서
`doctor`를 호출해 exit 1을 단언한다는 근거로 "비과금이 이미 지켜진다"고 적었다.
**그것은 근거가 아니다**(A phase 감사). 그 스모크는 종료 코드와 출력만 보고
fetch를 감시하지 않는다. 기본 `doctor`가 비과금인 것은 사실이지만, 그 사실을
증명하는 테스트는 아직 없다 — `g1`이 만든다.

**따라서 이 phase는 확장이다.** 평가서 목록에서 실제로 없는 것만 추린다.

| 평가서 제안 | 상태 |
|---|---|
| Node/npm 지원 버전 | **부분** — Node major만. npm 버전 검사 없음 |
| 패키지 설치 무결성 | **부분** — 모듈 해석만. 무결성과 동일시하지 않는다 |
| SQLite 쓰기 권한 | **부분** — `:memory:` 로드만. 실제 `dbPath` 쓰기 검사 없음 |
| 각 공급자 인증 상태 | **부분** — GPT OAuth만. 나머지 7개 lane 없음 |
| 비과금 capability 검증 | **없음** — 기본 `doctor`는 네트워크를 아예 안 쓰므로 capability를 검증하지 않는다. 유일한 capability probe는 유료 `image-probe`다. 기본이 비과금인 것은 안전 성질이지 검증 능력이 아니다 |
| 지원 모델과 기능 | **없음** |
| 포트 충돌 | **있음** — `bin/lib/doctor-checks.ts:23`. 새로 만들지 않는다 |
| ffmpeg/영상 의존성 | **없음** |
| 진단 번들 | **없음** |

## 파일 변경 맵

| 경로 | 동작 |
|---|---|
| `bin/commands/doctor.ts` | 아래 4개 섹션 추가. 500줄 한도에 유의 — 초과하면 `bin/lib/doctor-*.ts`로 분리 |
| `bin/lib/doctor-providers.ts` (신규) | `040` registry를 순회하며 lane별 자격증명 존재·형식 검사 |
| `bin/lib/doctor-checks.ts` | 기존 `probePort()` 유지. **신규 파일을 만들지 않는다.** npm 버전 검사와 실제 `dbPath` 쓰기 검사를 여기에 추가 |
| `bin/lib/doctor-media.ts` (신규) | ffmpeg 등 영상 의존성 |
| `bin/lib/doctor-bundle.ts` (신규) | 민감정보 제거 진단 번들 |
| `tests/doctor-provider-contract.test.ts` (신규) | 비과금 보장 + registry 연동 |

### 1. 공급자별 인증 상태

`040`의 `credentials[]`를 순회한다. 각 수단마다 **무엇을 검사할 수 있는지가
다르다.**

| kind | 검사 |
|---|---|
| `api-key` | 키 존재, `keyPrefix` 일치. `validateUrl` 호출은 **선택** (`--verify-keys`) |
| `oauth-proxy` | 파일 기반 세션 존재 (기존 GPT 경로를 일반화) |
| `service-account` | 자격증명 파일 경로 존재·읽기 가능 |
| `local-cli` | 실행 파일 해석 가능 |

### 2. 비과금 capability 검증

**이것이 이 phase에서 가장 조심할 부분이다.** 평가서도 "검증 과정에서 실제 유료
생성 요청을 호출해서는 안 된다"고 못 박는다. PR #118 보수에서 유료 생성을 인증
검증으로 쓴 전례가 있다(`002` 참조 맥락).

규칙을 코드로 강제한다.

- 기본 `doctor`는 **네트워크 요청을 하지 않는다.** 키 존재와 형식만 본다.
- `--verify-keys`를 줘야 `validateUrl`을 호출한다. MiniMax는 `keyPrefix`가 비어
  있으므로(`routes/keys.ts:42`) 형식 검사가 불가능하고, 그 lane은 존재 여부만 보고
  그 사실을 출력에 명시한다. 이 URL들은 모델 **목록** 조회이지
  생성이 아니다(`routes/keys.ts:46`의 `VALIDATE_URL_MAP`).
- 생성 엔드포인트 호출 경로는 **기본 `doctor`에** 존재하지 않는다. 테스트가 이를
  고정한다.
- **예외는 하나뿐이고 명시한다:** `ima2 doctor image-probe`는 실제 생성을
  2회 이상(`--matrix`면 더) 호출하는 **유료 하위 명령**이다. 없애지 않는다 —
  `EMPTY_RESPONSE` 진단에 필요하다. 대신 (a) `--help`와 실행 시작 시 과금 경고를
  **stderr로** 출력하고(첫 네트워크 호출 이전에), (b) `g2b`/`g2c` 테스트가 기본
  `doctor`의 도달 불가능성과 `--json` 순수성을 고정한다. 문서가 "doctor는 절대 과금하지 않는다"고 단정하면 그것은 거짓이다.

### 3. 포트 / 영상 의존성 / 진단 번들

진단 번들은 토큰·프롬프트·이미지를 제거한다. 무엇을 **포함**하는지 화이트리스트로
정의한다(블랙리스트는 새 필드가 생길 때마다 샌다).

## IN / OUT

- IN: `bin/commands/doctor.ts`, `bin/lib/doctor-checks.ts`(기존 확장), 신규 3종
  (`doctor-providers.ts`, `doctor-media.ts`, `doctor-bundle.ts`), 테스트.
- OUT: 첫 실행 마법사(별도 UX 작업), 텔레메트리(소유자 결정), `routes/keys.ts`의
  검증 로직 변경, 공급자 추가.

## 수용 기준

- `g1`: **기본 `doctor`가 네트워크 요청을 0건 한다.** fetch를 스텁으로 감시해
  호출 0을 단언한다. 이것이 이 phase의 최우선 기준이다.
- `g2`: `--verify-keys`에서도 **생성 엔드포인트는 호출되지 않는다.** 호출된 URL이
  전부 `040`의 `validateUrl` 집합에 속한다.
- `g2b`: `ima2 doctor image-probe`는 지금처럼 **명시적 하위 명령으로만** 도달
  가능하다. 기본 `doctor`가 그 유료 경로로 새지 않음을 테스트가 고정하고,
  `image-probe` 자신은 과금 경고를 **stderr로** 출력한다.

- `g2c`: **경고가 `--json`에서도 보인다.** 문서가 안내하는
  `ima2 doctor image-probe --json > out.json`(`docs/CLI.md:240`, `docs/FAQ.md:289`)
  에서 stdout은 순수 JSON을 유지하고 경고는 stderr로 나간다. 경고를 stdout에
  쓰면 리다이렉션에 삼켜져 **사용자가 못 보고 JSON도 깨진다.** 테스트가 두 스트림을
  각각 캡처하고, 경고가 `runImageDoctorProbe()` 호출 **이전에** 나오는지 확인한다.
- `g3`: 8개 lane 전부가 인증 상태 줄을 출력한다. registry에 lane을 추가하면
  doctor 출력이 **자동으로** 늘어난다(`040` 소비의 실증).
- `g4`: 진단 번들에 키·토큰·프롬프트·이미지가 없다. 알려진 비밀 패턴으로 스캔한다.
- `g5`: `bin/commands/doctor.ts`가 500줄을 넘지 않는다(프로젝트 규약).

## 조건부 경로 활성화 시나리오

| 조건부 경로 | 트리거 | 관측되는 효과 |
|---|---|---|
| 키 없음 | 모든 키 env 제거 | 8개 lane 전부 "미설정"으로 표시, exit 비0 |
| 키 형식 불일치 | `xai-` 대신 `sk-`를 xAI 자리에 | 해당 lane만 형식 오류 |
| `--verify-keys` 미지정 | 기본 실행 | 네트워크 0건 (`g1`) |
| `--verify-keys` + 잘못된 키 | 실제 호출 | `060`의 `AUTH_INVALID` 클래스로 보고 |
| MiniMax 형식 검사 | MiniMax 키 설정 | 접두사가 없으므로 형식 판정을 **하지 않는다**고 출력 |
| `image-probe` 격리 | 기본 `doctor` 실행 | 유료 생성 경로로 새지 않음 (`g2b`) |
| 포트 점유 | 설정 포트를 먼저 점유 | 충돌 보고. **점유 해제 후 정상**도 함께 관측 |
| ffmpeg 없음 | PATH에서 제거 | 영상 기능 경고, 이미지 기능은 정상 |

`g1`의 네트워크 0건은 **음성 대조로만 증명된다**. "오류가 안 났다"는 증거가
아니다 — 호출 카운터를 읽어야 한다.

## verifier

| 명령 | 관측 대상 | 실행 결과 |
|---|---|---|
| `npm run typecheck` | `bin/**/*.ts` | include에 `bin/**/*.ts` 포함 — **관측함** |
| `node --test tests/doctor-provider-contract.test.ts` | 비과금·registry 연동 | 파일 미존재 (B에서) |
| `node bin/ima2.js doctor` | 실제 출력 | **실행 가능** — 현재도 동작한다 |
| `npm test` | 회귀 | `d2fe420`에서 2118/2116 pass |

## 측정하지 않는 것

평가서의 종료 조건 "첫 이미지 생성 중앙값 5분 이하", "설치 후 첫 생성 성공률
85%"는 **이 phase가 측정할 수 없다.** 사용자 행동 데이터가 필요하고 그 수집
여부는 소유자 결정이다. doctor는 그 결정과 무관하게 **로컬에서 즉시 유용하다**.
