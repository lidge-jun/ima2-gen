---
title: "110 — WP11: 이슈 처분 + devlog 아카이브"
lane: "260726_zero-backlog-frontend-qa"
wp: 11
created: 2026-07-26
depends_on: [WP1, WP2, WP3, WP4, WP5, WP6, WP7, WP8, WP9, WP10]
issues: [27, 28, 31, 80, 84, 85, 88, 90, 98]
criteria: [C11, C12, C13]
---

# WP11 — 이슈 처분 + devlog 아카이브

마지막 사이클. 앞선 열 사이클의 구현 커밋을 근거로 이슈를 닫고 devlog를 정리한다.

**순서가 중요하다.** 구현 전에 이슈를 닫으면 정리가 아니라 은폐다. 이 WP가 마지막인
이유가 그것이다.

## 이슈 처분표

| 이슈 | 처분 | 근거 |
|---:|---|---|
| #27 | close (구현) | WP5 커밋 + `tests/canvas-svg-export-contract` |
| #28 | close (구현) | WP5 커밋 + `tests/canvas-pptx-export-contract` |
| #31 | close (BLOCKED) | upstream 계약 미검증. 아래 별도 절 |
| #80 | close (구현) | WP9 커밋 + 매트릭스 계약 테스트 |
| #84 | close (구현) | WP7 커밋 + 세 표면 동형성 테스트 |
| #85 | close (구현) | WP8 커밋 + 폴백 계약 테스트 |
| #88 | close (구현) | WP6 커밋 + 폴백 활성화 테스트 |
| #90 | close (구현) | WP4 커밋 + `model: null` 회귀 수정 |
| #98 | close (완료 확인) | 4라운드 중 3라운드 기구현, 4라운드 잔여는 아래 |

각 close 코멘트는 **한국어**로 쓰고 커밋 해시와 테스트 파일을 명시한다. "완료했습니다"만
쓰면 나중에 검증할 수 없다.

## #31 — BLOCKED로 닫는 근거

이건 신중해야 한다. 미구현을 구현으로 위장하지 않되, 영원히 열어두지도 않는다.

코멘트에 담을 내용:

1. **로컬 구현은 전부 완료됐다** — `ui/src/lib/canvas/maskRenderer.ts:21-56`(마스크 PNG
   생성), `routes/edit.ts:78-96`(PNG/base64/알파/치수 검증), `routes/edit.ts:180-192`
   (provider별 분기).
2. **차단 지점은 정확히 한 곳이다** — `lib/oauthProxy/multimodeGenerators.ts:184-190`.
   플래그를 켜도 upstream payload가 미구현이라 `EDIT_MASK_NOT_SUPPORTED`를 반환한다.
   `lib/oauthProxy/multimodeGenerators.ts:185` 주석이 "STEP-0 verification 후 활성화"를 명시한다.
3. **왜 진행할 수 없는가** — 업스트림 이미지 편집 API의 마스크 계약(필드명,
   multipart/JSON 형식, 알파 채널 의미)이 공개 문서로 확인되지 않는다. 추측한 payload를
   보내면 이슈 자체가 금지한 "조용한 열화"(마스크 무시하고 전체 편집)가 발생할 수 있다.
   실제 계약 탐침은 유료 OAuth 호출을 요구하고, 그건 사용자 승인 사항이다.
4. **재개 조건** — upstream 마스크 지원이 문서화되거나 사용자가 계약 탐침을 승인하면
   `_future/260430_issue31-provider-masked-edit/`의 구현 lock을 그대로 실행하면 된다.

이 정보를 남기면 닫아도 손실이 없다. 재개하려는 사람이 처음부터 다시 조사하지 않는다.

## #98 — 잔여 판단

4라운드 중 세 라운드는 랜딩됐다(001 문서의 표 참조). 4라운드도 storyboard 플래그·
프롬프트 프리픽스·소스 이미지 경로가 동작한다.

미구현은 계획 문서가 추가로 요구한 `ui/src/lib/storyboard.ts`와 자동 keyframe
체이닝이다. 이걸 어떻게 처리할지가 판단 지점이다.

**결론: 잔여를 구현하지 않고 닫는다.** 현재 storyboard UX는 이미 사용 가능하고,
자동 체이닝은 원래 이슈 제목("storyboard planner skill")의 범위를 넘는 별도 기능이다.
계획 문서의 야심과 이슈의 약속을 구분한다. 코멘트에 라운드별 랜딩 근거를 file:line으로
남기고, 자동 체이닝은 향후 필요 시 새 이슈로 제기하도록 명시한다.

**단, B 단계에서 실제로 storyboard 토글을 켜고 생성해 동작을 확인한다.** 코드가
있다는 것과 동작한다는 것은 다르다.

## devlog 아카이브 계획

### `_plan` 직속

