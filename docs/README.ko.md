# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **다른 언어로 읽기**: [English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

`ima2-gen`은 ChatGPT/Codex OAuth 경로로 OpenAI 이미지 생성을 실행하는 로컬 CLI + 웹 스튜디오입니다. React UI, 헤드리스 CLI, 영구 히스토리, 레퍼런스 업로드, 개발용 노드 모드 분기 생성, 안전한 요청 로그를 제공합니다.

현재 이미지 생성은 **OAuth 전용**입니다. API 키는 billing/status 확인이나 style-sheet 추출 같은 보조 개발 경로에는 사용할 수 있지만, 이미지 생성 엔드포인트는 코드에서 `provider: "api"`를 `APIKEY_DISABLED`로 명시적으로 거부합니다.

![ima2-gen 스크린샷](../assets/screenshot.png)

---

## 빠른 시작

```bash
npx ima2-gen serve

# 또는 전역 설치
npm install -g ima2-gen
ima2 serve
```

첫 실행 시 설정 화면이 열립니다:

```text
1) API Key  — 지원되는 보조 경로용 OpenAI API 키 저장
2) OAuth    — 이미지 생성을 위해 ChatGPT/Codex 계정으로 로그인
```

현재 릴리스에서 실제 생성은 OAuth를 선택해야 합니다. Codex 로그인이 아직 없다면:

```bash
npx @openai/codex login
ima2 serve
```

기본 웹 UI 주소는 `http://localhost:3333`입니다.

---

## 현재 지원 기능

### OAuth 이미지 생성

- `/api/generate` 텍스트 기반 이미지 생성
- `/api/edit` 이미지 편집 / 이미지 기반 생성
- 루트 생성 요청당 최대 5장 레퍼런스
- Quality: `low`, `medium`, `high`
- Moderation: `low`, `auto`
- PNG/JPEG/WebP 출력
- UI 병렬 생성 수: 1, 2, 4. CLI/server 상한은 8
- `gpt-image-2` 제약에 맞춘 사이즈 프리셋

### UI 워크플로

- 드래그 앤 드롭 및 Cmd/Ctrl+V 이미지 붙여넣기
- 현재 이미지를 다음 생성 레퍼런스로 재사용
- 하단 갤러리 스트립과 전체 갤러리 모달
- 생성물 삭제/복원
- 헤더 톱니바퀴에서 여는 설정 워크스페이스
- 계정/테마 설정을 사이드바 밖으로 분리
- 우측 사이드바는 생성 세부 옵션만 표시
- 새로고침 후에도 진행 중 작업을 자동 reconcile

### 노드 모드

노드 모드는 `npm run dev`에서 활성화되는 개발용 화면입니다.

- SQLite 기반 그래프 세션
- 자식 노드 분기 생성
- Duplicate branch / New from here 흐름
- 노드별 로컬 레퍼런스 첨부
- 세션 style sheet로 classic/node 프롬프트 앞에 하우스 스타일 자동 삽입
- 갤러리 그룹에서 raw session id 대신 세션 제목 우선 표시

### 관측성

- generate/edit/node/OAuth/session/history/inflight lifecycle 구조화 로그
- `requestId` 기반 추적
- 기본 `/api/inflight`는 active-only
- `/api/inflight?includeTerminal=1`에서만 최근 완료/실패/취소 job 확인
- 로그에는 raw prompt, effective/revised prompt, token, auth header, cookie, request body, reference data URL, generated base64, raw upstream body를 남기지 않음

---

## CLI 명령

### 서버 명령

| 명령 | 별칭 | 설명 |
|---|---|---|
| `ima2 serve` | — | 로컬 웹 서버 시작 |
| `ima2 setup` | `login` | 저장된 인증 설정 변경 |
| `ima2 status` | — | 설정과 OAuth 세션 상태 표시 |
| `ima2 doctor` | — | Node/package/config/auth 상태 진단 |
| `ima2 open` | — | 웹 UI 열기 |
| `ima2 reset` | — | 저장 설정 삭제 |
| `ima2 --version` | `-v` | 버전 출력 |
| `ima2 --help` | `-h` | 도움말 출력 |

### 클라이언트 명령

`ima2 serve`가 실행 중이어야 합니다.

| 명령 | 설명 |
|---|---|
| `ima2 gen <prompt>` | CLI에서 이미지 생성 |
| `ima2 edit <file> --prompt <text>` | 기존 이미지 편집 |
| `ima2 ls` | 히스토리 목록 출력, table 또는 `--json` |
| `ima2 show <name>` | 생성물 표시/Reveal |
| `ima2 ps` | 진행 중 job 목록 |
| `ima2 ping` | 실행 중 서버 health check |

서버는 `~/.ima2/server.json`에 포트를 광고합니다. CLI는 이를 자동 발견하며, `--server <url>` 또는 `IMA2_SERVER=http://localhost:3333`으로 재정의할 수 있습니다.

### 종료 코드

`0` 정상 · `2` 잘못된 인수 · `3` 서버 연결 불가 · `4` `APIKEY_DISABLED` · `5` 4xx · `6` 5xx · `7` 안전 거부 · `8` 타임아웃.

---

## API 엔드포인트

