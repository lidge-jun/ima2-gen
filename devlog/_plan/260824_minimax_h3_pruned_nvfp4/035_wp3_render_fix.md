---
created: 2026-08-24
tags: [ima2-gen, devlog, render-qa, comfyui, ui, phase3]
---

# 035 — wp3 render fix: H3 label clipping

Patched UI의 Comfy model dropdown에서 H3 row는 disabled였고 DOM accessible name은
전체였지만, 300px portal 안에서 긴 lock reason이 label 공간을 차지해
`MiniMax H3 FL2VA pruned NVF…`로 잘렸다.

Fix:

- generic `SelectItem`에 optional plain-text `title` 추가.
- H3 row의 visible sub는 짧은 localized `Catalog only`.
- stacked label은 wrap을 허용해 `NVFP4`까지 실제 화면에 노출.
- full server lock reason은 option title과 accessible option text에 유지.
- dropdown 전역 폭은 바꾸지 않아 다른 selector layout을 보존.

수정 후 같은 Browser flow를 다시 열어 exact label과 disabled state를 관찰한다.

Fresh observation:

```text
desktop text   MiniMax H3 FL2VA pruned NVFP4 — offline / Catalog only
mobile text    MiniMax H3 FL2VA pruned NVFP4 — offline / Catalog only
aria-disabled  true
title          ComfyUI video execution is not supported yet
Enter key      selection remains empty; list stays open
```

Screenshots:

- `evidence/030_ui_h3_locked_final.png`
- `evidence/030_ui_h3_locked_mobile.png`
