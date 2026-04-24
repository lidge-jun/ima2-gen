# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **다른 언어로 읽기**: [English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenAI의 **GPT Image 2** (`gpt-image-2`) 기반 이미지 생성을 위한 미니멀 CLI 및 웹 UI입니다. OAuth(ChatGPT Plus/Pro를 통한 무료 이용) 또는 API 키 인증을 지원합니다. 주요 기능으로 병렬 생성, 다중 레퍼런스 이미지 첨부, CLI 자동화, 그리고 히스토리 영구 저장 등을 제공합니다.

![ima2-gen 스크린샷](../assets/screenshot.png)

---

## 빠른 시작

```bash
# 설치 없이 바로 실행
npx ima2-gen serve

# 또는 전역 설치
npm install -g ima2-gen
ima2 serve
```

첫 실행 시 인증 방식을 선택합니다:

```
  인증 방식을 선택하세요:
    1) API Key  — OpenAI API 키 붙여넣기 (유료)
    2) OAuth    — ChatGPT 계정으로 로그인 (무료)
```

웹 UI는 `http://localhost:3333` 에서 열립니다.

---

## 기능

위 스크린샷에 포함된 모든 기능은 현재 사용 가능합니다:

### 인증
- **OAuth** — ChatGPT Plus/Pro 계정 로그인, 이미지당 $0
- **API Key** — `sk-...` 키 붙여넣기, 호출당 과금

인증 상태는 좌측 패널에 실시간으로 표시됩니다(초록색 점 = 준비됨, 빨간색 점 = 비활성화). 기본적으로 API 키 방식은 비활성화되어 있으며, OAuth가 주요 인증 경로로 사용됩니다.

### 생성 옵션
| 항목 | 선택지 |
|------|--------|
| **Quality** | Low (빠름) · Medium (균형) · High (최고 품질) |
| **Size** | `1024²` `1536×1024` `1024×1536` `1360×1024` `1024×1360` `1824×1024` `1024×1824` `2048²` `2048×1152` `1152×2048` `3824×2160` `2160×3824` · `auto` · custom |
| **Format** | PNG · JPEG · WebP |
| **Moderation** | Low (느슨한 필터, 기본값) · Auto (표준 필터) |
| **Count** | 1 · 2 · 4 병렬 |

모든 크기는 `gpt-image-2`의 제약 조건을 준수합니다: 각 변은 16의 배수여야 하며, 장단변 비율은 3:1 이하, 총 픽셀 수는 655,360에서 8,294,400 사이여야 합니다.

### 워크플로
- **멀티 레퍼런스**: 최대 5장의 레퍼런스 이미지를 지원하며, 좌측 패널 어디에나 드래그 앤 드롭으로 첨부할 수 있습니다.
- **프롬프트와 컨텍스트**: 텍스트 프롬프트와 레퍼런스 이미지를 단일 요청에 함께 혼합하여 사용할 수 있습니다.
- **Use current**: 한 번의 클릭으로 선택된 이미지를 새로운 레퍼런스로 재사용합니다.
- **캔버스 액션**: 캔버스 화면에서 바로 **Download**, **Copy to clipboard**, **Copy prompt** 액션을 실행할 수 있습니다.
- **하단 고정 갤러리 스트립**: 스크롤해도 화면 아래에 고정되어 항상 접근 가능한 갤러리 스트립을 제공합니다.
- **갤러리 모달 (+)**: 생성 히스토리 전체를 그리드 뷰로 한눈에 확인할 수 있습니다.
- **세션 영속성**: 생성 중 페이지를 새로고침하더라도 대기 중인(pending) 작업 내역이 안전하게 자동 복구됩니다.

### CLI (헤드리스 자동화)
```bash
ima2 gen "a shiba in space" -q high -o shiba.png
ima2 gen "merge these" --ref a.png --ref b.png -n 4 -d out/
ima2 ls -n 10
ima2 ps
ima2 ping
```

전체 명령 매트릭스는 아래를 참조하세요.

---

## CLI 명령

