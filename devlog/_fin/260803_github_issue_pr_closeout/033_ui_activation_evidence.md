# 033 — WP5 활성화 증거 (Web UI 등록)

측정일 2026-08-04 / 대응 기준 `g-ui`

## 실행 환경

| 항목 | 값 |
|------|-----|
| 서버 | `node server.js` 직접 실행 (싱글톤 가드 우회) |
| 격리 | `IMA2_PORT=13401`, config/generated/advertise를 `mktemp -d` 하위로, OAuth·Grok 헬퍼 비활성화 |
| 기동 확인 | `SERVER=200` |
| 브라우저 | agbrowse (로컬 Chrome/CDP) |
| 선행 빌드 | `classify-tests` → `build:server` → `ui build` → `ui/dist/index.html` 존재 확인 |

관측은 `evaluate(발생)` → `wait` → `evaluate(읽기)` 3단계로 분리했다.

## 관측 결과

### provider picker에 MiniMax 노출

```
{"options":["GPT","GPT API","Grok","xAI API","agy","Gem API","Atlas","MiniMax"]}
```

기존 provider 뒤에 `MiniMax`가 Atlas와 같은 자리·같은 밀도로 붙었다.

### provider 선택과 모델 자동 보정

MiniMax 옵션 클릭 후:

```
{"providerLabel":"MiniMax","modelLabel":"minimax"}
```

provider가 전환되고, 모델이 MiniMax 모델이 아니었으므로 `storeSettingsImpl`의 보정
분기가 실제로 발화해 `image-01`(shortLabel `minimax`)로 맞춰졌다.

### 모델 목록 전환

```
{"models":["minimax","minimax live"]}
```

`getImageModelOptionsForProvider("minimax")`가 두 모델만 반환한다. 다른 provider 모델이
섞이지 않았다.

### 설정 화면 등록

```
{"hasMiniMax":true,
 "sample":["MiniMax","MiniMax image-01","MiniMax API","MiniMax API","MiniMax API"]}
```

API 키 섹션 라벨(`MiniMax`), 모델 라벨(`MiniMax image-01`), provider 상태/메타데이터
라벨(`MiniMax API`)이 모두 렌더된다.

스크린샷: `/Users/jun/.browser-agent/screenshots/screenshot_1785811381238.png`

## 계약 테스트

| 파일 | 무엇을 고정하나 | 결과 |
|------|-----------------|------|
| `tests/minimax-ui-registration-contract.test.ts` | F9 오류가 SSE 파싱 → 오류 레지스트리를 거쳐 전용 toast로 해석되는지, minimax 모델이 GPT 목록에 새지 않는지 | 2/2 |
| `tests/reference-limits.test.ts` | MiniMax 1-reference 상한 + 낮은 서버 상한 우선 | 6/6 |
| `tests/i18n-dictionary-contract.test.ts` | en/ko 키 대칭 + 동적 registry 3곳 갱신 | 6/6 |

F9 전파 테스트는 정적 등록 검사가 아니라 `parseSseErrorPayload → resolveErrorSpec`
경로를 실제로 태워 `UNKNOWN`으로 접히지 않음을 확인한다.

## CLI

```
$ node bin/ima2.js edit ... --provider minimax --model image-01-live
✗ server unreachable — is 'ima2 serve' running?
```

모델 거부(`--model must be one of: ...`)가 사라지고 서버 연결 단계까지 진행한다.
수정 전에는 exit 2로 모델에서 막혔다.

## teardown

| 항목 | 결과 |
|------|------|
| 서버 SIGINT 후 포트 13401 | `AFTER_TEARDOWN=000` |
| `agbrowse stop` | Chrome stopped |
| 임시 격리 디렉터리 | 휴지통으로 이동 |

## 한계

키 입력칸 자체는 접힌 상태라 placeholder를 DOM에서 읽지 못했다. 라벨과 provider 상태
표시로 등록은 확인했고, 입력 동작은 기존 `ApiKeyInput` 컴포넌트를 그대로 재사용하므로
provider 문자열만 맞으면 동일하게 동작한다.
