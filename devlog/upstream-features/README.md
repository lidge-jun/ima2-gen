# upstream 기능 도입 로드맵

> **목적**: upstream(`lidge-jun/ima2-gen`)이 우리 fork(`ree9622/ima2-gen`) 분기 이후 추가한 89 커밋 중, 가치 있는 기능을 **코드 머지 없이 아이디어만 추출**해 우리 코드베이스에 직접 구현한다.
>
> **왜 코드 머지 안 함**: 분기점(`49b5126`, 2026-04-23) 이후 양쪽이 동일 핵심 파일을 대규모로 다르게 수정 — `server.js` -1945줄 리팩터(upstream) ↔ 기능 누적 추가(fork), `useAppStore.ts`/`index.css` 양쪽 모두 수천 줄 변경, `i18n/*.json` 우리는 삭제 vs upstream 수정. cherry-pick은 1줄 fix조차 충돌. 통째 머지는 며칠 작업 + 회귀 위험. 따라서 **재구현이 더 안전·빠름**.
>
> **작업 단위**: 기능별로 PR 1개. feature 브랜치 = `feat/upstream-<feature>`. 작은 기능은 마스터 문서 표만 보면 되고, 큰 기능은 이 폴더의 별도 PRD 참조.
>
> **세션 이어받기**: 이 문서의 "진행 상황 표"의 상태 컬럼이 단일 진실 출처(SSoT). 시작 전 origin pull, 작업 후 PR + 표 업데이트.

---

## 진행 상황 (단일 진실 출처)

상태 표기: `pending` / `in-progress` / `review` / `done` / `skip`.

### Phase 1 — 운영 즉시 가치 (충돌 없음, S~M)

