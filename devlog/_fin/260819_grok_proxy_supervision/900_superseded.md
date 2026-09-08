---
created: 2026-09-09
updated: 2026-09-09
tags: [ima2-gen, devlog, grok, progrok, superseded]
---

# 900 — 이 유닛은 260909_grok_native_oauth 로 대체되었다

이 유닛이 설계한 WP2(슈퍼바이저 상태 기계와 로그인 재기동), WP3(advertise 활성
게이트), WP4(레인 상태와 슈퍼바이저 상태 동기화)는 2026-08-19 커밋 054c729f
("fix(grok): make GUI login revive the progrok proxy without a server restart")로
전부 구현되어 배포되었다. `devlog/_plan/README.md`에 오래 남아 있던 "구현 미착수"
표기는 오기였다.

2026-09-09의 `260909_grok_native_oauth` 유닛은 그 구현물을 통째로 걷어냈다.
progrok 자식 프로세스 자체가 사라지고 grok 레인이 `~/.progrok/auth.json`의 xAI OAuth
세션으로 `api.x.ai`를 직접 호출하므로, 여기서 다룬 감독·재기동·프로브 문제는 더 이상
존재하지 않는다. 이 문서들은 당시의 결함 분석과 설계 근거로만 남긴다.
