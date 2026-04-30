# 0.09.47 — Mobile overlays + secondary surfaces (PLAN)

**Date:** 2026-04-28
**Status:** Plan — bundled with 0.09.45 (one PR, separate commits)

## STATUS 2026-04-30 — Partial

- Shipped: `549ad8f feat(mobile): add mobile UI shell with app bar, compose sheet, and settings toggle` covers baseline mobile overlay access.
- Remains: settings navigation/overlay polish is still tracked by #37 and related mobile UX follow-ups; keep this folder in `_plan`.
**Parent:** [0.09.45 PLAN.md](../260428_0.09.45-mobile-ui-overhaul/PLAN.md)
**Closes:** Follow-up to #33; addresses INVESTIGATION.md gaps G5, G6, new G13 (hover-only).

---

## Part 1 — Plain explanation

기본 화면이 모바일에서 잘 작동하게 된 다음에는, **모달과 보조 화면들**이 남습니다. 갤러리 모달은 데스크톱 폭(620~760px) 가정으로 만들어져서 폰에서 padding이 심하고 그리드가 무너집니다. 커스텀 사이즈 확인 모달, 메타데이터 복원 다이얼로그, 프롬프트 상세 모달도 모바일 룰이 0개입니다.

설정 화면(SettingsWorkspace)의 좌측 nav는 모바일에서 가로 스크롤이 되긴 하는데 스크롤바가 안 보여서 사용자가 스크롤 가능한지를 모릅니다. 갤러리의 즐겨찾기·삭제 버튼은 hover에만 보여서 터치 디바이스에서는 절대 안 보이는 죽은 기능입니다.

이 단계는 그 5종 모달 + 설정 nav + hover-only 액션을 모바일 친화적으로 손봅니다.

---

## Part 2 — Diff-level spec

### Goal
On phone viewports (≤800px): all overlay/modal surfaces fit without overflow, all interactive controls are tappable on touch (no hover-only), settings workspace nav is reachable.

### Non-goals
- Right panel (0.09.45)
- Sidebar / canvas / app bar (0.09.46)
- Node-mode / card-news (0.09.48)
- Modal animation/gesture overhauls — CSS responsive only.

### Acceptance criteria
- [ ] GalleryModal at ≤600px: single-column grid, padding 16px, sticky top-bar with close button, infinite-scroll preserved.
- [ ] CustomSizeConfirmModal at ≤600px: stacked W/H inputs, full-width buttons ≥44px.
- [ ] MetadataRestoreDialog at ≤600px: scrollable body, footer buttons ≥44px tap.
- [ ] PromptDetailModal at ≤600px: full-width, tags wrap, "use prompt" button bottom-sticky.
- [ ] SettingsWorkspace nav at ≤800px: replaced by `<select>` dropdown OR scroll-snap with edge fade. Recommendation: `<select>` (smaller code, instantly reachable).
- [ ] Gallery favorite/delete actions: visible on touch devices via `@media (hover: none)` always-visible variant.
- [ ] PromptLibrary row actions (currently hover-revealed): same treatment.
- [ ] Toast appears above sheets/drawers but below ErrorCard; respects `env(safe-area-inset-bottom)`.
- [ ] tsc clean, build clean.

---

### File touch list (A-audit revised)

```text
ui/src/index.css                                       # mobile rules per modal (canonical .modal/.modal__* + .gallery/.gallery__*)
ui/src/components/SettingsWorkspace.tsx                 # nav <select> on mobile (only file with JSX edit)
```

**2 files; 0 new files.** All modals already use canonical class names — no JSX restructuring required. Down from initial 8-file estimate.

---

### Hidden traps (HT-47)

