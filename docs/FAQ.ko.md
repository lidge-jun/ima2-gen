# ima2-gen 자주 묻는 질문

마지막 확인: 2026-04-25

이 문서는 설치, 업데이트, OAuth, 갤러리, 레퍼런스 이미지 관련 질문을 모아둔 FAQ입니다. README는 짧게 유지하고, 자세한 설명은 이곳에 둡니다.

English version: [FAQ.md](FAQ.md)

## 빠른 해결

| 증상 | 먼저 해볼 것 |
|---|---|
| 서버에 연결되지 않음 | `ima2 serve`를 켠 뒤 `ima2 ping`을 실행합니다. |
| OAuth 로그인이 안 됨 | `npx @openai/codex login`을 실행하고 `ima2 serve`를 다시 시작합니다. |
| API key provider가 `API_KEY_REQUIRED`를 반환함 | API 키를 설정하거나 OAuth 공급자로 다시 전환합니다. |
| 업데이트 후 예전 이미지가 안 보임 | `ima2 doctor`를 실행한 뒤 [예전 이미지 복구 안내](RECOVER_OLD_IMAGES.md)를 확인합니다. |
| `gpt-5.5`만 실패함 | Codex CLI를 업데이트하고, 안정 대안으로 `gpt-5.4`를 사용합니다. |
| 레퍼런스 업로드 실패 | JPEG/PNG로 변환하고 해상도를 낮춰 보세요. 레퍼런스는 최대 5장입니다. |
| Windows에서 `10531` 포트 관련 OAuth/proxy 오류가 남 | `ima2 doctor`를 실행하고, 필요하면 `IMA2_OAUTH_PROXY_PORT=11531 ima2 serve`로 시작하세요. |
| 프록시/VPN 환경에서 `fetch failed`가 반복됨 | 프록시 클라이언트의 TUN/TURN류 모드를 켜거나, 같은 터미널에 `HTTP_PROXY` / `HTTPS_PROXY`를 설정하세요. |

## 설치와 업데이트

### Node.js 버전은 무엇이 필요한가요?

Node.js 20 이상을 권장합니다. 패키지 요구사항은 Node `>=20`입니다.

### `npx`와 전역 설치 중 무엇을 쓰면 되나요?

둘 다 가능합니다.

```bash
npx ima2-gen serve
```

또는:

```bash
npm install -g ima2-gen
ima2 serve
```

예전 전역 설치가 이상하게 동작하면 먼저 최신 버전으로 올려 주세요.

```bash
npm install -g ima2-gen@latest
ima2 doctor
```

### Windows에서 `spawn EINVAL`이 보여요.

최신 버전으로 업데이트하세요. 예전 버전에서는 Windows의 npm/npx shim 실행에서 문제가 날 수 있었습니다. 현재 버전은 Windows에서 더 안전한 실행 경로를 사용합니다.

Codex 로그인 자체가 Windows 네이티브 환경에서 불안정하다면 WSL이 더 예측 가능한 선택일 수 있습니다.

### Windows 업데이트 중 `EBUSY` 또는 `resource busy or locked`가 떠요.

대부분 실행 중인 `ima2 serve`, 남아 있는 `node.exe`, 터미널, Explorer, 백신,
인덱서가 global package 폴더를 잡고 있어서 생깁니다. ima2 서버와 관련
터미널을 닫고, 필요하면 작업 관리자에서 남은 `node.exe`를 종료한 뒤 다시
시도하세요.

```bash
npm install -g ima2-gen@latest
```

계속 실패하면 Windows를 재부팅한 뒤 ima2를 실행하기 전에 바로 업데이트하세요.

## 인증과 provider

### OpenAI API 키가 필요한가요?

기본 생성 경로에는 필요하지 않습니다. 기본 경로는 로컬 Codex/ChatGPT OAuth 세션을 사용합니다.

API 키를 설정하면 이미지 생성 엔드포인트도 `provider: "api"`로 Responses API `image_generation` 도구를 사용할 수 있습니다.

### 설정 화면의 "API key provider available"은 무슨 뜻인가요?

`ima2-gen`이 유효한 API 키를 찾았다는 뜻입니다. API-Key 모드는 생성, 편집, 멀티모드, 노드 출력을 지원합니다. 키가 없으면 `provider: "api"` 요청은 upstream 호출 전에 `API_KEY_REQUIRED`로 실패합니다.

