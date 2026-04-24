# ima2-gen UI/UX Overhaul — v2 Design

Date: 2026-04-24
Branch: fix/windows-oauth-spawn (design only; implementation branch to be decided)
Status: Draft — awaiting user review

## Motivation

The current UI ships a clean generation flow (composer + canvas + right-panel
settings + gallery), and the recent overhaul (commit 08403e2) added empty
state, skeletons, grouped size tabs, and shortcuts. The remaining complaints:

- **Few customizable knobs.** The app character is a personal, visual-first
  creative scratchpad that runs off the user's ChatGPT OAuth session. Users
  iterate a lot (portrait/selfie tuning visible in the reference screenshot),
  but the right panel exposes only five controls and the composer is almost
  stateless.
- **Existing knobs are ambiguous.**
  - Quality sub-labels conflate *quality* (최상) with *speed* (빠름) on the same
    axis.
  - The "자유" size tab silently mixes `auto` (model decides) and `custom`
    (manual pixels) — two distinct mental models under one tab.
  - "낮음" moderation communicates its effect only through a small amber color
    and a paragraph of help text. The label itself is neutral.
  - Format options have no hint about why you'd pick one over the others.
  - Count options don't surface the linear cost multiplier.

This spec defines a Phase-1 overhaul that fixes the ambiguities and adds four
new surfaces (style chips, vary/enhance, favorites, theme/density/presets)
tailored to the app's identity. Phase-2 items are listed but not designed
here.

## Principles

1. **Prefer disambiguation over addition.** If a label can carry its own
   meaning, no tooltip should be required.
2. **Match the character.** This is a desktop creative scratchpad — power-user
   conveniences (chips, presets, shortcuts) over enterprise-y verbosity.
3. **Iteration speed is the metric.** Every new surface must either remove
   clicks from a recurring task or remove typing from a recurring task.
4. **Nothing breaks OAuth-only reality.** All new server work continues to go
   through the OAuth proxy; no features assume `OPENAI_API_KEY`.
5. **Each part ships independently.** The eight parts below are designed as
   separable PRs so scope can contract without coupling.

## Approaches Considered

### Approach A — Declutter only (rejected)

Pure label/grouping fixes, no new surfaces.

- Pros: Low risk, quick, zero server work.
- Cons: Leaves the core complaint ("customizable UI too few") unanswered.

### Approach B — Personality-first power-user workstation (recommended)

Disambiguation + four new surfaces: style chips, vary/enhance, favorites,
theme/density/presets.

- Pros: Hits all four directions the user asked for (정리 + 기능 + 워크플로우 +
  외형). Each part is independently shippable. Matches the portrait/selfie
  iteration pattern visible in usage.
- Cons: Bigger surface area; light theme is a real CSS effort.

### Approach C — Graph/Canvas-first (rejected)

Make Node Mode a first-class citizen, add an inpainting canvas / mask layer.

- Pros: Most ambitious, distinctive.
- Cons: Node mode is dev-gated and force-overridden to `classic` in packaged
  builds (`App.tsx:19`). That constraint signals the user hasn't prioritized
  it. Huge scope for unclear demand.

**Chosen:** Approach B.

## Phase 1 Scope (this spec)

1. Disambiguation pass — quality / size / moderation / format / count labels
2. Style modifier chips in the composer
3. Vary button on the current result
4. Enhance prompt (LLM rewrite) in the composer
5. Favorites — sidecar flag, star UI, gallery filter, `F` shortcut
6. Theme — light / dark / system
7. Density — compact / comfortable
8. Presets — save/load the whole settings bundle with curated starters

## Part 1 — Disambiguation

### 1.1 Quality sub-labels

**Current:** `낮음 · 빠름`, `중간 · 균형`, `높음 · 최상`.
**Problem:** Sub-label mixes speed and quality axes.

**New:** Sub-label becomes *approximate time range*:

| label | sub |
|-------|-----|
| 낮음 | ~10–20s |
| 중간 | ~20–40s |
| 높음 | ~40–80s |

Ranges are approximate and intentionally wide. If telemetry later gives us
better numbers, tighten.

