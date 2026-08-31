# 023 — wp2 render and interaction evidence

Date: 2026-08-27. Isolated server: port 3347 with temp config/generated roots.

## Browser ladder

- In-app browser failed before selection because its runtime referenced missing stale
  cache `browser/26.818.41509/browser-service.mjs` while installed files are under
  `26.818.61809`.
- Chrome plugin hit the same shared runtime mismatch.
- Computer Use failed to start its native pipe.
- Final QA used the already-running `agbrowse` isolated Chrome profile. This was an
  explicit fallback after the three preferred native QA surfaces failed.

## Interaction proof

- Desktop V5: snapshot exposed `checkbox "Auto SMEA"` and
  `checkbox "Decrisper"`. Clicking each followed by a fresh snapshot/evaluate returned
  `{auto:true,decrisper:true,overflow:0}`.
- V4.5: snapshot retained both controls while DOM inspection returned
  `{alpha:false,quality:false}` for V5-only Transparent Background and Quality Preset.
- GPT: after switching provider, DOM inspection returned
  `{auto:false,decrisper:false}`.
- Narrow: actual viewport `500x757`; opening the Controls sheet exposed both controls,
  and document overflow stayed 0. Scrolling the sheet to Decrisper showed readable
  label/help copy and intact lower controls.
- Console: no browser console output. Network inventory captured 29 expected local
  document/font/script/API requests and no failed request.
- Teardown: unified server session exited 0 on Ctrl-C; port 3347 had no listener.

## Screenshots

| File | SHA-256 | Observation |
|---|---|---|
| `evidence/wp2-v5-desktop.png` | `06019251f0f77a8766933a03e9bbb0a5e9a3f2245f69658da4026d9790db18e4` | Both controls checked; right panel aligned |
| `evidence/wp2-v45-desktop.png` | `4e161076f19d9c5df8a5147d58cd0f71e5301f8d98da7f996d69339f2eb33100` | New controls retained; V5-only controls absent |
| `evidence/wp2-v5-narrow-top.png` | `4dde3af6237f56f7a0820012a639d4d5e0bc3145bd50799a411f7695d688d0d9` | Controls sheet, top sampling area, no clipping |
| `evidence/wp2-v5-narrow-lower.png` | `6980f8a24bc4a7f6e33f876d580f2c3da5cf204baa3e70a299512b2a8e3fc75c` | Decrisper and lower controls readable |

All four images were read back with `view_image`; no repair was needed after the clean
observation.
