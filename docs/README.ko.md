# ima2-gen

[![npm version](https://img.shields.io/npm/v/ima2-gen)](https://www.npmjs.com/package/ima2-gen)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../LICENSE)

> **다른 언어로 읽기**: [English](../README.md) · [日本語](README.ja.md) · [简体中文](README.zh-CN.md)

OpenAI **GPT Image 2** (`gpt-image-2`) 이미지 생성을 위한 미니멀 CLI + 웹 UI. OAuth(ChatGPT Plus/Pro 통한 무료) 또는 API 키 사용. 병렬 생성, 다중 레퍼런스 이미지, CLI 자동화, 히스토리 영속화 지원.

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

스크린샷에 나온 모든 기능이 지금 바로 작동합니다.

### 인증
- **OAuth** — ChatGPT Plus/Pro 계정 로그인, 이미지당 $0
- **API Key** — `sk-...` 키 붙여넣기, 호출당 과금

좌측 패널에 실시간 표시 (초록 점 = 준비됨, 빨간 점 = 비활성화). API 키는 기본적으로 비활성화되어 있고 OAuth가 주경로입니다.

### 생성 옵션
| 항목 | 선택지 |
|------|--------|
| **Quality** | Low(빠름) · Medium(균형) · High(최고) |
| **Size** | `1024²` `1536×1024` `1024×1536` `1360×1024` `1024×1360` `1824×1024` `1024×1824` `2048²` `2048×1152` `1152×2048` `3824×2160` `2160×3824` · `auto` · custom |
| **Format** | PNG · JPEG · WebP |
| **Moderation** | Auto(표준 필터) · Low(완화 필터) |
| **Count** | 1 · 2 · 4 병렬 |

모든 크기는 gpt-image-2 제약 조건 준수: 각 변이 16의 배수, 장단변비 ≤ 3:1, 총 픽셀 655,360–8,294,400.

### 워크플로
- **멀티 레퍼런스** — 최대 5장의 레퍼런스 이미지 첨부, 좌측 패널 어디든 드래그 & 드롭
- **프롬프트+컨텍스트** — 텍스트와 레퍼런스 이미지를 한 요청에 혼합
- **Use current** — 선택된 이미지를 새 레퍼런스로 원클릭 재사용
- 캔버스에서 바로 **Download** · **Copy to clipboard** · **Copy prompt**
- 하단 **고정 갤러리 스트립** — 절대 스크롤되지 않는 위치 고정
- **갤러리 모달 (+)** — 히스토리 전체를 그리드로 보기
- **세션 영속성** — 생성 중 새로고침해도 pending 작업이 자동 복구

### CLI (헤드리스 자동화)
```bash
ima2 gen "a shiba in space" -q high -o shiba.png
ima2 gen "merge these" --ref a.png --ref b.png -n 4 -d out/
ima2 ls -n 10
ima2 ps
ima2 ping
```

전체 명령 매트릭스는 아래 ↓

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

실행 중인 서버는 `~/.ima2/server.json`에 자신을 광고합니다. 클라이언트는 자동 발견; `--server <url>` 또는 `IMA2_SERVER=...`로 재정의.

### 종료 코드
`0` 성공 · `2` 잘못된 인자 · `3` 서버 도달 불가 · `4` APIKEY_DISABLED · `5` 4xx · `6` 5xx · `7` 안전 거부 · `8` 타임아웃.

---

## 로드맵

공개 로드맵 — 변경될 수 있음. 버전 번호는 실제 출시 사이클을 반영합니다.

### ✅ 출시 완료
- **0.06** 세션 DB — SQLite 기반 히스토리 + 사이드카 JSON
- **0.07** 멀티 레퍼런스 — 최대 5장, i2i를 통합 플로우로 병합
- **0.08** Inflight 추적 — 새로고침 안전 pending 상태, 단계 추적
- **0.09** 노드 모드 (개발 전용) — 분기 생성용 그래프 기반 캔버스
- **0.09.1** CLI 통합 — `gen / edit / ls / show / ps / ping` + `/api/health` + 포트 광고

### 🚧 0.10 — Compare & Reuse (현재 사이클)
- **F3 프롬프트 프리셋** — `{prompt, refs, quality, size}` 번들 저장/적용
- **F3 갤러리 groupBy** — `preset / date / compareRun` 그룹핑
- **F2 배치 A/B 비교** — 하나의 프롬프트에서 2~6개 병렬 변형 생성, 키보드 판정 (`1-6`, `Space`=승자, `V`=변형, `P`=프리셋 저장)
- **F4 Export 번들** — 선택 이미지 zip (`manifest.json` + 이미지별 프롬프트 `.txt`)
- 모든 서버 동사에 CLI 미러 동봉 (`ima2 preset / compare / export`)

### 🔭 0.11 — 카드뉴스 모드
- 인스타그램 캐러셀 생성 (4 / 6 / 10 장)
- `file_id` 팬아웃 기반 스타일 일관성 (`previous_response_id`, seed 사용 안 함)
- 스타일 체인을 깨지 않는 카드 병렬 재생성

### 🔭 0.12 — 스타일 킷
- 스타일 레퍼런스 업로드로 하우스 스타일 프리셋 정립
- 정체성 중요 편집을 위한 선택적 `input_fidelity: "high"`

### 🗂 백로그
- 웹 UI 다크/라이트 토글
- 키보드 단축키 치트시트 오버레이
- 협업 세션 (WebSocket으로 SQLite 공유)
- 커스텀 후처리용 플러그인 시스템

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

**노드 모드**는 개발 전용 (`npm run dev`)이며, 세션 DB + 멀티 유저 설계가 완료될 때까지 npm 배포에서 차단됩니다.

---

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `OPENAI_API_KEY` | — | OpenAI API 키 (OAuth 건너뜀) |
| `PORT` | `3333` | 웹 서버 포트 |
| `OAUTH_PORT` | `10531` | OAuth 프록시 포트 |
| `IMA2_SERVER` | — | 클라이언트: 대상 서버 URL 재정의 |

---

## API 가격 (API 키 모드만)

| Quality | 1024×1024 | 1024×1536 | 1536×1024 | 2048×2048 | 3840×2160 |
|---------|-----------|-----------|-----------|-----------|-----------|
| Low     | $0.006    | $0.005    | $0.005    | $0.012    | $0.023    |
| Medium  | $0.053    | $0.041    | $0.041    | $0.106    | $0.200    |
| High    | $0.211    | $0.165    | $0.165    | $0.422    | $0.800    |

**OAuth 모드는 무료** — 기존 ChatGPT Plus/Pro 구독에서 청구됩니다.

---

## 개발

```bash
git clone https://github.com/lidge-jun/ima2-gen.git
cd ima2-gen
npm install
npm run dev    # --watch + 노드 모드 활성화
npm test       # 51+ 테스트
```

---

## 문제 해결

**포트가 이미 사용 중 / "왜 3457에 떴지?"**
→ 기본값은 `3333`. 쉘에 `PORT`가 설정되어 있으면 (예: `cli-jaw` 같은 다른 서버에서 상속) 그 값을 사용합니다. 해제하거나 `PORT=3333 ima2 serve`로 실행하세요.

**`ima2 ping`이 서버 도달 불가**
→ `ima2 serve`가 실행 중인가요? `~/.ima2/server.json` 확인. `ima2 ping --server http://localhost:3333`로 재정의.

**OAuth 로그인 안 됨**
→ `npx @openai/codex login`을 수동 실행 후 `ima2 serve`.

**이미지 생성 안 됨**
→ `ima2 status`로 설정 확인. API 키는 `sk-`로 시작해야 합니다.

---

## 라이선스

MIT