| ID | Trap | Action |
|----|------|--------|
| HT-47-1 | Modal stacking: drawer (z 50) + Gallery (110) + ErrorCard (220) | Don't change z-indexes. Add a comment block in CSS documenting the canonical order. |
| HT-47-2 | iOS `position: fixed` on modal body scroll = body underneath also scrolls | Apply `overscroll-behavior: contain` on modal body and `overflow: hidden` on `<html>` while modal is open (existing pattern? verify). |
| HT-47-3 | `<select>` styling can't match site theme on iOS | Acceptable; native picker is more usable than custom dropdown on phone. Document. |
| HT-47-4 | `(hover: none)` media query catches touch laptops with mice — reveals actions always | Acceptable side-effect; alternative is `(pointer: coarse)` which is stricter. Use `(hover: none) and (pointer: coarse)` to scope to phones/tablets. |
| HT-47-5 | Gallery infinite scroll uses IntersectionObserver — confirm it still triggers in single-column mobile grid | Should "just work"; verify in V47-2. |
| HT-47-6 | Toast may duplicate safe-area inset if compose sheet (0.09.46) also reserves bottom | Toast offset = `env(safe-area-inset-bottom) + 12px`; compose sheet has its own padding. No double-counting because Toast appears above sheet z-order or below depending on context — verify. |

---

### Pseudo-diff plan (selectors only — full diffs are mostly CSS)

#### 1. `ui/src/index.css` (additions inside `@media (max-width: 800px)`)

```css
  /* Modal canonical z-order (documentation only; values unchanged):
     drawer 50 / mobile toggle 55 / promptLibrary 50 / compose sheet 55 /
     promptDetail 60 / gallery 110 / generic modal 100 / toast 200 /
     errorCard 220 / customSizeConfirm 230 / metadataRestore 240
     (Mobile toggle drops to 55 so PromptDetailModal at z=60 always wins — A-audit fix.) */

  /* Gallery (A-audit: actual classes are .gallery, .gallery__header, .gallery__close) */
  .gallery {
    padding: 16px;
    max-width: 100%;
    border-radius: 0;
    height: 100dvh;
  }
  .gallery__header {
    position: sticky; top: 0;
    padding-top: env(safe-area-inset-top);
    background: color-mix(in srgb, var(--surface) 96%, transparent);
    backdrop-filter: blur(8px);
  }
  .gallery__grid {
    /* A-audit pinned: actual grid container class. Used at GalleryModal.tsx:441/452/478, defined index.css:2569 */
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .gallery__close { min-width: 44px; min-height: 44px; }

  /* CustomSizeConfirm (A-audit: .modal.custom-size-confirm + .modal__body + .size-confirm__pairs + .modal__actions) */
  .modal.custom-size-confirm .size-confirm__pairs {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .modal.custom-size-confirm .modal__actions button {
    min-height: 44px;
    flex: 1;
  }

  /* MetadataRestore (A-audit: footer is generic .modal__actions) */
  .modal__body {
    max-height: calc(100dvh - 160px);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .modal__actions button { min-height: 44px; }

  /* PromptDetail (A-audit: existing footer is .prompt-detail-modal__footer; reuse it, do not invent __cta) */
  .prompt-detail-modal {
    width: 100%;
    height: 100dvh;
    border-radius: 0;
  }
  .prompt-detail-modal__footer {
    position: sticky;
    bottom: 0;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  /* Settings nav: hide list, show select (A-audit: actual aria key is settings.navAria) */
  .settings-nav { display: none; }
  .settings-nav--mobile { display: block; }
  .settings-nav--mobile select {
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
  }

  /* Toast safe-area */
  .toast { bottom: calc(12px + env(safe-area-inset-bottom)); }

  /* Hover-only → always-visible on touch (A-audit: real classes are .gallery__delete + .gallery__favorite) */
  @media (hover: none) and (pointer: coarse) {
    .gallery__delete,
    .gallery__favorite,
    .prompt-library-row__actions {
      opacity: 1 !important;
    }
  }
```

#### 2. `ui/src/components/SettingsWorkspace.tsx`

A-audit corrections (final, re-audit pass): `SETTINGS_SECTIONS` is `SettingsSection[]` (string[], not objects). Section title key is `settings.sections.<section>.title`. Cast `e.target.value` back to `SettingsSection` before `setActive`.