### 서버 명령
| 명령 | 별칭 | 설명 |
|------|------|------|
| `ima2 serve` | — | 웹 서버 시작 (첫 실행 시 자동 설정) |
| `ima2 setup` | `login` | 인증 방식 재설정 |
| `ima2 status` | — | 현재 설정과 인증 상태 표시 |
| `ima2 doctor` | — | 환경과 의존성 진단 |
| `ima2 open` | — | 브라우저에서 웹 UI 열기 |
| `ima2 reset` | — | 저장된 설정 삭제 |
| `ima2 --version` | `-v` | 버전 표시 |
| `ima2 --help` | `-h` | 도움말 |

### 클라이언트 명령 (`ima2 serve` 실행 필요)
| 명령 | 설명 |
|------|------|
| `ima2 gen <prompt>` | CLI에서 이미지 생성 |
| `ima2 edit <file>` | 기존 이미지 편집 (`--prompt` 필수) |
| `ima2 ls` | 최근 히스토리 (테이블 또는 `--json`) |
| `ima2 show <name>` | 히스토리 항목 공개 (`--reveal`) |
| `ima2 ps` | 진행 중인 작업 목록 (`--kind`, `--session`) |
| `ima2 ping` | 실행 중인 서버 헬스체크 |

실행 중인 서버는 `~/.ima2/server.json`을 통해 포트 정보를 알립니다. 클라이언트는 이를 자동으로 발견하며, `--server <url>` 파라미터나 `IMA2_SERVER=...` 환경 변수로 대상 URL을 재정의할 수 있습니다.

### 종료 코드
`0` 정상 · `2` 잘못된 인수 · `3` 서버 연결 불가 · `4` APIKEY_DISABLED · `5` 4xx 에러 · `6` 5xx 에러 · `7` 정책 위반 거부 · `8` 타임아웃.

---

## 로드맵

공개 로드맵 (변경될 수 있음). 버전 번호는 소요 시간이 아닌 실제 배포 주기를 반영합니다.

### ✅ 출시 완료
- **0.06** 세션 DB — SQLite 기반 히스토리 및 사이드카 JSON
- **0.07** 멀티 레퍼런스 — 최대 5장 지원, i2i를 통합 플로우에 병합
- **0.08** 진행 상태(Inflight) 추적 — 새로고침에 안전한 Pending 상태 유지 및 단계별 추적
- **0.09** 노드 모드 (개발 전용) — 분기별 생성을 위한 그래프 기반 캔버스
- **0.09.1** CLI 통합 — `gen`, `edit`, `ls`, `show`, `ps`, `ping` 명령어 및 `/api/health` API, 포트 자동 알림 기능

### 🚧 0.10 — Compare & Reuse (현재 개발 사이클)
- **F3 프롬프트 프리셋** — `{prompt, refs, quality, size}` 묶음을 저장하고 적용
- **F3 갤러리 groupBy** — `preset`, `date`, `compareRun` 기준으로 묶어보기
- **F2 배치 A/B 비교** — 단일 프롬프트에서 2~6개의 변형을 병렬로 생성 후 키보드로 빠르게 판정 (`1-6`, `Space` = 승자 선택, `V` = 변형 보기, `P` = 프리셋 저장)
- **F4 Export 번들** — 선택한 이미지를 `manifest.json` 및 개별 프롬프트 `.txt` 파일과 함께 압축(zip) 내보내기
- 모든 서버 동작에 대응하는 CLI 명령어 제공 (`ima2 preset / compare / export`)

### 🔭 0.11 — 카드뉴스 모드
- 인스타그램 캐러셀 형태의 연속 이미지 생성 (4, 6, 10장)
- `file_id` 팬아웃(fan-out)을 활용한 스타일 일관성 유지 (`previous_response_id`나 seed를 사용하지 않음)
- 스타일 체인을 유지하면서 특정 카드를 병렬로 재생성

### 🔭 0.12 — 스타일 킷
- 스타일 레퍼런스 이미지를 업로드하여 하우스 스타일 프리셋 구축
- 정체성 유지가 중요한 편집 작업을 위한 `input_fidelity: "high"` 옵션

