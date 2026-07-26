# 090 — Closeout (2026-07-11)

터미널 결과: **DONE**

## 변경 파일

- `ui/src/lib/canvas/memoPrompt.ts` — 지시문 3단 강화 (서두 선언 + 넘버링
  목록 + 제거·재구성·보존 조항). 테스트 고정 문장 보존.
- `ui/src/store/storeReferenceImpl.ts` — `resolveModelReferenceSrc()` 추가,
  `useCurrentAsReference`/`useImageAsReference`가 canvas version을 clean
  원본으로 라우팅 (L1/L2 누수 차단).
- `ui/src/components/canvas-mode/useCanvasModeSession.ts` — Apply 시 memo
  지시문을 "캔버스 노트" 컴포저 칩으로 삽입/교체 (G2).
- `ui/src/i18n/en.json`, `ko.json` — `canvas.annotationInstructionsChip` 키.
- `tests/canvas-apply-merged-contract.test.js`,
  `tests/node-child-refs-payload.test.js` — 참조 압축 계약을 새 clean-라우팅
  계약으로 갱신 (압축 경유 보장은 유지, clean 라우팅 고정 추가).
- `docs/PROMPT_STUDIO.md` / `.ko.md` — "캔버스 노트와 i2i" 섹션.
- `skills/ima2/SKILL.md` — Annotated inputs / Removal edits 지침.

## 검증 증거

- `npx tsc -b` (ui) — 통과
- `npm run ui:build` — built in 1.13s
- `npm test` — tests 1094, pass 1092, fail 0
- `cxc loop validate --slug canvas-i2i-annotation-cleanup-memo-notes-arrows`
  — 출력은 goalplan ledger 참조 (OK)

## 남은 리스크 / 후속

- G1 (구워진 노트의 캔버스 내 사후 제거)은 제품 결정 필요 — `010_rca.md`
  후속 과제 참조.
- memo 지시문 강화는 auto 모드 서버 재작성에서의 생존율을 높이는 방향이지만
  모델 측 보장은 아님 (VIBE 벤치마크 근거). 실패 시 다중 후보 + 잔존부
  재편집 워크플로를 문서로 안내.