### Codex CLI에 이미 로그인되어 있으면 자동으로 잡히나요?

네. `ima2-gen`은 기존 Codex 로그인 상태를 확인하고 로컬 OAuth 경로를 사용합니다. 감지에 실패하거나 토큰이 만료되면 다음을 실행하세요.

```bash
npx @openai/codex login
ima2 doctor
```

그다음 `ima2 serve`를 다시 시작합니다.

### `Provided authentication token is expired`가 떠요.

Codex/ChatGPT OAuth 세션을 다시 로그인해야 합니다.

```bash
npx @openai/codex login
ima2 serve
```

회사 네트워크라면 방화벽, VPN, 프록시, 보안 프로그램이 OAuth 흐름을 막고 있을 수도 있습니다.

## 모델과 한도

### 어떤 모델부터 쓰면 좋나요?

안정적인 균형을 원하면 `gpt-5.4`부터 쓰는 것을 추천합니다.

- `gpt-5.4`: 추천 기본 선택지.
- `gpt-5.4-mini`: 현재 앱 기본값이며 빠른 초안에 적합합니다.
- `gpt-5.5`: 지원되는 환경에서는 가장 강한 품질 선택지입니다.

### `gpt-5.5`만 실패하는 이유는 뭔가요?

`gpt-5.5`는 최신 Codex CLI, 백엔드 capability, 계정 또는 quota 상태의 영향을 받을 수 있습니다. 먼저 Codex CLI를 업데이트하세요. 그래도 실패하면 안정 대안으로 `gpt-5.4`를 사용하세요.

### Plus/Pro는 몇 장까지 생성할 수 있나요?

커뮤니티에서 말하는 숫자를 보장으로 받아들이면 안 됩니다. OAuth 생성은 계정, 백엔드 capability, 트래픽, 정책 변경의 영향을 받을 수 있습니다. `ima2-gen` 문서에서는 고정된 Plus/Pro 생성 횟수를 약속하지 않습니다.

## 갤러리와 생성 파일

### 생성 이미지는 어디에 저장되나요?

현재 버전은 사용자 데이터 폴더에 저장합니다.

```text
macOS / Linux: ~/.ima2/generated
Windows: %USERPROFILE%\.ima2\generated
```

`IMA2_GENERATED_DIR`로 다른 위치를 지정할 수 있습니다.

### 업데이트 후 예전 갤러리 이미지가 안 보여요.

예전 버전은 생성 이미지를 설치된 패키지 폴더 안에 저장했습니다. 최근 버전은 패키지 업데이트와 사용자 파일이 섞이지 않도록 갤러리 저장 위치를 사용자 데이터 폴더로 옮겼습니다.

놀라게 해드려 죄송합니다. 업데이트 중 예전 전역 설치 폴더가 교체되었다면 이전 `generated/` 폴더가 디스크에 남아 있지 않을 수 있습니다. `ima2-gen`은 예전 폴더가 아직 있을 때만 파일을 복사해 복구할 수 있습니다.

먼저 실행하세요.

```bash
ima2 doctor
```

그다음 [예전 이미지 복구 안내](RECOVER_OLD_IMAGES.md)를 확인하세요.

### 이 마이그레이션이 예전 이미지를 삭제하나요?

아니요. 마이그레이션은 copy-only입니다. 예전 폴더를 삭제하거나 이동하지 않습니다. 예전 파일을 찾지 못했다면, 예전 전역 설치 폴더가 이미 디스크에 남아 있지 않은 상황일 수 있습니다.

### "Open folder"는 어떤 폴더를 여나요?

갤러리의 **Open folder** 버튼은 `ima2 serve`가 실행 중인 머신의 생성 이미지 폴더를 엽니다.

보통은 내 컴퓨터입니다. 하지만 원격 서버, SSH, VM, 컨테이너, WSL, 같은 네트워크의 다른 머신에서 서버를 돌리고 있다면 브라우저를 보고 있는 기기가 아니라 서버 머신 기준으로 열리거나 처리됩니다.

### Card News는 공개 안정 기능인가요?

아직 아닙니다. Card News는 dev-only / experimental 작업면입니다. 기본 배포
런타임에서는 명시적으로 개발용 플래그를 켜지 않는 한 숨겨져 있어야 하며,
공개 문서에서도 안정 기능처럼 다루지 않습니다.

## 레퍼런스 이미지