```text
GET    /api/health
GET    /api/providers
GET    /api/oauth/status
GET    /api/billing
GET    /api/inflight
GET    /api/inflight?includeTerminal=1
POST   /api/generate
POST   /api/edit
GET    /api/history
GET    /api/history?groupBy=session
DELETE /api/history/:filename
POST   /api/history/:filename/restore
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:id
PATCH  /api/sessions/:id
DELETE /api/sessions/:id
PUT    /api/sessions/:id/graph
GET    /api/node/:nodeId
POST   /api/node/generate
```

### OAuth 생성 요청

```bash
curl -X POST http://localhost:3333/api/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "a shiba in space",
    "quality": "medium",
    "size": "1024x1024",
    "moderation": "low",
    "provider": "oauth"
  }'
```

### API 키 설정 및 활성화 참고

현재 동작:

- 지원되는 생성 경로는 `provider: "oauth"`입니다.
- `provider: "api"`는 `routes/generate.js`, `routes/edit.js`, `routes/nodes.js`에서 `403` / `APIKEY_DISABLED`로 거부됩니다.
- `OPENAI_API_KEY` 또는 `~/.ima2/config.json`의 API 키는 billing probe, style-sheet extraction 같은 비생성 보조 경로에 사용할 수 있습니다.

보조 경로용 API 키 설정:

```bash
export OPENAI_API_KEY="sk-..."
ima2 serve
```

또는 `~/.ima2/config.json`:

```json
{
  "provider": "api",
  "apiKey": "sk-..."
}
```

개발자가 API 키 기반 이미지 생성을 의도적으로 다시 열려면 아래 파일의 `provider === "api"` guard를 감사하고 변경해야 합니다.

- `routes/generate.js`
- `routes/edit.js`
- `routes/nodes.js`

단순히 guard만 제거하지 말고 OpenAI SDK 기반 생성/편집 구현, OAuth/API 양쪽 테스트, billing/error 테스트, README 갱신까지 함께 해야 합니다.

---

## 설정

우선순위:

```text
환경 변수 > ~/.ima2/config.json > 기본값
```

| 변수 | 기본값 | 설명 |
|---|---:|---|
| `IMA2_PORT` / `PORT` | `3333` | 웹 서버 포트 |
| `IMA2_OAUTH_PROXY_PORT` / `OAUTH_PORT` | `10531` | OAuth 프록시 포트 |
| `IMA2_SERVER` | — | CLI 대상 서버 재정의 |
| `IMA2_CONFIG_DIR` | `~/.ima2` | 설정 및 SQLite 위치 |
| `IMA2_GENERATED_DIR` | `generated/` | 생성 이미지 저장 위치 |
| `IMA2_NO_OAUTH_PROXY` | — | `1`이면 OAuth proxy 자동 시작 비활성화 |
| `IMA2_INFLIGHT_TERMINAL_TTL_MS` | `30000` | opt-in terminal inflight job 보존 시간 |
| `OPENAI_API_KEY` | — | 지원되는 보조 경로용 API 키 |

---

## 아키텍처

```text
ima2 serve
  ├── Express server (:3333)
  │   ├── routes/ 라우트 모듈
  │   ├── lib/oauthProxy.js OAuth 이미지 호출
  │   ├── generated/ 이미지 + sidecar JSON
  │   ├── better-sqlite3 기반 세션 DB
  │   └── ui/dist React 앱
  ├── openai-oauth proxy (:10531)
  └── ~/.ima2/server.json CLI 자동 발견
```

---

## 개발

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev
npm test
npm run build
```

`npm run dev`는 `VITE_IMA2_DEV=1`로 UI를 빌드하고 `server.js`를 `--watch`로 실행합니다. 노드 모드는 이 dev build에서 표시됩니다.

현재 테스트는 CLI, config, history delete/restore/pagination, reference validation, OAuth parameter normalization, prompt fidelity, inflight tracking, safe logging, route health checks를 포함합니다.

---

## 문제 해결

**`ima2 ping`이 서버에 연결하지 못함**
`ima2 serve`를 실행하고 `~/.ima2/server.json`을 확인하세요. `ima2 ping --server http://localhost:3333`으로 직접 지정할 수 있습니다.

**OAuth 로그인이 안 됨**
`npx @openai/codex login` 실행 후 `ima2 status`를 확인하고 `ima2 serve`를 재시작하세요.

**`APIKEY_DISABLED`로 이미지 생성 실패**
현재 릴리스에서 API key provider로 생성하려고 해서 그렇습니다. 생성은 OAuth를 사용하세요.

**API 키를 설정했는데도 생성은 OAuth로 동작함**
정상입니다. API 키는 현재 보조 status/extraction 경로용이고, 이미지 생성용은 아닙니다.

**포트가 갑자기 `3457`로 뜸**
셸에 다른 도구에서 상속된 `PORT=3457`이 있을 수 있습니다. `unset PORT` 하거나 `IMA2_PORT=3333 ima2 serve`로 실행하세요.

---

## 최근 변경 요약

- 노드별 레퍼런스와 branch duplication
- 계정/테마 설정 워크스페이스
- Prompt fidelity와 revised prompt capture
- OAuth quality `low`, `medium`, `high` 유지
- 안전한 구조화 로그와 terminal inflight debug snapshot
- 세션 제목 기반 갤러리 그룹
- Windows spawn 관련 CLI 수정

## 라이선스

MIT
