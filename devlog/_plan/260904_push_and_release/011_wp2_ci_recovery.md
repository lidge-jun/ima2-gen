# wp2 — 릴리스 선결 CI 복구 증거 (011)

릴리스 게이트는 exact-head CI다. 릴리스 시작 전 v3.13.0 SHA(d39f9ea2)에서 CI가 실패
중이었다. 중요한 구분: 같은 SHA의 `push`/`workflow_dispatch` 실행은 **성공**했고,
실패는 9/2·9/3·9/4 `schedule` 실행 3건뿐이다. 코드 회귀가 아니라 시간이 지나며
드러난 결함(신규 advisory 공개, 그리고 이미 있던 Windows 버그)이다.

## 결함 A — fast-uri 고위험 취약점

```
audit gate: 1 high+ vulnerability in root production dependencies
high fast-uri  범위 3.0.0 - 3.1.5  fixAvailable: true
경로: @modelcontextprotocol/sdk@1.30.0 > ajv@8.20.0 > fast-uri@3.1.5
```

advisory 4건: GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf,
GHSA-jqff-g426-hqxp.

### 조사가 내 초기 판단을 뒤집었다

나는 처음에 "fixAvailable, 최신은 4.x"만 보고 4.x override를 상정했다. 조사 레인이
바로잡았다:

- `fast-uri@3.1.7`이 존재하고(2026-09-02 릴리스), 취약 범위 `3.0.0 - 3.1.5`를 벗어난다.
- ajv의 선언 범위는 `^3.0.1`이므로 **3.1.7은 ajv가 스스로 원하는 범위 안**이다.
- 4.x override는 ajv가 요구하지 않는 major 교체이며, 4.0.0은 오히려 이후 4.1.3/4.1.4의
  보안 수정 이전 버전이라 더 나쁜 선택이었다.

즉 major 강제 없이 patch 고정으로 끝나는 문제였다. 확인:

```
npm view fast-uri@3.1.7 version   -> 3.1.7
ajv dependencies['fast-uri']      -> ^3.0.1
npm audit range                   -> 3.0.0 - 3.1.5
```

### 적용

`package.json`에 `overrides: { "fast-uri": "3.1.7" }`. 이 저장소에 root overrides 전례는
없었으나(a02fcf74는 ui lockfile 직접 갱신), 전이 의존성을 정확히 고정하는 표준 수단이다.

주석은 `overrides` 밖에 두었다 — npm이 `//` 키를 "Override without name"으로 거부한다
(실행으로 확인).

### lockfile 오염 방지

첫 `npm install`이 override와 무관한 의존성까지 대거 갱신했다
(`@hono/node-server` 1.19.17 → **2.1.1 major**, sharp 바이너리 다수 등, 321 insertions).
릴리스 커밋에 검증되지 않은 major 업그레이드를 섞는 것은 명백히 위험해서 되돌리고
`--package-lock-only --prefer-offline`으로 재생성했다. 최종 diff:

```
 package-lock.json | 6 +++---
-      "version": "3.1.5",  ->  +      "version": "3.1.7",
```

fast-uri 3줄뿐이다.

### 런타임 검증 (override는 조용히 깨질 수 있다)

`npm ci` 후 ajv가 실제로 동작하는지 실행했다. 정적 확인만으로는 부족하다 —
URI 정규화 semantics는 보안 수정 과정에서 바뀌고, ajv는 `$ref` 해석에 fast-uri를 쓴다.

```
fast-uri version: 3.1.7
ajv $ref resolve ok: true | rejects wrong type: true
fast-uri resolve: https://example.test/a/c.json
fast-uri parse host: example.test
```

`npm ls fast-uri --omit=dev` → `fast-uri@3.1.7 overridden`.
`npm run audit:gate` → `no high+ vulnerabilities in root production dependencies`.

## 결함 B — Windows action pin 경로 구분자

```
not ok 21 - discovers manifests wherever a local action actually lives
  error: 'discovery missed .github/workflows/a.yml;
          found .github\\actions\\x\\y\\action.yaml, .github\\workflows\\a.yml, ...'
```

제품 코드가 아니라 `tests/_actionPins.mjs`의 `pinnedManifestPaths()`가 반환하는 경로
형식이 OS에 따라 달라지는 것이 원인이다. sweep 구현 자체가 테스트 지원 모듈에만
존재하며 `scripts/` 아래에 대응 제품 코드는 없다.

### 조사안보다 한 단계 더 들어간 이유

조사는 반환 시점(`return` 직전) 정규화를 제안했다. 그것으로도 assertion은 통과하지만
**Set 내부의 중복 제거가 여전히 깨진다**: 루프가 YAML에서 파싱한 POSIX 후보를
`paths.has(candidate)`로 검사하는데, `join()`으로 넣은 항목은 Windows에서 `\\` 형식이라
같은 manifest가 두 spelling으로 두 번 등록된다. 그래서 **삽입 시점**에 정규화했다.

```js
const rel = (path) => path.split(sep).join("/");
...paths.add(rel(join(".github/workflows", name)));
...else if (/^action\.ya?ml$/.test(entry)) paths.add(rel.split(sep).join("/"));
```

### macOS에서 Windows 동작 검증

`path.win32`로 재현했다(현재 플랫폼 sep은 `/`):

```
win32.join                        -> ".github\\workflows\\a.yml"
normalized with win sep           -> ".github/workflows/a.yml"
posix unchanged                   -> ".github/workflows/a.yml"
dedup vs POSIX candidate works    -> true
```

정규화가 Windows 형식을 POSIX로 바꾸고 중복 제거를 복구하며, POSIX에서는 무변화다.
다만 **네이티브 Windows filesystem/symlink 동작의 최종 증거는 CI가 필요하다** —
로컬에서 증명했다고 주장하지 않는다.

## 게이트 결과

| 명령 | 결과 |
|---|---|
| `npm run verify:release:source` | **exit 0** (릴리스 워크플로가 실행하는 바로 그 게이트) |
| `npm test` | 2786 tests / 2784 pass / **0 fail** |
| `npm run audit:gate` | root high+ 0, ui는 기존 만료부 예외 2건 |
| `tests/action-pin-contract.test.ts` | 25/25 |
| MCP 계약 5개 파일 | 90 pass / 0 fail |
| ajv 런타임 `$ref` 해석 | 정상 |

## 범위 준수

무관한 의존성 업그레이드 없음(lockfile diff 3줄), dependabot PR 미개입,
릴리스 워크플로 로직 무변경, 강제 푸시 없음.

