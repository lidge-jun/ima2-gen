---
created: 2026-08-24
tags: [ima2-gen, devlog, audit, comfyui, catalog, phase3]
---

# 032 — wp3 A audit synthesis

Arendt와 Lovelace 두 Sol review packet이 각각 3회 bounded wait 안에 artifact를
내지 못해 main이 audit을 회수했다.

Direct audit blockers and fixes:

1. `routes/models.ts`의 기존 `first.id`는 video H3를 image default로 만들 수 있음.
   - first image workflow만 default로 선택하도록 plan에 추가.
2. shared adapter가 모든 workflow를 image model로 투영함.
   - `lib/providers/adapters/comfy.ts` auth/listModels를 image-only로 필터.
3. direct `/api/generate`가 H3 id를 받아 image adapter까지 도달 가능.
   - `lib/providerOptions.ts`에 context-backed video workflow lock 추가.
4. explicit `--kind image` + SaveVideo mismatch 처분이 없었음.
   - inferred kind와 explicit kind 불일치는 400.
5. workflow manager kind UI의 4개 i18n 파일이 exact map에서 누락됨.
   - en/ko/zh-Hans/zh-Hant와 i18n parity test를 추가.

Baseline targeted suite: 72 pass, 0 fail. 수정 후 같은 suite와 새 negative branches를
다시 실행한다.

VERDICT: GO-WITH-FIXES (blockers=5)
