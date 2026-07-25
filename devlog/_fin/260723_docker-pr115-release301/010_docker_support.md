# 010 WP1 — Docker 배포 지원 (#114)

## Design

멀티스테이지 Dockerfile: builder에서 소스 빌드(ui + server + cli), runtime에서
prod 의존성만 설치해 슬림하게. npm 글로벌 설치 방식 대신 소스 빌드 방식을 쓰는
이유: dev HEAD 그대로 배포 가능 + 이미지 태그가 리포 태그를 따라감.

런타임 계약 (config.ts + 감사 반영, blocker #1/#2 fold):
- 포트: `IMA2_PORT` (기본 3333) → `EXPOSE 3333`
- 상태: `IMA2_CONFIG_DIR=/data`, `VOLUME /data` (generated도 /data 하위 — 별도 env 불필요)
- **바인드/보안 (blocker #1):** 기본 host 127.0.0.1(config.ts:74). 컨테이너 외부
  접근에는 `IMA2_HOST=0.0.0.0` + **`IMA2_LAN_TOKEN` 필수** — non-loopback에서
  토큰 없으면 server.ts:174가 throw. Dockerfile ENV로 0.0.0.0을 기본 설정하되
  LAN_TOKEN은 사용자가 반드시 주입(compose 예시에 명시, 없으면 기동 실패가 의도).
- **비대화형 기동 (blocker #1):** 빈 /data에서 `ima2 serve`는 대화형 setup()으로
  진입(bin/ima2.ts:77,206) → CMD는 `node server.js` 직접 실행으로 우회.
- native deps: better-sqlite3, sharp — node:22-bookworm-slim(glibc) 프리빌트 동작.
  alpine(musl) 회피.

## File map (NEW)

- `Dockerfile` — 멀티스테이지:
  - `FROM node:22-bookworm-slim AS build`: `COPY . .` → `npm ci` →
    `npm --prefix ui ci` → `npm run ui:build && npm run build:server && npm run build:cli`
  - `FROM node:22-bookworm-slim`: `COPY --from=build` — **package.json files[]와
    parity (blocker #2):** bin/ lib/ routes/ `server.js` **`config.js`** ui/dist/
    vendor/ assets/ skills/ integrations/ + package.json + package-lock.json →
    `npm ci --omit=dev` → `ENV IMA2_CONFIG_DIR=/data IMA2_HOST=0.0.0.0 NODE_ENV=production`
    → `EXPOSE 3333` → `CMD ["node","server.js"]`
- `.dockerignore` — node_modules, ui/node_modules, ui/dist, devlog, site,
  .git, .codexclaw, tests, *.log 등
- `docker-compose.yml` — 포트 3333, `ima2-data:/data` 볼륨, env 예시 주석
- `docs/DOCKER.md` — 빌드/실행/환경변수/볼륨/제한사항 (영어)
- `README.md` — Docker 섹션 1문단 + DOCKER.md 링크

## Accept criteria

- typecheck/기존 테스트 무영향 (코드 변경 없음, 파일 추가만)
- Dockerfile 구조 검증: COPY 목록 vs package.json files[] parity 체크 (스크립트/수동)
- 로컬 docker 데몬 부재 → build 실증은 불가. 문서와 이슈 답변에 명시하고
  피드백 요청. (한계 인정, C-RENDER 예외 사유 기록)
- 이슈 #114에 영어 답변(중국어 요약 병기 가능): 지원 커밋 링크 + 사용법 + 릴리스에 포함 예정

## Out of scope

- GHCR 이미지 자동 발행 CI (후속 이슈로 제안만)
