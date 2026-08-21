# 000 — Canvas hover + GPT i2i 투명화 버튼 + 라이트 모드 + UI/UX 루프: Plan

## Objective

dev 브랜치의 ima2-gen 웹 UI에 (1) 캔버스 모드 마우스 호버 피드백, (2) GPT i2i
투명화 원버튼, (3) 라이트 모드(토큰 기반, light/dark/system), (4) opus 리뷰 +
chrome 렌더링 QA 기반 UI/UX 개선 2라운드 이상, (5) 스크린샷/site/README 개선을
최소 10회의 PABCD 사이클로 배송한다.

## Evidence base (research, 2026-08-21)

- **라이트 모드 이력**: `ui/src/styles/themes.css` 헤더 주석 — 과거 Phase 010에서
  "theme families and light mode removed"로 의도적으로 제거됨. 재도입은 CSS 커스텀
  프로퍼티 토큰 레이어(`ui/src/index.css` `:root` — --bg/--surface/--text 등 이미 존재)
  위에 `[data-theme="light"]` 오버라이드로 한다. 하드코딩 hex는 51개 CSS 파일에 145건
  (`rg -c '#hex'` 합계) — 라이트 모드 전에 토큰화 필요.
- **투명화**: `devlog/_plan/260821_gpt_image2_transparent_background/000-probe-findings.md`
  — OAuth 프록시는 gpt-image-2-codex 고정, `background:"transparent"` 강제는 400,
  `background:"auto"` + 프롬프트 넛지("pure transparent background, PNG with alpha")는
  실제 작동. 서버 측 alpha 바이트 검증은 `lib/generatePipeline.ts`에 이미 존재
  (verify real pixel alpha, a961f0a6). i2i 경로는 `POST /api/edit` (routes/edit.ts,
  body: prompt/image(b64)/quality/size/provider/model/sessionId).
- **호버**: `useCanvasModePointerHandlers.ts`의 `setCleanupBrushCursor`는 cleanup
  브러시 도구에서만 갱신; `CanvasBackgroundCleanupLayer.tsx`가 SVG circle로 커서
  프리뷰 렌더. 일반 도구(선택/주석)에는 호버 피드백 없음. 캔버스 스택:
  `CanvasModeWorkspace.tsx` → `CanvasModeStage` + annotation frame + FloatingToolbar.
- **site/README**: `site/src/components/` Astro 컴포넌트 15개, README는 스크린샷
  1장 + 기능 나열. 최근 기능(투명화 검증, 캔버스 모드, 라이트 모드 예정) 미반영.

## Loop-spec

- Loop archetype: spec-satisfaction (수용 기준이 verifier 정의) + UI/UX 라운드는 judged(opus)
- Write scope: `ui/src/**`, `ui/dist`(빌드 산출), `site/**`, `README.md`,
  `assets/screenshots/**`, 필요시 `routes/edit.ts`·`lib/` 최소 수정, devlog 문서
- Out-of-scope: provider 인증 대격변, 서버 아키텍처, main 직접 push, npm 배포
- Budget: 무제한 (사용자 명시 grant). push는 dev 브랜치 한정 사전 승인.
- Verification: `npm run typecheck` + `npm test` + `cd ui && npm run build` +
  chrome(control-chrome) 스크린샷 → view_image + opus 서브에이전트 리뷰

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp0 | 000 | 이 로드맵 (docs-only) | — |
| wp1 | 010 | 캔버스 모드 호버 피드백 | — |
| wp2 | 020 | GPT i2i 투명화 원버튼 | — |
| wp3 | 030 | 테마 토큰 인프라 (hex 토큰화) | — |
| wp4 | 040 | 라이트 팔레트 + light/dark/system 토글 | wp3 |
| wp5 | 050 | 라이트 모드 전면 QA/색감 보정 | wp4 |
| wp6 | 060 | UI/UX 개선 라운드 1 (opus+chrome) | wp1-wp5 |
| wp7 | 070 | UI/UX 개선 라운드 2 (opus+chrome) | wp6 |
| wp8 | 080 | 스크린샷 자산 제작 (라이트/다크) | wp7 |
| wp9 | 090 | README 개선 | wp8 |
| wp10 | 100 | site/ 개선 + 최종 게이트 + dev push | wp9 |

## Accept criteria (goalplan criteria[] 미러)

- c-hover: 호버 피드백 chrome 스크린샷 + diff
- c-transparent: 투명화 버튼 → /api/edit 왕복 or 투명 PNG 증거
- c-tokens: 토큰화 diff + typecheck/build 통과
- c-light / c-light-qa: 토글 스크린샷 + 전 화면 대비 QA
- c-uiux1 / c-uiux2: opus 리뷰 + before/after
- c-shots / c-readme / c-site: 자산/diff 존재
- c-final: typecheck+test+build+10사이클 ledger+dev push