**File:** `ui/src/components/RightPanel.tsx` — update `QUALITY_ITEMS`.

### 1.2 Size tab: 자유 → 고급 with two clearly-labeled cards

**Current:** A "자유" tab that contains two options `auto` and `custom`,
visually identical.

**New:** Rename tab to **고급**. Inside, render two cards:

- `자동 · 모델이 결정` (sends `size: "auto"` to the API)
- `직접 입력 · 커스텀 크기` (reveals the `customW × customH` inputs)

Card visuals: icon + heading + one-line help. Only one is selected at a time.
The custom inputs remain only when `직접 입력` is active.

**File:** `ui/src/lib/size.ts` — change the 4th category's `label` to `고급`,
keep both items but style as cards. `SizePicker.tsx` gets a card renderer for
this category only (other categories keep existing pill layout).

### 1.3 Moderation labels

**Current:**
- `자동 · 표준 필터`
- `낮음 · 완화 필터` (amber color only)

**New:**
- `표준 · 기본값`
- `완화 · 경계선 허용` (amber color retained + small ⚠ badge)

Inline help paragraph collapses into a `?` icon with a tooltip; the badge
alone communicates non-default.

**File:** `ui/src/components/RightPanel.tsx` — update `MOD_ITEMS` and replace
the `<p className="option-help">` with an inline icon.

### 1.4 Format sub-labels

| label | sub |
|-------|-----|
| PNG | 투명 지원 |
| JPEG | 작은 용량 |
| WebP | 균형 |

**File:** `ui/src/components/RightPanel.tsx` — `FORMAT_ITEMS`.

### 1.5 Count sub-labels

| label | sub |
|-------|-----|
| 1 | 기본 |
| 2 | ×2 비용 |
| 4 | ×4 비용 |

This is a lightweight cost hint; the detailed estimate stays in
`CostEstimate`.

**File:** `ui/src/components/RightPanel.tsx` — `COUNT_ITEMS`.

## Part 2 — Style modifier chips

A chip panel between the composer header and textarea. Click a chip to toggle
a short token into the prompt; click again to remove it.

### Groups (collapsible accordion)

Default-open: **무드/스타일**. Others collapsed.

1. **무드/스타일** — 시네마틱, 자연광, 수묵화, 3D 렌더, 일러스트, 수채, 유화, 픽셀 아트
2. **인물 톤** — 인물 사진, 셀카, 전신, 얼굴 클로즈업, 반신, 자연스러운 포즈, 피부 보정 최소
3. **퀄리티 모디파이어** — 고해상도, 디테일 풍부, 선명한 초점, 영화적 라이팅
4. **카메라/렌즈** — 35mm 표준, 50mm 표준, 85mm 포트레이트, 광각, 접사

### Data flow

Chips mutate the `prompt` textarea text directly. No parallel state is stored
on the generation payload — whatever ended up in the textarea is the prompt.

Toggle-on rule: append `, <token>` if the prompt is non-empty, else just the
token. Toggle-off rule: remove the exact token using a conservative regex
(`/(^|,\s*)<escaped-token>(?=,|$)/`). If the user manually edits the inserted
token, toggle-off becomes a no-op and the chip falls back to unselected.

Chip selection state is derived from the current prompt string (not stored
separately), which means the state survives prompt autofill, "여기서 이어서"
reuse, and Enhance rewrite with no extra wiring.

### Files

- `ui/src/lib/styleChips.ts` — data definitions + `toggleChip(prompt, token)`
  pure function + `isChipActive(prompt, token)` derivation.
- `ui/src/components/StyleChips.tsx` — the accordion UI.
- `ui/src/components/PromptComposer.tsx` — mount `<StyleChips />` between
  header and textarea.

## Part 3 — Vary button

One-click re-roll of the current result with the same prompt, same refs, same
settings, `count=1`.

### Behavior