```diff
  return (
    <main className="settings-workspace">
      ...
+     <nav className="settings-nav settings-nav--mobile" aria-label={t("settings.navAria")}>
+       <select
+         value={active}
+         onChange={(e) => setActive(e.target.value as SettingsSection)}
+         aria-label={t("settings.navAria")}
+       >
+         {SETTINGS_SECTIONS.map((section) => (
+           <option key={section} value={section}>
+             {t(`settings.sections.${section}.title`)}
+           </option>
+         ))}
+       </select>
+     </nav>
      <nav className="settings-nav" aria-label={t("settings.navAria")}>
        {/* existing buttons unchanged for desktop */}
      </nav>
      ...
    </main>
  );
```

CSS hides one or the other based on viewport. No state changes.

#### 3. `ui/src/components/GalleryModal.tsx`

A-audit: existing classes already include `.gallery`, `.gallery__header`, `.gallery__close`. **No JSX restructure needed** — CSS-only. Verify the grid container's existing class during commit prep and target it directly in CSS.

#### 4. `ui/src/components/PromptDetailModal.tsx`

A-audit: existing class `.prompt-detail-modal__footer` already exists. **No JSX change needed** — apply sticky-bottom CSS to the existing footer.

#### 5-7. CustomSizeConfirmModal / MetadataRestoreDialog / Toast

A-audit: all use canonical `.modal.<variant>` + `.modal__body` + `.modal__actions` pattern. **CSS-only** — selectors target `.modal.custom-size-confirm`, `.modal__body` (scoped where ambiguous), `.modal__actions`. No JSX changes.

#### 8. `ui/src/components/PromptLibraryRow.tsx`

A-audit: class `.prompt-library-row__actions` exists. CSS-only `(hover: none)` override applies.

---

**File touch list correction (A-audit):** all of GalleryModal/CustomSizeConfirmModal/MetadataRestoreDialog/PromptDetailModal/Toast can be CSS-only. Only SettingsWorkspace needs JSX edits. No i18n changes — `settings.navAria` and `settings.sections.<id>.title` keys already exist.

```text
ui/src/index.css                                       # mobile rules per modal
ui/src/components/SettingsWorkspace.tsx                 # nav <select> on mobile
```

Down from 8 files → 2 files. Cleaner PR.

---

### Implementation order

1. **47.1** — `fix(ui): mobile rules for GalleryModal`
2. **47.2** — `fix(ui): mobile rules for CustomSizeConfirm + MetadataRestore + PromptDetail`
3. **47.3** — `fix(ui): SettingsWorkspace nav <select> on mobile`
4. **47.4** — `fix(ui): hover-only actions visible on touch (gallery + prompt library)`
5. **47.5** — `fix(ui): Toast safe-area-inset-bottom`

---

### Verification matrix

| # | Area | Viewport / device | Verify |
|---|------|-------------------|--------|
| V47-1 | Desktop regression | 1440×900 | All five modals + settings nav identical to today |
| V47-2 | Gallery mobile | 393×852 | Single-col grid, sticky header, infinite scroll triggers, close button 44px |
| V47-3 | CustomSizeConfirm mobile | 375×667 | Stacked, full-width buttons, no overflow |
| V47-4 | MetadataRestore mobile | 393×852 | Body scrolls within bounds, footer buttons reachable |
| V47-5 | PromptDetail mobile | 393×852 | CTA sticky-bottom, body scrolls, tags wrap |
| V47-6 | Settings mobile | 393×852 + 375×667 | `<select>` works, sections switch, accessible label |
| V47-7 | Touch hover override | iPhone Safari real device | Gallery favorite/delete visible without hover |
| V47-8 | Toast | 393×852 + virtual keyboard | Toast not covered by home indicator |
| V47-9 | A11y | Lighthouse + screen reader | Modal `aria-modal`, focus trap, Esc close all work |
| V47-10 | Theme | Dark + light | All modal backdrops + scrims contrast |
| V47-11 | Locale | KO + EN | Long button labels wrap |
| V47-12 | Stack | Drawer open + open Gallery | Gallery above drawer; ErrorCard above all |

---

### Rollback plan
Each commit (47.1 – 47.5) is independently revertable. Reverting all → 0.09.46 mobile state, modals back to current desktop-only treatment.