### 레퍼런스 이미지는 몇 장까지 붙일 수 있나요?

최대 5장입니다.

### 어떤 형식이 좋나요?

JPEG 또는 PNG가 가장 안전합니다. 브라우저 경로에서는 HEIC/HEIF를 직접 지원하지 않으므로 먼저 변환해 주세요.

### 이미지가 너무 크다고 나와요.

앱이 큰 JPEG/PNG를 업로드 전에 자동 압축합니다. 그래도 실패하면 해상도를 낮추거나 JPEG/PNG로 변환해 다시 시도하세요.

API에서는 `REF_TOO_MANY`, `REF_TOO_LARGE`, `REF_NOT_BASE64`, `REF_EMPTY` 같은 reference 오류가 나올 수 있습니다.

## 네트워크와 OAuth 오류

### 백엔드나 OAuth 프록시가 왜 다른 포트로 열리나요?

`ima2-gen`은 로컬 앱입니다. 기본 백엔드 포트 `3333` 또는 OAuth 프록시 포트 `10531`이 이미 사용 중이면 다음 사용 가능한 포트로 fallback할 수 있고, 실제 URL은 아래 파일에 기록됩니다.

```text
~/.ima2/server.json
```

아래 명령으로 configured/actual 포트를 확인하세요.

```bash
ima2 doctor
```

### Windows에서 `AnySign4PC.exe`가 `10531`을 쓰면 어떻게 하나요?

일부 Windows 보안 프로그램이 기본 OAuth 프록시 포트 `10531`을 점유할 수 있습니다. 현재 빌드는 fallback된 실제 포트를 추적하지만, 원하면 포트를 직접 바꿀 수 있습니다.

```bash
IMA2_OAUTH_PROXY_PORT=11531 ima2 serve
```

프론트엔드만 따로 개발 서버로 띄우는 경우에는 Vite가 실제 백엔드를 보게 지정하세요.

```bash
VITE_IMA2_API_TARGET=http://localhost:3334 npm run ui:dev
```

### `failed to fetch`는 무슨 뜻인가요?

보통 아래 중 하나입니다.

- 로컬 OAuth 프록시가 아직 준비되지 않았습니다.
- 서버가 재시작되었습니다.
- VPN, 프록시, 방화벽이 요청을 막았습니다.
- Codex/ChatGPT OAuth 사용 중 네트워크가 끊겼습니다.

먼저 확인하세요.

```bash
ima2 doctor
ima2 ping
```

필요하면 `ima2 serve`를 다시 시작합니다.

### 프록시나 VPN 뒤에서 `fetch failed`가 계속 나면 어떻게 하나요?

대부분 로컬 OAuth 프록시가 현재 네트워크 경로로 upstream 서비스에 닿지 못하는 상황입니다. `openai-oauth`는 보통 `10531` 포트의 localhost 프록시로 실행됩니다.

먼저 시도하세요.

```bash
npx openai-oauth --port 10531
```

프록시가 필요한 네트워크라면 터미널 프로세스도 프록시를 타도록 프록시 클라이언트의 TUN/TURN류 모드를 켜세요. 그래도 안 되면 `openai-oauth` 또는 `ima2 serve`를 실행하는 같은 터미널에 프록시 환경 변수를 설정합니다.

```bash
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
```

호스트와 포트는 사용하는 프록시 클라이언트 값에 맞춰 바꾸세요. 로컬 OAuth 프록시가 접근 가능한 상태에서도 `ima2-gen`이 계속 실패하면, 새 이슈를 열 때 실행 명령, OS, 프록시 설정, 터미널 오류를 함께 남겨 주세요.

### 회사 컴퓨터에서는 무엇을 확인해야 하나요?

OAuth는 OpenAI와 ChatGPT/Codex 관련 호스트 접근이 필요할 수 있습니다. 회사 방화벽, TLS 검사, VPN, 프록시가 흐름을 깨뜨릴 수 있습니다. 로그인 실패와 `failed to fetch`가 반복되면 다른 네트워크에서도 시도해 보세요.

## CLI 점검 순서

아래 순서대로 확인해 보세요.

```bash
ima2 doctor
ima2 status
ima2 ping
ima2 ps
npx @openai/codex login
npm install -g ima2-gen@latest
```

서버를 기본 포트가 아닌 곳에서 실행 중이라면:

```bash
IMA2_SERVER=http://localhost:3333 ima2 ping
```