- Hidden when `currentImage` is null.
- Clicking triggers a new generation using `currentImage.prompt` (not the
  composer's prompt, which may have been edited for the next request).
- Uses the *current right-panel settings* (quality, size, format, moderation),
  not the settings the result was originally generated with. This matches the
  mental model of "one more like this but at my current settings".
- Uses the current reference-image list.
- `count` is forced to 1 for this call regardless of the setting.
- Requests display in the existing in-flight list like any other generation.

### Files

- `ui/src/store/useAppStore.ts` — add action `varyCurrentResult()` that
  builds a generate payload using `currentImage.prompt` and `count=1` and
  calls the existing generate pipeline with an override parameter. Small
  refactor: `generate()` accepts optional `{ overridePrompt?, overrideCount? }`.
- `ui/src/components/ResultActions.tsx` — insert a `변형` button as the
  primary action. Final button order, left to right:
  `[변형 (primary)] [다운로드] [이미지 복사] [프롬프트 복사] [★ 즐겨찾기] [여기서 이어서]`.
  The `★ 즐겨찾기` slot is added by Part 5; Vary ships without it and the
  star is dropped into the reserved position when Part 5 lands.
- Shortcut: `V` toggles vary when focus is not in an input (defined in
  `ShortcutsHelp.tsx`).

## Part 4 — Enhance prompt

"다듬기" button beside the textarea. Click sends the current prompt to a new
server route that rewrites it via the OAuth proxy (no image generation), and
shows the result in a preview modal with `적용` / `취소`.

### Server

New route `POST /api/enhance-prompt`:

Request body:
```json
{ "prompt": "카리나 셀카", "language": "ko" }
```

Response:
```json
{ "prompt": "카리나 셀카, 자연광, 55mm 렌즈, …" }
```

Implementation: call `runResponses()` (from `lib/oauthStream.js`) with
`tools: []` (no `image_generation`, no `web_search`), `stream: false`, and a
short system prompt: "You are an image-generation prompt engineer. Rewrite
the user's short description as a detailed, concrete image prompt. Keep the
user's language. Stay faithful to the subject. Do not add disclaimers. Return
ONLY the rewritten prompt." Collect `output_text` from the response.

Timeout: 15s. On timeout or OAuth proxy error, return `502` with
`{ error: "ENHANCE_FAILED", message }`.

**File:** `server.js` adds the route; helper logic lives in `lib/enhance.js`
(module export with injectable `runResponses` for tests).

### Client

- "다듬기" button in composer toolbar, right before "현재 결과 사용".
  Disabled when prompt is empty or another enhance is in-flight.
- Click opens `<EnhanceModal />` with the original prompt on the left, the
  rewritten prompt on the right, and two buttons: `적용` (replaces the
  composer prompt) and `취소`.
- The modal shows an "OAuth 사용" micro-badge so the user knows this call
  goes against their ChatGPT session.
- Shortcut: `E` while focus is in the prompt textarea triggers enhance.

### Files

- `lib/enhance.js` (new) — server helper
- `server.js` — new route
- `ui/src/lib/api.ts` — client `enhancePrompt(prompt, language)` function
- `ui/src/components/EnhanceModal.tsx` (new)
- `ui/src/components/PromptComposer.tsx` — add button + mount modal
- `tests/enhance-prompt.test.js` — mock `runResponses`, assert happy path +
  500 + empty prompt

## Part 5 — Favorites

Per-image favorite flag persisted in the sidecar JSON.

### Server

- Add `favorite?: boolean` passthrough in the `listImages` mapping
  (`server.js:286-343`).
- New route `POST /api/history/:filename/favorite` with body
  `{ value: boolean }`. Validates the filename matches an existing sidecar
  (reject path traversal with the same rule used elsewhere), reads the
  sidecar, sets `favorite`, writes it back atomically (write to
  `<path>.tmp`, rename).
- Return the updated item.

### Client

- Star button rendered on:
  - `ResultActions` — in the reserved slot described in Part 3's button order
  - Each `HistoryStrip` thumb as an overlay when favorited
  - Each card inside the gallery modal
- Clicking toggles and optimistically updates local state; on failure,
  revert and show toast.
- Gallery modal adds a `즐겨찾기` filter chip next to the existing search
  input, AND-combined with query/date/session filters.
- Shortcut: `F` toggles favorite of `currentImage` when focus is outside
  inputs.

### Files

- `server.js` — mapping + route
- `lib/favorite.js` (new) — atomic sidecar rewrite + path validation
- `ui/src/types.ts` — extend `GenerateItem` with `favorite?: boolean`
- `ui/src/lib/api.ts` — `setFavorite(filename, value)`
- `ui/src/store/useAppStore.ts` — `toggleFavorite(filename)` action
- `ui/src/components/ResultActions.tsx` — star button
- `ui/src/components/HistoryStrip.tsx` — favorite overlay
- `ui/src/components/GalleryModal.tsx` — filter chip
- `ui/src/components/ShortcutsHelp.tsx` — add `F`
- `tests/favorite.test.js` — sidecar rewrite happy path, missing filename
  rejection, path traversal rejection

## Part 6 — Theme (light / dark / system)

### Design

- A `data-theme="dark" | "light"` attribute on `<html>`. System mode watches
  `prefers-color-scheme` and sets the attribute accordingly.
- All colors become CSS variables under two palettes. The existing palette
  becomes `[data-theme="dark"]`; a new light palette is added under
  `[data-theme="light"]`.
- Choice persisted in `localStorage.ima2.theme` as `"system" | "light" | "dark"`.
  Default: `"system"`.

### Light palette (baseline, subject to visual pass)

Neutral background, soft borders, ink text. Concrete tokens:

```
--bg: #fafaf9;
--surface: #ffffff;
--border: #e7e5e4;
--text: #1c1917;
--text-dim: #57534e;
--accent: (kept same as dark)
--amber: (kept same as dark)
```

Exact values iterate during implementation; the point is the palette exists.

### UI surface

Small control group in the right panel, right above `BillingBar`: three
segmented buttons `시스템 / 라이트 / 다크`.

### Files

- `ui/src/lib/theme.ts` — load/save + apply + watch media query
- `ui/src/components/ViewControls.tsx` (new) — segmented control
- `ui/src/components/RightPanel.tsx` — mount `<ViewControls />`
- Styles: whichever CSS file owns the root color tokens. Phase the light
  palette behind `[data-theme="light"]`.

## Part 7 — Density (compact / comfortable)

`data-density="compact" | "comfortable"` on `<html>`. Defaults to
`comfortable`. Changes:

- Sidebar padding and history-strip thumb size
- Right panel section spacing
- Composer padding
- Option-group gap between pills

Visible as a second segmented control inside `ViewControls`, right below the
theme control.

**Files:** `ui/src/lib/theme.ts` (reused module), CSS vars in the same style
file.

## Part 8 — Presets

Save the entire settings bundle under a name. Load it back in one click.

### Payload

```ts
type PresetPayload = {
  quality: Quality;
  sizePreset: SizePreset;
  customW?: number;
  customH?: number;
  format: Format;
  moderation: Moderation;
  count: Count;
};

type Preset = {
  id: string;            // nanoid
  name: string;          // user-chosen
  createdAt: number;
  builtIn?: boolean;     // true for curated starters
  payload: PresetPayload;
};
```

Stored in `localStorage.ima2.presets`.

### Curated starters (seeded on first run if store is empty)

1. **셀카 고품질** — quality `high`, size `1024x1536`, format `png`,
   moderation `auto`, count `1`.
2. **인스타 사각** — quality `medium`, size `1024x1024`, format `jpeg`,
   moderation `auto`, count `2`.
3. **일러스트 4K** — quality `high`, size `3824x2160`, format `webp`,
   moderation `auto`, count `1`.

Note: style chips are NOT part of the preset payload in Phase 1. Chips are
prompt content, and presets are settings only. (If users ask, we add a
separate "프롬프트 세트" feature later.)

### UI

Top of right panel (above `BillingBar`): a small row.

```
[ ▾ 프리셋: 셀카 고품질 ]  [ 저장 ]
```

- Dropdown lists all presets. A phantom entry "사용자 지정" is shown when the
  current settings don't match any preset exactly.
- Selecting a preset applies its payload to the store.
- `저장` opens an inline input. Empty name aborts; duplicate name asks to
  overwrite.
- Right-click a preset row opens a context menu with `이름 변경` / `삭제`.
  Built-ins are immutable: renaming or deleting a built-in creates a copy
  instead of mutating the original.

### Files

- `ui/src/lib/presets.ts` — load/save + curated seed + `activePresetId(state)`
- `ui/src/components/PresetManager.tsx` (new)
- `ui/src/components/RightPanel.tsx` — mount
- `ui/src/store/useAppStore.ts` — `applyPreset(payload)` action

## Phase 2 (explicitly out of scope)

These are known desirable but deferred. Listed so the user knows they're
remembered.

- **Seed lock / reproducibility.** Contingent on investigating whether the
  Responses API surfaces a seed or request-id we can reuse.
- **Negative keywords.** GPT Image tool does not support a negative prompt
  field; would require prompt engineering glue.
- **Desktop notifications** for background-completed generations.
- **Bulk gallery actions** — select-N, bulk download as zip, bulk delete.
- **Usage totals card** — today / week / all-time tokens.
- **Result inline-edit** — edit prompt directly on the result without going
  back to the composer. (Vary covers the 80% case for Phase 1.)
- **Font-size toggle** — 100 / 110 / 125 %.
- **Sound effect** on completion.

## Risks

1. **OAuth quota impact from Enhance.** `/api/enhance-prompt` consumes the
   user's ChatGPT session quota per call. Mitigation: 15s timeout, small
   `max_output_tokens` cap, explicit "OAuth 사용" badge in the modal.
2. **Light theme fidelity.** Flipping a CSS variable palette looks great in
   isolation but real components often hard-code colors or shadows that do
   not respond to variables. Mitigation: ship light theme behind the toggle
   (default stays dark) and iterate with a visual pass before marking
   complete.
3. **Favorite sidecar rewrites are file I/O on every click.** Low volume;
   atomic write (tmp + rename) is enough. Not worth a DB.
4. **Style chip toggle-off fragility.** If the user manually edits an
   inserted token, toggle-off won't match. Acceptable: the chip simply
   appears unselected and adding it again re-inserts a clean copy.
5. **Preset + custom size edge case.** Loading a preset with `custom` must
   also restore `customW` / `customH`. Handled in `applyPreset` payload
   shape.

## Testing

- `tests/enhance-prompt.test.js` (new) — mock `runResponses`, assert success
  body shape, 502 on OAuth failure, 400 on empty prompt.
- `tests/favorite.test.js` (new) — sidecar rewrite round-trip, reject
  non-existent filename, reject path traversal.
- `tests/size-presets.test.js` (existing) — run after the `자유 → 고급` label
  change to confirm nothing breaks.
- Manual visual pass:
  - Both themes × both densities (4 combos) — walk through empty state,
    generating skeleton, result, gallery, shortcuts modal.
  - Style chips toggle on/off round-trips cleanly.
  - Vary re-uses current result's prompt, not composer's.
  - Preset save → reload app → preset still there, with built-ins still
    marked built-in.

## Open questions

1. Should Vary also have a "with style chips active" variant, or always
   verbatim? Phase 1 answer: verbatim (prompt is the source of truth).
2. Should presets be exportable to a file for backup / sharing between
   installs? Not in Phase 1. Reconsider if asked.
3. Keyboard shortcut letter collisions: `F` for favorite conflicts with no
   existing shortcut; `V` for vary conflicts with `Ctrl+V` paste-as-ref. We
   only bind bare `V` when focus is outside inputs, so paste is unaffected.
   `E` for enhance is bound only when focus is inside the textarea, so it
   doesn't conflict with typing literal "e".

## Sequencing suggestion (for the implementation plan)

Roughly ordered by risk-and-coupling:

1. Part 1 (labels) — purely text changes, ships as a warmup.
2. Part 6 + Part 7 (theme + density) — infrastructure for the visual pass
   that everything else depends on looking right.
3. Part 2 (style chips) — composer-local, no server changes.
4. Part 3 (vary) — store action + one button, no server changes.
5. Part 8 (presets) — client-only, exercises the label changes from Part 1.
6. Part 5 (favorites) — first server route of this batch, smallest surface.
7. Part 4 (enhance) — largest new moving part; ship last once the other
   pieces have validated the UX direction.
