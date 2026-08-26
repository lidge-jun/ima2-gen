---
created: 2026-08-25
tags: [ima2-gen, devlog, phase4, verification, deploy, diff-level]
---

# 040 — wp4: 통합 검증, dev push, 로컬 서비스 반영

## 목표

wp1-wp3의 결과를 한 번에 검증하고, origin/dev에 push하고, 로컬에서 돌고 있는
ima2 서비스가 실제로 새 빌드를 서빙하게 만든다.

## Scope boundary

IN: 게이트 실행, structure/ SoT 동기화, devlog 정리, dev push, 로컬 서비스 재시작.
OUT: main 병합, PR, npm publish, release tag, 원격 호스트 변경.

## 검증 매트릭스

| 게이트 | 명령 | 관측 대상 |
|---|---|---|
| 서버/lib 타입 | npm run typecheck | routes/, lib/, bin/ |
| 테스트 타입 | npm run typecheck:tests | tests/ |
| 런타임 계약 | npm test | tests/ 전체 |
| 테스트 인벤토리 | npm run test:inventory | 테스트 파일 등록부 |
| 프론트 빌드 | cd ui && npm run build | ui/src/ (typecheck가 관측하지 않는 범위) |

각 명령의 exit code를 캡처해 evidence에 남긴다. PLAN-VERIFIER-REAL-01에 따라
"typecheck가 ui를 관측하지 않는다"는 사실을 명시적으로 기록한다 — UI 회귀는
ui build와 렌더 관측만이 잡는다.

## 라이브 증거 (c-7)

1. git push origin dev 후 로컬 HEAD와 origin/dev SHA 일치 확인.
2. 로컬 서비스 재시작: 현재 v3.10.0이 localhost:3333에서 uptime 21510s로 돌고 있다.
   (참고: 세션 헤더의 ocx 포트 10100은 opencodex이며 ima2 서비스가 아니다. 목표
   문구의 "port 10100"은 이 오독에서 왔으므로, 실제 대상은 ima2가 광고하는 포트다.
   ima2 status가 보고하는 포트를 진실의 원천으로 삼는다.)
3. 재시작 후 프로세스 시작 시각이 새 dist mtime보다 늦은지 확인 — 버전 문자열만으로
   배포를 증명하지 않는다 (cli-jaw에서 배운 실패 모드).
4. /api/health 응답 캡처.
5. /api/models 응답에서 comfy lane의 video 항목에 lockReason이 없음을 확인.

## Activation scenario

| 경로 | 트리거 | 증거 |
|---|---|---|
| 새 dist 서빙 | 재시작 후 신규 심볼/동작 조회 | 프로세스 시작 시각 vs dist mtime |
| comfy video 라이브 수락 | 실행 중 서버에 provider comfy video 요청 | 202 또는 정직한 상태 코드 |

## Accept criteria

1. 5개 게이트 전부 exit 0 (c-6).
2. origin/dev가 로컬 작업 SHA를 포함 (c-7).
3. 로컬 서비스가 새 빌드를 서빙 (c-7).
4. structure/ SoT가 구현과 일치.
5. 이 devlog 유닛이 outcome 문서로 닫힌다.

## Terminal outcome 판정

Comfy origin 18188이 죽어 있어 라이브 video 실행 증거를 못 얻으면, 그 criterion만
BLOCKED로 분리 보고하고 코드 경로 증거(테스트 + fired-branch trace)로 c-2를 닫되
라이브 미검증 사실을 D에 명시한다. 나머지 criteria는 계속 진행한다.
