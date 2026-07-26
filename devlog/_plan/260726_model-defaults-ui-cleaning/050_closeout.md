# WP5 - 전체 검증·GitHub closeout

## stale check

WP1~WP4의 D 기록과 실제 git diff를 대조한다. 남은 production 변경이나 unmet
criterion이 있으면 이 WP를 닫지 않고 해당 소유 WP 문서를 고쳐 재진입한다.

## 로컬 게이트

```bash
npm run typecheck
npm run typecheck:tests
npm run test:inventory
npm test
cd ui && npm run build
cd .. && npm run audit:gate
npm --prefix site run check
npm --prefix site run build
node scripts/check-devlog-citations.mjs
npm run docs:refresh-line-counts
git diff --check
```

## 렌더

- `node bin/ima2.js serve`, `http://127.0.0.1:3333`.
- browser `domcontentloaded`, SSE 때문에 `networkidle` 금지.
- 1440, 1024, 768, 390, 320 viewport.
- Home history 0, Settings Grok dropdown, Agent model picker, Prompt Builder model
  picker, element mention menu를 inspect -> act -> re-inspect.
- screenshot은 `devlog/_plan/260726_model-defaults-ui-cleaning/evidence/`에 저장하고 읽는다.

## GitHub

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/dev
gh issue list --state open --limit 100 --json number,title,url
gh pr list --state open --limit 100 --json number,title,url
git push origin dev
gh run list --branch dev --limit 3 --json databaseId,status,conclusion,headSha,url
```

- push는 사용자가 이 세션에서 명시 승인했다.
- force-push, tag, release는 하지 않는다.
- 최신 HEAD CI가 실패하면 로그를 읽고 같은 HEAD 기준 green loop를 돈다.
- issue/PR은 실제 open이 생긴 경우만 내용·중복·코드 상태를 읽고 정리한다.
  숫자 맞추기용 close는 금지한다.

## archive

- 모든 criterion에 fresh `capturedEvidence`를 기록.
- `devlog/_plan/README.md`, `structure/07-devlog-map.md` 갱신.
- 이 폴더를 `devlog/_fin/260726_model-defaults-ui-cleaning/`으로 이동.
- goalplan validate 후 D->IDLE, host goal complete.
