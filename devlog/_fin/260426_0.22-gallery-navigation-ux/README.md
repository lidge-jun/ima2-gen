# 0.22 Gallery Navigation UX

> Created: 2026-04-26 KST
> Scope: improve generated-image navigation without changing the current gallery layout.

## Documents

| File | Purpose |
|---|---|
| `01_keyboard_navigation.md` | Focus generated image and move previous/next with left/right arrow keys |
| `02_gallery_position_restore.md` | Reopen Gallery at the last selected item or scroll position |
| `03_horizontal_wheel_scroll.md` | Keep horizontal thumbnail strips, but allow vertical wheel input to scroll left/right |
| `04_contract_tests.md` | Contract tests that lock the UX behavior without browser-only flakiness |

## Product Decision

Keep the existing horizontal thumbnail layout.

Do not replace it with a vertical thumbnail rail. The improvement is interaction-level:

```text
vertical mouse wheel on horizontal strip
  -> horizontal thumbnail scroll
```

## Implementation Order

1. Gallery position restore.
2. Left/right keyboard navigation on the focused image viewer.
3. Vertical wheel to horizontal thumbnail scroll for current strips.
4. Contract tests and manual smoke checklist.

## Non-goals

- No backend history API change.
- No Gallery DB schema change.
- No layout rewrite to vertical rail.
- No permanent browser cache requirement for MVP.
- No infinite virtualization in this slice.
