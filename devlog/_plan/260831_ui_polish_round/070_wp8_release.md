---
created: 2026-08-31
tags: [ima2-gen, devlog, release]
---

# 070 — wp8: 릴리스

## 전제

시작 시점 기준 `origin/main` = `origin/dev` = `79ca516e`, 열린 PR 0건,
버전 3.12.1, npm latest 3.12.1, `assertBaseline` problems `[]`.

## 순서

1. 각 구현 사이클은 자기 브랜치에서 PR로 올리고, 리뷰 후 `dev`에 머지합니다.
   의존 사슬이라 스택 PR로 쌓되, PR CI는 `main`/`dev` 타깃에서만 돌기
   때문에 형제 브랜치를 타깃하면 CI가 안 붙습니다. 각 PR을 `dev`로 향하게
   하고 앞 PR이 머지된 뒤 `update-branch`로 올립니다.
2. 전부 머지된 뒤 `main`을 fast-forward로 올립니다. `dev`가 앞서 있는
   상태에서 `main`에 직접 머지하면 릴리스 preflight가 깨집니다.
3. `scripts/release-cut.mjs`의 `assertBaseline`으로 세 조건을 확인합니다:
   `origin/main`이 체크아웃과 같고, `dev`를 포함하고, `preview`를 포함.
4. 버전을 올립니다: **3.12.2 (patch)**. 감사 지적대로 "사용자에게 보이는 버그
   수정이니 minor"는 근거가 아닙니다. 공개 기능이 늘지 않았고 릴리스 워크플로
   기본값도 patch입니다.
5. `release.yml`을 dispatch합니다. cut 잡이 preflight를 걸고, 버전 커밋을
   만들고, `main`을 밀고, 그 SHA를 `preview`로 승격하고, preview 채널로
   `publish.yml`을 dispatch하고, npm preview 증거를 요구합니다. 그 다음 tag
   잡이 증거를 재확인하고 stable 태그를 만들어 `main`/`dev`/태그를 원자적으로
   밉니다.
6. 설치 증거: 발행된 버전을 실제로 받아 `npm view ima2-gen version`과 설치된
   패키지에서 확인합니다.

## 게이트

머지 전 각 PR에서: PR fast gate, CodeQL. 릴리스 전 로컬에서:
`npm run verify:release:source` 체인 전체(native deps, 두 typecheck, inventory,
UI 빌드, server/cli 빌드, provider registry, 전체 스위트, lint:pkg,
install policy, audit gate).

## 완료 조건

3.12.2가 npm에 올라가고, `main`/`dev`/태그가 한 SHA를 공유하고, 설치한
패키지에서 버전이 확인되고, 열린 PR이 0건.
