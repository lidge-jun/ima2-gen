---
title: 키잉 전후 비교 검증 및 closeout
date: 2026-07-15
tags: [ima2-gen, asset-gen, keying, verification, closeout]
status: complete
---

# 011 — 검증 및 closeout

## Static gates

- `node --test tests/asset-gen-keying-preview-contract.test.js tests/structure-line-counts-contract.test.js` — 7/7 pass, exit 0.
- `npm run typecheck` — exit 0.
- `npm run typecheck:tests` — exit 0.
- `cd ui && npm run build` — 508 modules, exit 0.
- `npm run test:inventory` — 86 runtime / 142 contract, exit 0.
- `npm test`는 병렬 element/promotion 작업이 들어오기 직전 1211/1211 pass. 최종 현재 트리에서는 1235 중 4 fail: 새 `/api/assets/promote-element`의 API docs 누락 1건, 병렬 `elementCompiler`/`elementIds` 구현-테스트 불일치 3건. 본 유닛 파일과 무관하며 해당 병렬 파일을 수정하거나 되돌리지 않았다.

## Render / activation evidence

- 실제 Grok 크로마 이미지 생성 → 배경 제거 패널:
  - 데스크톱 2-up: `/tmp/asset-gen-keyed-preview-desktop.png`.
  - 390px mobile 2-up: `/tmp/asset-gen-keyed-preview-mobile-390.png`.
  - 시스템 Chrome exact 320×844: `/tmp/asset-gen-keyed-preview-exact-320.png`.
  - exact 320 metrics: `innerWidth=320`, `documentScrollWidth=320`, panel `left=16/right=304`, panel `clientWidth=scrollWidth=286`, compare `clientWidth=scrollWidth=266`, preview count 2.
- 저장 뒤 결과 목록: `/tmp/asset-gen-keyed-derived-card.png` — keyed PNG가 checkerboard/배지와 함께 원본 앞에 나타나고 재키잉 버튼 없음.
- 실제 asset 레코드: `a_01KXHT0PZRY4M7RMX65F80EFDP`, `filePath=1784082688575_d0426f47_0-keyed-1784082881527.png`, `folderId=null`(미분류), `derivedFrom=1784082688575_d0426f47_0.jpeg`, `derivedKind=keyed-png`, `keyParams={tolerance:40,softness:10,spill:30}`.
- 브라우저 console warn/error: 0.
- 비디오 파생 카드 경로는 source contract와 final reviewer가 검증했다. 실제 alpha WebM job/asset 경로는 선행 유닛 `devlog/_fin/260715_asset_gen_mode/031_video_keying_job.md`, `032_video_gate.md`의 live evidence를 재사용한다.

## Audit

- A reviewer Aristotle (`gpt-5.6-luna`, low): 계획 보완 후 `VERDICT: PASS`.
- C reviewer Bohr (`gpt-5.6-luna`, low): async ownership/payload 경계 5 repair round 후 `VERDICT: PASS`, residual 0.

## Pessimist record

- 제거 결과의 품질 자체는 기존 color-key 알고리즘/slider에 의존하며 이번 변경이 개선하지 않았다.
- exact 320에서는 제목이 두 줄로 줄바꿈되지만 비교판·controls·actions는 가로 overflow 없이 모두 도달 가능하다.
- 현재 full-suite 4 fail이 본 유닛 변경 때문이라는 증거가 나오거나, stale target callback이 새 패널 state를 바꾸는 재현이 생기면 이 DONE 판정을 철회한다.

## Terminal outcome

`DONE` — 원본/배경 제거 동시 비교, 저장 뒤 파생 카드 즉시 표시, 좁은 화면, 비동기 ownership hardening을 scoped verifier와 실제 저장 E2E로 확인했다.

