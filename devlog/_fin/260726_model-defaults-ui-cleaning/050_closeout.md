# WP5 - 전체 검증·GitHub closeout

## stale check

WP1~WP4의 D 기록과 실제 git diff를 대조한다. 남은 production 변경이나 unmet
criterion이 있으면 이 WP를 닫지 않고 해당 소유 WP 문서를 고쳐 재진입한다.

### 2026-07-26 WP5 P

- 현재 HEAD `d6f267f`, 기준선 `ff366ad`, origin/dev `ff366ad`이다.
- `ff366ad..HEAD`는 7개 commit, 110 files, +1791/-468이며 WP1~WP4의 모델,
  문서, UI, 테스트, devlog 변경만 포함한다.
- WP3 실행 기록은 `_fin/260726_zero-backlog-frontend-qa/031-032`,
  WP4 실행 기록은 `_fin/260726_model-defaults-ui-cleaning/041`에 있다.
- WP1/WP2는 커밋과 테스트는 있으나 같은 유닛 아래 실행 기록이 없다.
  closeout 전에 `010`/`020` 기준의 짧은 `_fin` 실행 기록을 추가한다.
- 현재 open issue 0, open PR 0이다. closeout 마지막에 같은 목록을 다시 읽는다.

## 로컬 게이트

```bash
npm run typecheck
npm run typecheck:tests
npm run build:server
npm run build:cli
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
# closeout devlog/evidence/structure 변경 커밋
git rev-parse HEAD
# 방금 커밋한 exact HEAD를 push
gh issue list --state open --limit 100 --json number,title,url
gh pr list --state open --limit 100 --json number,title,url
git push origin dev
git rev-parse HEAD
git rev-parse origin/dev
gh run list --branch dev --limit 3 --json databaseId,status,conclusion,headSha,url
```

- push는 사용자가 이 세션에서 명시 승인했다.
- force-push, tag, release는 하지 않는다.
- closeout 산출물은 push 전에 커밋하고, push와 CI 확인은 그 커밋 SHA 기준으로만
  기록한다.
- 최신 HEAD CI가 실패하면 로그를 읽고 같은 HEAD 기준 green loop를 돈다.
- issue/PR은 실제 open이 생긴 경우만 내용·중복·코드 상태를 읽고 정리한다.
  숫자 맞추기용 close는 금지한다.

## capturedEvidence

### 2026-07-26 WP5 B

- 첫 전체 게이트에서 `npm test`는 4개 회귀를 드러냈다. Agent planner prompt의
  4.5 기대값, PromptComposer 500라인 예산, mention chip props 계약, assetGen
  프레임 dictionary 누락을 고친 뒤 집중 테스트 32/32와 양쪽 typecheck를 다시
  통과했다.
- 최종 전체 테스트: `tests 2040`, `pass 2038`, `fail 0`, `skipped 2`.
  skipped 2개는 `IMA2_MCP_LIVE_SMOKE=1`와 비용 승인이 필요한 live provider
  smoke다.
- 통과한 나머지 게이트: `typecheck`, `typecheck:tests`, `build:server`,
  `build:cli`, `test:inventory`, UI production build, root/UI `audit:gate`,
  site `check`(0 errors, 24 hints), site build 20 pages, devlog citations,
  `docs:refresh-line-counts` no updates, `git diff --check`.
- 포트 3333은 이미 PID 85073이 점유하고 있어 프로세스를 종료하지 않고
  isolated config의 3345에서 렌더했다. `domcontentloaded`만 사용했고
  `networkidle`은 기다리지 않았다.
- Home history 0: 1440/1024/768/390/320 모두 `scrollWidth=clientWidth`,
  empty text와 `role=status` 유지, console error 0. 캡처는 `evidence/home-empty-*.png`.
- Settings image model menu: Luna/Terra/Sol/5.5/5.4/5.4 mini 뒤 Grok Imagine
  options, rect `x=275 y=556.28125 w=560 h=260`, overflow 0.
- Agent model picker: Luna/Terra/Sol 뒤 Grok 4.5와 4.3, rect
  `x=257.3125 y=56 w=340 h=573`, overflow 0.
- Prompt Builder: selected `gpt-5.6-luna`, Luna-first 6 options, body-owned
  portal rect `x=1238 y=183 w=190 h=274`, overflow 0.
- Element mention: `No matching elements`, rect `x=93.703125 y=194.5 w=320 h=56`,
  overflow 0. 캡처는 `evidence/settings-model-menu-1440.png`,
  `agent-model-menu-1440.png`, `prompt-builder-menu-1440.png`,
  `element-mention-menu-1440.png`.

| CR | capturedEvidence |
|---|---|
| CR0 | 000/001/010~050 문서가 현재 path와 명령을 가지고 closeout 감사 PASS |
| CR1 | config/adapter/Agent/video analysis가 4.5 기본, 4.3 explicit 호환 |
| CR2 | OpenAI image·보조 planner 기본값 Luna, Prompt Builder selected Luna |
| CR3 | UI/i18n/README/docs/site/structure와 runtime projection 계약 PASS |
| CR4 | Home empty·text-wrap·한국어 문구·glyph/i18n 계약과 5 viewport 렌더 PASS |
| CR5 | shared Select keyboard/portal/grouped height/44px/tablist 계약과 렌더 PASS |
| CR6 | 전체 로컬 gate와 5 viewport render fresh pass |
| CR7 | push·CI·issue/PR·archive는 아래 GitHub/archive 실행 후 같은 문서에 기록 |

## archive

- archive 실행은 유닛 디렉터리 통째 `mv`가 아니라, 이미 있는 `_fin` 유닛 안으로
  내용물을 병합하고 빈 `_plan` 유닛만 제거한다.

- 모든 criterion에 fresh `capturedEvidence`를 기록.
- `devlog/_plan/README.md`, `structure/07-devlog-map.md` 갱신.
- 이 폴더를 `devlog/_fin/260726_model-defaults-ui-cleaning/`으로 이동.
- goalplan validate 후 D->IDLE, host goal complete.