### 🗂 백로그 (대기 중인 작업)
- 웹 UI 다크/라이트 모드 토글
- 키보드 단축키 안내(치트시트) 오버레이
- 협업 세션 기능 (WebSocket을 통한 SQLite 공유)
- 커스텀 이미지 후처리를 위한 플러그인 시스템

---

## 아키텍처

```
ima2 serve
  ├── Express 서버 (:3333)
  │   ├── GET  /api/health         — version, uptime, activeJobs, pid
  │   ├── GET  /api/providers      — 사용 가능한 인증 방식
  │   ├── GET  /api/oauth/status   — OAuth 프록시 헬스체크
  │   ├── POST /api/generate       — text+ref → image (n 병렬)
  │   ├── POST /api/edit           — 레퍼런스 중심 편집 경로
  │   ├── GET  /api/history        — 페이지네이션 사이드카 리스트
  │   ├── GET  /api/inflight       — 진행 중 작업 (kind/session 필터)
  │   ├── GET  /api/sessions/*     — 노드 그래프 세션 (개발 전용)
  │   ├── GET  /api/billing        — API 크레딧 / 비용
  │   └── 정적 파일 (public/)      — 웹 UI
  │
  ├── openai-oauth 프록시 (:10531) — 임베디드 OAuth 릴레이
  └── ~/.ima2/server.json          — CLI 자동 발견용 포트 광고
```

**노드 모드**는 개발 전용(`npm run dev`) 기능으로, 세션 DB와 다중 사용자 아키텍처가 완전히 구현될 때까지 npm 배포판에는 포함되지 않습니다.

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OPENAI_API_KEY` | — | OpenAI API 키 (OAuth 건너뜀) |
| `PORT` | `3333` | 웹 서버 포트 |
| `OAUTH_PORT` | `10531` | OAuth 프록시 포트 |
| `IMA2_SERVER` | — | 클라이언트: 대상 서버 URL 재정의 |

---

## API 사용 요금 (API 키 모드 전용)

| Quality | 1024×1024 | 1024×1536 | 1536×1024 | 2048×2048 | 3840×2160 |
|---------|-----------|-----------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    | $0.012    | $0.023    |
| Medium  | $0.053    | $0.041    | $0.041    | $0.106    | $0.200    |
| High    | $0.211    | $0.165    | $0.165    | $0.422    | $0.800    |

**OAuth 모드는 추가 요금 없이 무료입니다** — 기존 구독 중인 ChatGPT Plus/Pro 플랜의 한도를 사용합니다.

---

## 개발

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev    # 서버 실행 (--watch 및 노드 모드 활성화)
npm test       # 92개 이상의 테스트 (헬스 체크, CLI, 명령어, 서버 기능 검증)
```

프론트엔드 스택:
- Vite + React 기반 웹 UI 및 노드 모드 캔버스
- Zustand 기반 UI/세션 상태 관리
- 폰트: Outfit, Geist Mono

---

## 문제 해결

**포트가 이미 사용 중 / "왜 3457 포트로 실행되나요?"**
→ 기본 포트는 `3333`입니다. 만약 셸에 `PORT` 환경 변수가 설정되어 있다면(예: `cli-jaw` 등 다른 프로세스에서 상속받은 경우) 해당 포트를 사용합니다. 이를 해제하거나 `PORT=3333 ima2 serve` 명령어로 실행해 주세요.

**`ima2 ping` 명령 시 서버에 도달할 수 없음**
→ `ima2 serve` 명령어로 서버가 실행 중인지 확인하세요. `~/.ima2/server.json` 파일을 확인하거나, `ima2 ping --server http://localhost:3333`을 통해 대상 서버를 직접 지정해 보세요.

**OAuth 로그인이 작동하지 않음**
→ 먼저 `npx @openai/codex login`을 수동으로 실행하여 로그인한 뒤, `ima2 serve`를 다시 실행해 보세요.

**이미지가 생성되지 않음**
→ `ima2 status` 명령어로 현재 설정을 점검해 보세요. API 키 방식을 사용 중이라면 키가 `sk-`로 시작하는지 확인해야 합니다.

---

## 라이선스

MIT