| 유닛 | 처리 |
|---|---|
| `260715_subscription-mcp-providers/` | WP10 Tier1 완료 기록 + Tier2 NEEDS_HUMAN 명시 후 `_fin/` |
| `260716_cli-entry-routing/` | 상태 문서 갱신 후 `_fin/` — 아래 참조 |
| `260718_closeout-sweep/` | historical audit로 `_fin/` |
| `260726_zero-backlog-frontend-qa/` | 이 lane 자체를 마지막에 `_fin/` |

**`260716_cli-entry-routing`의 상태 문서가 낡았다.** `060_current_status.md`는 WP4를
"완료"로, WP5를 "잔여"로 적었지만, 실제 코드 검증 결과 WP4는 완료가 맞고 WP5도
multishot 라우트(`routes/mcpMultishot.ts`)와 upscale(`bin/commands/upscale.ts`)이
랜딩됐다. 남은 것은 `bin/commands/editVideo.ts`(파일 없음)와 multishot CLI 플래그,
그리고 Runway 워크스페이스 한도로 막힌 라이브 검증이다.

이 잔여는 **외부 provider 한도가 차단 원인**이므로 구현해도 검증할 수 없다.
`_fin/`으로 옮기되 closeout 문서에 차단 사유와 재개 조건을 남긴다.

### `_future`

| 유닛 | 처리 |
|---|---|
| `260430_issue27-canvas-svg-export/` | WP5가 구현 → `_fin/` |
| `260430_issue28-canvas-pptx-export/` | WP5가 구현 → `_fin/` |
| `260430_issue31-provider-masked-edit/` | BLOCKED 기록 후 `_fin/` |
| `260529_issue80-batch-comparison-matrix/` | WP9가 구현 → `_fin/` |
| `260602_storyboard-planner-skill/` | #98 처분과 함께 `_fin/` |
| `260715_icon_pipeline/` | 대응 이슈 없음 → `_future` 유지 판단 |
| `260719_higgsfield-open-ledger.md` | 이월 원장 → 유지 판단 |

마지막 두 개는 **정직하게 남긴다.** 대응하는 GitHub 이슈가 없고 구현 착수도 없다.
"0으로 만들기" 위해 억지로 옮기면 그건 정리가 아니라 숫자 맞추기다. 사용자 목표는
open issue 0 / open PR 0이고, `_future`는 그 대상이 아니다. `_plan/README.md`에
이 판단 근거를 남긴다.

## `_plan/README.md` 최종 상태

```markdown
## 현재 Active Lane

없음. 2026-07-26 zero-backlog 사이클로 전 lane closeout.

## Deferred (`_plan/_future/`)

- `260715_icon_pipeline/` — 대응 이슈 없음, 구현 0건 handoff
- `260719_higgsfield-open-ledger.md` — 업스트림 이월 원장

## 외부 차단으로 미완료인 항목

- MCP Tier 2 authenticated smoke — 유료 인증 실행, 사용자 승인 필요 (NEEDS_HUMAN)
- Runway edit_video 라이브 full-flow — 워크스페이스 한도 (BLOCKED)
- Canvas provider-backed masked edit — upstream 계약 미검증 (BLOCKED)
```

## 실행 순서

1. 앞선 WP들의 커밋 해시를 수집한다.
2. 각 이슈에 한국어 근거 코멘트를 남기고 닫는다(`gh issue close --comment`).
3. `gh issue list --state open`이 0건인지 확인한다.
4. `gh pr list --state open`이 0건인지 확인한다.
5. 각 lane에 closeout 문서를 쓰고 `_fin/`으로 이동한다(`git add -f` — devlog는 gitignore 대상).
6. `_plan/README.md`를 갱신한다.
7. 전체 게이트 5종을 실행한다.
8. 이 lane 자체를 `_fin/260726_zero-backlog-frontend-qa/`로 옮긴다.

**5번의 `git add -f` 주의.** `devlog/`는 `.gitignore` 대상이다. 이동은
`git add -u devlog/_plan/`(삭제 반영) + `git add -f devlog/_fin/...`(추가) 조합이
필요하다. 이걸 빠뜨리면 이동이 커밋에 안 잡힌다.

## Accept criteria (C11, C12, C13)

1. `gh issue list --state open` 출력이 비어 있다.
2. `gh pr list --state open` 출력이 비어 있다.
3. 닫은 이슈 9건 모두 한국어 근거 코멘트를 갖는다. BLOCKED 2건은 재개 조건까지 포함한다.
4. `devlog/_plan` 직속에 `README.md`와 `_future/`만 남는다.
5. `_plan/README.md`가 실제 상태와 일치한다.
6. 전체 게이트 5종 exit 0.
7. push는 하지 않는다 — 사용자 승인 사항(DEV-GIT-PUSH-01).

## 범위 경계

IN: 이슈 코멘트/클로즈, devlog 이동, README 갱신, closeout 문서.
OUT: 신규 이슈 생성, 원격 push, 릴리스, `_future` 강제 정리.
