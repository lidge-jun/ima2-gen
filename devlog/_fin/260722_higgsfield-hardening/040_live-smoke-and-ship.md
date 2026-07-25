# 040 — 라이브 스모크 + 최종 게이트 + push (WP-4)

전제: higgsfield state=connected (OAuth 완료), 무제한(24h) 창 활성.

## 040-A: 선행 diff 커밋 확인
WP-1 시작 전에 커밋했어야 할 260721 언락 diff(adapter/registry/tests/probe 스크립트)가
dev에 적재되었는지 `git log` 로 재확인. 미적재면 여기서 적재.

## 040-B: 라이브 생성 스모크 (잡 예산: goal 상한 8건 중 ≤4건 사용)
라우트는 `routes/mcpMedia.ts`의 기존 생성 API를 사용 (신규 코드 없음 — 검증만):
1. 이미지: provider=higgsfield, model 기본값(soul_2), 간단 프롬프트 1건 →
   202 접수, SSE done, 산출 파일 경로 존재 확인.
2. 비디오: model 기본값(cinematic_studio_3_0) 1건 → done + 파일 존재.
3. 실패-경로 증거(선택): 오류 응답이 typed error code만 노출하고 서명 URL/토큰이 없는지 확인.
증거 기록: 요청/응답 코드, jobs.log 라인(taskId·sanitizedUrl), 산출 경로. goalplan CR-LIVE에 캡처.

## 040-C: 최종 게이트 (전량)
`npm run typecheck` / `npm run typecheck:tests` / `npm test` / `npm run test:inventory` /
`cd ui && npm run build`. 모두 green이어야 D 진입.

## 040-D: push
사용자 사전 승인("푸시해봐") 범위 내: `git push origin dev` 1회. 다른 브랜치/태그/publish 금지.
push 후 원격 SHA를 CR-PUSH 증거로 기록.

## 산출 devlog
각 WP 종료 시 `devlog/_plan/260722_higgsfield-hardening/` 아래 `0x1-…-result.md` 유닛 기록
(변경 diff 요약 + 검증 출력 + 리뷰어 판정). 플랜 완료 시 규약에 따라 `_fin/` 이동은 후속 세션 재량.
