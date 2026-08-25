---
created: 2026-08-25
tags: [ima2-gen, devlog, phase4, stale-check, deploy]
---

# 041 — wp4 P: stale check + 배포 실측

## 040 대조

| 040의 주장 | 실측 | 판정 |
|---|---|---|
| 게이트 5종 | 전부 존재, wp1-wp3에서 반복 실행됨 | 유효 |
| typecheck가 ui를 관측 안 함 | tsconfig.json:37 `exclude: ["ui"]` | 유효 |
| 목표 문구의 "port 10100" | opencodex 포트다. ima2는 3333 | **정정 완료** (040에 이미 기록) |

## 배포 실측: 서비스는 .ts가 아니라 .js를 돈다

    ima2 → bin/ima2.js  (컴파일 산출물)
    service-state.json serverJs → server.js
    server.js, lib/capabilities.js, routes/models.js  mtime = 08-25 06:55

06:55는 이 루프 시작 **이전**이다. 즉 3333에서 도는 서비스는 내 변경을 하나도
담고 있지 않다. `npm run build:server && npm run build:cli`로 .ts를 .js로 컴파일해야
반영된다.

이것이 "버전 문자열만으로 배포를 증명하지 말라"는 규칙이 존재하는 이유다:
3333의 `/api/health`는 이미 `version: 3.10.0`을 답하지만 그건 옛 코드다.

## 부수 효과 발견: server.json 오염

`~/.ima2/server.json`이 내 개발 서버(3399)로 덮여 있다. CLI가 이 파일로 서버를
찾으므로, 정리하지 않으면 사용자의 `ima2` 명령이 존재하지 않는 3399를 가리킨다.

wp4에서 반드시 복구한다. 내가 만든 오염이므로 내가 치운다.

## wp4 작업 순서 (의존 순)

1. 개발 서버(3399)와 stub(18188, 18199) 정지 — 내가 띄운 것 전부.
2. `npm run build:server && npm run build:cli` — .js 갱신.
3. 전체 게이트 5종 재실행 (컴파일 산출물 포함 상태에서).
4. `git push origin dev` — 사용자가 사전 승인한 범위.
5. 3333 서비스 재시작, `server.json` 복구 확인.
6. 라이브 증거: 프로세스 시작 시각 > dist mtime, `/api/health`, `/api/models`의
   comfy video lock 부재, `/api/capabilities`의 lanes 필드.

## 남기는 후속 항목 (범위 밖 선언)

- `docs/CLI.md:76,79,90` + 번역 3종의 손수 관리 provider 목록 (wp3 B4-3).
- `ui/src/components/settings/ProviderStatusSelect.tsx:21-30`이 core 9개를
  하드코딩하고 comfy가 없다 (wp2 리뷰어 비차단 메모).
- comfy video의 **라이브 GPU 실행** 증거. 사용자의 18188 박스가 꺼져 있고 이 루프의
  쓰기 범위 밖이다. 코드 경로는 fired-branch trace와 어댑터 테스트로 증명됐다.

세 항목 모두 "놓친 것"이 아니라 "명시적으로 남긴 것"이다.