| # | 기능 | 상태 | upstream commit | 우리 PR | 노트 |
|---|------|------|-----------------|---------|------|
| 1.1 | **Server 요청 로깅 + stale asset guard** | done | `31a8bbd` | [#1](https://github.com/ree9622/ima2-gen/pull/1) | `/api/*` 요청 로깅(redact body/query, X-Request-Id echo), UI bundle cache(no-store index + immutable assets + /assets 404 fallback). 기존 console.* 마이그레이션 + generated/ TTL은 별도 이슈 |
| 1.2 | **Validator 에러 코드** | done | `9f9fe53` `f710958` `e1b0b65` | [#2](https://github.com/ree9622/ima2-gen/pull/2) | `lib/refs.js` 추출 + REF_NOT_ARRAY/TOO_MANY/NOT_STRING/EMPTY/TOO_LARGE/NOT_BASE64. 3 callsite 의 redundant precheck 삭제, code 전파. UI compress(`compress.ts`)/토스트 라우팅은 Phase 2.1/2.2 |
| 1.3 | **Custom size 확인 다이얼로그** | pending | `d0f8dba` | - | custom size 입력 후 생성 전 확인 |
| 1.4 | **Session graph 저장 충돌 방어 (server-side)** | done | `c301a2b` `27a0647` | (PR 작성 중) | 메타 헤더(`X-Ima2-Tab-Id`/`Save-Id`/`Save-Reason`) 캡처 + `[session.graph_save]`/`graph_conflict`/`graph_error` 구조화 로그. UI side(autosave 큐, 토스트 문구)는 Phase 4.2 노드 모드에서 같이 |

### Phase 2 — 본격 품질 향상 (M)

| # | 기능 | 상태 | upstream commit | 우리 PR | 노트 |
|---|------|------|-----------------|---------|------|
| 2.1 | **에러 분류 + ErrorCard** | pending | `4b89901` | - | `lib/errorClassify.js`로 OpenAI 응답 분류 → 카드형 안내 UI. 우선순위: `MODERATION_REFUSED > AUTH_CHATGPT_EXPIRED > AUTH_API_KEY_INVALID > NETWORK_FAILED > UPSTREAM_5XX` |
| 2.2 | **클라이언트 ref 압축** | pending | `9f9fe53` | - | canvas 리사이즈 + JPEG ladder 0.85→0.7→0.55, longest edge 4096px 캡 (iOS Safari) |
| 2.3 | **config 중앙화** | pending | `170f29e` `355bc98` `d09f9d3` | - | `config.js` 단일 모듈, `IMA2_*` env + `config.json` 머지 |
| 2.4 | **Inflight job 영속화 강화** | pending | `b9bf597` `a13773d` | - | 우리 `7ae92e9` 위에 sidecar 메타 보존 + 진행 중 작업 복구 |

### Phase 3 — 큰 기능 (L)

| # | 기능 | 상태 | upstream commit | 우리 PR | PRD |
|---|------|------|-----------------|---------|-----|
| 3.1 | **Direct prompt mode** | pending | `391d9e7` | - | [direct-prompt-mode.md](direct-prompt-mode.md) |
| 3.2 | **세션별 StyleSheet** | pending | `d5e47eb`~`0e18df0` (18커밋) | - | [style-sheet.md](style-sheet.md) |
| 3.3 | **이미지 모델 선택 UI** | pending | `d012ecf` | - | gpt-image-1 외 옵션 도입 시. 단독 가치 작음 — 다른 모델 추가될 때 같이 |

### Phase 4 — 사용 빈도 보고 결정

| # | 기능 | 상태 | upstream commit | 우리 PR | PRD |
|---|------|------|-----------------|---------|-----|
| 4.1 | **Card news 워크스페이스** | pending | `5e2194e` `c84f1d2` `13ea601` `8327306` | - | [card-news.md](card-news.md) |
| 4.2 | **Node mode 정식화 + 스트리밍 + 배치선택** | pending | `c5aa4ca` `04f8bf5` `a91fef4` `6e02cbc` | - | [node-mode.md](node-mode.md) |

### Phase 5 — 자잘한 UX

| # | 기능 | 상태 | upstream commit | 우리 PR | 노트 |
|---|------|------|-----------------|---------|------|
| 5.1 | **Quality "auto" 응답 경고** | pending | `754d59a` | - | OAuth 응답이 다른 quality로 처리됐을 때 toast |
| 5.2 | **CLI cancel + 명확한 에러** | pending | `cf727f7` `8327306` | - | asrock는 systemd 없어 부분 가치 |
| 5.3 | **CLI GitHub star 프롬프트** | skip | `00235fb` | - | 우리 fork엔 무관 |

### 중복 (이미 우리가 해결, 작업 불필요)

| upstream commit | 메시지 | 우리 동등 |
|-----------------|--------|----------|
| `d4e9068` | fix: handle Windows npx spawn EINVAL | `2579e53` |
| `98a2bb1` | feat: wire moderation controls through OAuth flow | `0e7df87` |

### Skip (영역 충돌 / 가치 작음)

| upstream commit | 메시지 | 이유 |
|-----------------|--------|------|
| `6c387d7` | refactor: split server routes and oauth helpers | 우리 server.js 통째 작업과 정면충돌, 분할은 별도 작업 |
| `5d70cad` `ef1bf94` | [agent] feat: update UI components, store, dev scripts | useAppStore 2598줄 충돌, 이득 불명 |
| `e02b200` | fix: simplify right sidebar settings | 우리 sidebar 새로 짬 |
| `e8f79bf` `3273b6e` | settings workspace 테마 / scroll | 위와 동일 |
| `af0d30d` `e67f0d6` `1beca77` `fcf77ee` | storage legacy 마이그레이션 | 우리는 한 경로로 시작, legacy 없음 |
| `chore: release v1.0.X` 11건 | package.json 버전만 | - |
| `[agent] docs:` 시리즈 | 자동 생성 문서 | 우리 문서 체계 다름 |

---

## 작업 흐름

### 시작
```bash
cd /c/Users/ko/Desktop/ima2-gen   # 또는 asrock /home/ko/apps/ima2-gen
git checkout main && git pull origin main
git checkout -b feat/upstream-<feature-slug>
```

### 구현 중 참고
- upstream 원본 코드: `git show <sha>:<path>` 또는 `git show <sha>` (전체 diff)
- 예: `git show 4b89901:lib/errorClassify.js`
- 우리 코드 컨벤션 우선. upstream 코드를 베끼지 말고 **아이디어만 추출**

### 완료 시
1. 테스트: `npm test` (있는 경우) + asrock에서 동작 확인
2. PR: `gh pr create --base main --title "feat: <기능>" --body "참조: upstream <sha>"`
3. 머지 후 이 문서의 진행 상황 표 업데이트 (상태 + PR 번호)
4. asrock 적용: `ssh asrock "cd /home/ko/apps/ima2-gen && git pull origin main && pkill -f 'apps/ima2-gen/server.js' && nohup node server.js > /tmp/ima2-gen.log 2>&1 &"`
   - 또는 운영 무중단 원하면 reverse-proxy 새 포트로 띄운 후 nginx upstream 변경

### 컨벤션
- 커밋 메시지: `feat(upstream-<feature>): <요약>` 또는 `fix(upstream-<feature>): ...`
- 본문 첫 줄에 `참조: upstream <sha>` 명시 (역추적용)
- 기능당 PR 1개. 여러 기능 묶지 말 것 (롤백 어려움)

---

## upstream 89 커밋 전체 목록

archive 차원으로 보존. cherry-pick은 시도해도 충돌만 나니 참고용.

```
d4e9068 fix: handle Windows npx spawn EINVAL                          [중복]
da96edb chore: release v1.0.5                                          [skip]
98a2bb1 feat: wire moderation controls through OAuth flow (#2)         [중복]
1a13afe fix(moderation): keep default at "low" after merging #2        [재고려]
5d70cad [agent] feat: update UI components, store, and dev scripts     [skip]
ef1bf94 [agent] feat: add i18n toggle, shared plan, and structure docs [skip]
84f7252 [agent] docs: update devlog README and structure map           [skip]
1c2f37f [agent] docs: update devlog map                                [skip]
e0313e7 chore: release v1.0.6                                          [skip]
b4f3d73 feat(0.09.5): auto-attach current image as reference on 'New from here'  [재고려]
26e95be feat(0.09.5): node 'Duplicate branch' auto-seeds source image as reference  [Phase 4 node]
d5e47eb feat(0.10): add style_sheet + style_sheet_enabled columns to sessions  [Phase 3.2]
de31e91 feat(0.10): lib/styleSheet.js extractor + prefix renderer       [Phase 3.2]
0b82fb8 feat(0.10): sessionStore helpers for style-sheet get/set/enable [Phase 3.2]
000a30c feat(0.10): server routes for style-sheet CRUD + extract        [Phase 3.2]
d0a1728 feat(0.10): auto-prepend style sheet to /api/generate prompt    [Phase 3.2]
39a39f3 feat(0.10): ui/api style-sheet client helpers                   [Phase 3.2]
02b0a22 feat(0.10): zustand store — style sheet state + actions         [Phase 3.2]
6ad43bc feat(0.10): StyleSheetPanel component wired into sidebar        [Phase 3.2]
c44a2d7 feat(0.10): wire style sheet into /api/edit and /api/node/generate  [Phase 3.2]
d644677 test(0.10): unit tests for coerceStyleSheet + renderStyleSheetPrefix  [Phase 3.2]
f1772f5 i18n(0.10): localize StyleSheetPanel strings for en/ko          [skip — i18n 없음]
f199329 fix(0.10): coerceStyleSheet rejects empty/array input           [Phase 3.2]
0cd1a54 fix(0.10): PUT style-sheet rejects non-boolean enabled          [Phase 3.2]
81a97f1 fix(0.10): verify session exists before calling OpenAI on extract [Phase 3.2]
8acc5a4 fix(0.10): map STYLE_SHEET_EMPTY/PARSE/SHAPE to 422 not 500     [Phase 3.2]
b55b471 fix(0.10): guard style-sheet store against stale session writes [Phase 3.2]
cb5af30 i18n(0.10): add missing styleSheet keys                         [skip]
0e18df0 a11y(0.10): StyleSheetPanel editor — ESC, role=dialog, save/toggle guards [Phase 3.2]
170f29e feat(0.09.12): centralize runtime config in config.js           [Phase 2.3]
355bc98 feat(0.09.12): structured config object + config.json + IMA2_* env [Phase 2.3]
d09f9d3 fix(0.09.12): add config.history section + wire generatedDir/trashDir/trash.ttlMs [Phase 2.3]
9f9fe53 feat(0.09.7): validator codes + client-side ref compression     [Phase 1.2 + 2.2]
f710958 fix(0.09.7): propagate REF_* codes from route prechecks         [Phase 1.2]
e1b0b65 fix(0.09.7): collapse route prechecks into validator            [Phase 1.2]
539a07f feat(0.09.7.1): relocate style sheet to composer toolbar        [Phase 3.2]
4b89901 feat(0.09.8): code-based error UX with ErrorCard + toast routing [Phase 2.1]
754d59a feat(0.09.9): normalize OAuth quality to 'auto' with response warnings [Phase 5.1]
391d9e7 feat(0.09.10): Direct prompt mode + revised_prompt capture      [Phase 3.1]
6c387d7 refactor(0.09.12.1): split server routes and oauth helpers      [skip]
ef4a9e0 feat(0.09.12.1): add prompt fidelity frontend contracts         [Phase 3.1 동반]
705b110 fix(0.09.12.2): align quality options                           [Phase 5.1 동반]
4b266f8 fix(ci): use file URL for config test import                    [skip — 우리 CI 없음]
d2d1581 fix(ci): use platform path in config storage test               [skip]
ba018ca [agent] fix: report billing api key source                      [재고려 — 빌링 가시성]
e8f79bf [agent] feat: add settings workspace theme controls             [skip]
bf6f0c6 [agent] docs: refresh ima2 usage docs                           [skip]
3273b6e [agent] feat: streamline settings scroll workspace              [skip]
485bd8d [agent] docs: document settings scroll workspace                [skip]
00235fb feat(cli): prompt for GitHub star on serve                      [skip]
9d2d2e8 feat(node-mode): add node-local reference handling              [Phase 4.2]
3fdecf6 feat: add safe observability logs                               [Phase 1.1 동반]
e02b200 fix: simplify right sidebar settings                            [skip]
008715c docs: refresh multilingual readmes                              [skip]
c5aa4ca feat: productize node mode                                      [Phase 4.2]
e91c79e chore: release v1.0.7                                           [skip]
6ae8a4d fix(session): isolate graph sessions per browser                [재고려]
589d585 fix: persist generated assets in config dir                     [Phase 2.3 동반]
04f8bf5 feat: stream partial node images                                [Phase 4.2]
9935db5 docs: archive node streaming plan                               [skip]
bdc5881 chore: release v1.0.8                                           [skip]
af0d30d fix(storage): migrate legacy generated assets safely            [skip]
fcf77ee fix(nodes): honor injected generated storage dir                [skip]
364c254 chore: release v1.0.9                                           [skip]
e67f0d6 fix(storage): broaden legacy generated path discovery           [skip]
5c6bb13 chore: release v1.0.10                                          [skip]
d012ecf feat(models): add selectable image generation model             [Phase 3.3]
d0f8dba fix(size): confirm custom adjustments before generation         [Phase 1.3]
ab2ae06 docs(plan): add card news and custom size research              [skip]
2c6a38b fix(node-ui): compact node footer actions                       [Phase 4.2]
47a9a93 fix(node-ui): enlarge connection handle targets                 [Phase 4.2]
c301a2b fix: harden session graph save conflicts                        [Phase 1.4]
27a0647 test: document node conflict recovery contracts                 [Phase 1.4 동반]
ba44b1b docs: refresh readme and api guide                              [skip]
1beca77 fix(storage): recover legacy generated assets                   [skip]
a13773d fix(node): preserve inflight recovery metadata                  [Phase 2.4]
918fc82 chore: release v1.0.11                                          [skip]
471df9b chore: release v1.0.11                                          [skip]
4a0a535 chore: preview v1.0.11-preview.20260425133538                   [skip]
3920389 chore: release v1.1.0                                           [skip]
c00d393 test: add package smoke manifest check                          [skip]
b9bf597 fix: persist active inflight jobs                               [Phase 2.4]
ff1c446 test: add package install smoke                                 [skip]
7fcbb5b docs: add community FAQ hub                                     [skip]
31a8bbd fix(server): add request logging and stale asset guards         [Phase 1.1]
a91fef4 feat(node): add batch selection controls                        [Phase 4.2]
5e2194e feat(card-news): add dev MVP workspace                          [Phase 4.1]
8b92dfb docs: refresh roadmap after card news planning                  [skip]
b210f10 test: harden windows CI smoke paths                             [skip]
c84f1d2 feat(card-news): add text field generation contract             [Phase 4.1]
13ea601 feat(card-news): add text field editing UI                      [Phase 4.1]
6e02cbc feat(node): improve references and regeneration flows           [Phase 4.2]
47da643 docs: update card news and node planning docs                   [skip]
571ecd9 fix: preserve node preview aspect ratio                         [Phase 4.2]
e8142dd fix(runtime): advertise fallback ports                          [Phase 2.3 동반]
cf727f7 feat(cli): add cancel and clearer error hints                   [Phase 5.2]
8327306 feat(card-news): improve prompt quality and template registry   [Phase 4.1]
8e9c99e docs: update runtime and CLI guidance                           [skip]
0b26266 feat(cli): complete classic parity slice                        [Phase 5.2]
daa932c fix(ui): add node types for vite config                         [Phase 4.2 동반]
```
