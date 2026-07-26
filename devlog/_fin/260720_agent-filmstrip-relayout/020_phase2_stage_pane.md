# 020 — Phase 2: Stage Pane + Filmstrip + Tools Overlay

Goal: the generated image becomes the hero. `AgentStagePane` (hero
preview + caption + horizontal filmstrip) replaces the always-mounted
`AgentRightSidebar` as the desktop right column. The 6-tab content
becomes a desktop overlay dialog. Tablet keeps its persistent
`AgentRightSidebar` column (non-overlay) — unchanged from Phase 1.
Phase 1's 64px rail frame already freed the width this grid needs.

## File change map

| Action | Path |
|--------|------|
| NEW | `ui/src/components/agent/AgentStagePane.tsx` |
| NEW | `ui/src/styles/agent-stage.css` |
| MODIFY | `ui/src/components/agent/AgentWorkspace.tsx` |
| MODIFY | `ui/src/components/agent/AgentRightSidebar.tsx` (overlay wrapper + shared body) |
| MODIFY | `ui/src/components/agent/AgentImagePane.tsx` (`export function AgentVideoPreview`) |
| MODIFY | `ui/src/components/agent/AgentIcons.tsx` (NEW `SlidersIcon`) |
| MODIFY | `ui/src/styles/agent-workspace.css` (body grid values) |
| MODIFY | `ui/src/styles/agent-workspace-sidebar.css` (overlay rows rule) |
| MODIFY | `ui/src/main.tsx` (`import "./styles/agent-stage.css";` after the other agent style imports) |
| MODIFY | `ui/src/i18n/en.json` + `ui/src/i18n/ko.json` (3 keys, table below) |
| MODIFY | `tests/agent-mode-layout-contract.test.js` |
| MODIFY | `tests/agent-mode-frontend-contract.test.js` |
| MODIFY | `tests/agent-mode-right-sidebar-contract.test.js` |

i18n keys (`agent` namespace, both locales):

| Key | en | ko |
|-----|----|----|
| `stageEmptyHint` | "Send your first request to see the image here" | "첫 요청을 보내면 여기에서 이미지를 확인할 수 있습니다" |
| `openTools` | "Open tools panel" | "도구 패널 열기" |
| `closeTools` | "Close tools panel" | "도구 패널 닫기" |

## 1. NEW `AgentStagePane.tsx` (complete component)

```tsx
import { useCallback, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n";
import { ImageIcon, SlidersIcon } from "./AgentIcons";
import { AgentResultThumb } from "./AgentResultThumb";
import { AgentSafeImage } from "./AgentSafeImage";
import { AgentVideoPreview } from "./AgentImagePane";
import { isVideoUrl } from "../../lib/videoMedia";
import type { AgentImageHandle } from "./agentTypes";

type Props = {
  currentImage: AgentImageHandle | null;
  images: AgentImageHandle[];
  onImageSelect: (imageId: string) => void;
  onOpenPanel: () => void;
};

export function AgentStagePane({ currentImage, images, onImageSelect, onOpenPanel }: Props) {
  const { t } = useI18n();
  const thumbRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const currentIndex = useMemo(
    () => images.findIndex((image) => image.id === currentImage?.id),
    [currentImage?.id, images],
  );

  useEffect(() => {
    if (!currentImage?.id) return;
    thumbRefs.current[currentImage.id]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentImage?.id]);

  const selectByIndex = useCallback((index: number) => {
    const image = images[index];
    if (image) onImageSelect(image.id);
  }, [images, onImageSelect]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (images.length === 0) return;
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = Math.max(0, baseIndex - 1);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = Math.min(images.length - 1, baseIndex + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = images.length - 1;
    if (nextIndex === null || nextIndex === baseIndex) return;
    event.preventDefault();
    selectByIndex(nextIndex);
  }, [currentIndex, images.length, selectByIndex]);

  return (
    <section className="agent-stage" aria-label={t("agent.imagePane")}>
      <header className="agent-pane-header">
        <div className="agent-pane-header__title">
          <span>{t("agent.imagePane")}</span>
          <strong>{t("agent.currentImage")}</strong>
        </div>
        <button type="button" className="agent-stage__tools" onClick={onOpenPanel} aria-label={t("agent.openTools")} title={t("agent.openTools")}>
          <SlidersIcon size={16} />
        </button>
      </header>
      <div
        className="agent-stage__viewport"
        tabIndex={images.length > 1 ? 0 : undefined}
        onKeyDown={handleKeyDown}
        aria-label={images.length > 1 ? t("agent.variants") : undefined}
      >
        {currentImage ? (
          isVideoUrl(currentImage.url)
            ? <AgentVideoPreview key={currentImage.id} image={currentImage} />
            : <AgentSafeImage src={currentImage.url} alt={currentImage.prompt ?? t("agent.imageAlt")} fallbackClassName="agent-stage__empty" iconSize={34} />
        ) : (
          <div className="agent-stage__empty">
            <ImageIcon size={34} />
            <span>{t("agent.noImage")}</span>
            <small>{t("agent.stageEmptyHint")}</small>
          </div>
        )}
      </div>
      <div className="agent-stage__caption">
        <strong>{currentImage?.filename ?? "-"}</strong>
        <span>{currentImage?.prompt ?? currentImage?.revisedPrompt ?? ""}</span>
      </div>
      <div className="agent-stage__filmstrip" aria-label={t("agent.variants")} onKeyDown={handleKeyDown}>
        {images.map((image) => (
          <AgentResultThumb
            key={image.id}
            ref={(node) => { thumbRefs.current[image.id] = node; }}
            image={image}
            selected={image.id === currentImage?.id}
            onSelect={onImageSelect}
          />
        ))}
      </div>
    </section>
  );
}
```

(Verify `AgentResultThumb` ref forwarding and `AgentSafeImage` props at
build time — signatures confirmed present in `AgentImagePane` usage.)

`AgentIcons.tsx` — add alongside existing icons, same conventions:

```tsx
export function SlidersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="8" x2="20" y2="8" /><circle cx="9" cy="8" r="2.5" fill="var(--surface, #101014)" />
      <line x1="4" y1="16" x2="20" y2="16" /><circle cx="15" cy="16" r="2.5" fill="var(--surface, #101014)" />
    </svg>
  );
}
```

## 2. `AgentWorkspace.tsx`

- `const [toolsPanelOpen, setToolsPanelOpen] = useState(false);`
- `const closeToolsPanel = useCallback(() => setToolsPanelOpen(false), []);`
  stable identity (round-4 Blocker 3): `useAgentDialogFocus` depends on
  its close callback; an inline closure recreated on every workspace poll
  (1.5s/4s refresh) would re-run the focus effect and yank keyboard focus
  back to the first control. All overlay close sites use `closeToolsPanel`.
- `const isDesktop = layoutMode === "desktop-three-pane" || layoutMode === "desktop-rail";`
- Body render — before:
```tsx
<AgentChatPane ... />
{showRightSidebar ? <AgentRightSidebar ...props /> : null}
```
  after:
```tsx
<AgentChatPane ... />
{isDesktop
  ? <AgentStagePane currentImage={currentImage} images={images} onImageSelect={selectImage} onOpenPanel={() => setToolsPanelOpen(true)} />
  : showRightSidebar ? <AgentRightSidebar ...props /> : null}
```
- After the drawer/sheets block:
```tsx
{isDesktop && toolsPanelOpen ? <AgentRightSidebar ...props overlay onClose={closeToolsPanel} /> : null}
```
- `onOpenModelTab`: `() => { setSidebarTab("model"); setToolsPanelOpen(true); }`.
- `showRightSidebar` derivation UNCHANGED (still gates the tablet column).
- Model-pill single-render criterion (round-3 Blocker 6, LOCKED
  interpretation): "exactly once" applies to PERSISTENT shell chrome —
  the chat-header `AgentModelSelector` is the single persistent badge.
  The overlay's Model tab intentionally renders a second selector while
  open, standard settings-dialog behavior; a transient dialog does not
  violate the criterion. Goalplan c-polish reads accordingly.

## 3. `AgentRightSidebar.tsx` — shared body, two wrappers (LOCKED strategy)

Refactor (typed — wp2 audit fold): define
`type SidebarBodyProps = Omit<Props, "overlay" | "onClose">;` and extract
the current return body (tabs + panels) into a local
`function SidebarBody(props: SidebarBodyProps)` in the same file (no new
file, no export). SidebarBody owns the existing `useI18n()` call and the
`panelProps` helper, and returns a fragment wrapping the current
tabs+panels markup. Both wrappers render `<SidebarBody {...rest} />`:

```tsx
export function AgentRightSidebar({ overlay, onClose, ...rest }: Props) {
  const { t } = useI18n();
  const panelRef = useAgentDialogFocus(overlay === true, onClose ?? (() => {}));
  if (overlay) {
    return (
      <div className="agent-dialog agent-dialog--tools" role="presentation">
        <button type="button" className="agent-dialog__backdrop" onClick={onClose} aria-label={t("agent.closeTools")} />
        <section ref={panelRef} className="agent-right-sidebar agent-right-sidebar--overlay" role="dialog" aria-modal="true" aria-label={t("agent.openTools")}>
          <header className="agent-right-sidebar__overlay-header">
            <strong>{t("agent.openTools")}</strong>
            <button type="button" onClick={onClose} aria-label={t("agent.closeTools")}><CloseIcon size={17} /></button>
          </header>
          <SidebarBody {...rest} />
        </section>
      </div>
    );
  }
  return <aside className="agent-right-sidebar"><SidebarBody {...rest} /></aside>;
}
```

Props gain `overlay?: boolean; onClose?: () => void;`. `CloseIcon` and
`useAgentDialogFocus` imports added. NOTE: `useAgentDialogFocus` is
called unconditionally (hook rules) with `overlay === true` as its
active flag — verify the hook signature accepts an `open` boolean
(`useAgentDialogFocus(open, close)`, confirmed at audit).

## 4. CSS

### 4a. `agent-workspace.css` body grid

- `:59` (three-pane) `minmax(420px, 0.95fr) minmax(520px, 1.05fr)` →
  `minmax(360px, 0.42fr) minmax(520px, 0.58fr)`
- `:64` (desktop-rail) `minmax(420px, 1fr) minmax(440px, 1fr)` →
  `minmax(340px, 1fr) minmax(440px, 1.2fr)`
  (fits: 1000px viewport − 52px nav − 64px rail = 884px ≥ 340+440.)

### 4b. NEW `agent-stage.css`

```css
.agent-stage {
  min-width: 0; min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  border-left: 1px solid var(--border);
  background: var(--surface);
  overflow: hidden;
}
.agent-stage__viewport {
  position: relative; overflow: hidden; min-height: 0;
  display: grid; place-items: center;
  background: var(--bg);
}
.agent-stage__viewport img { max-width: 100%; max-height: 100%; object-fit: contain; }
.agent-stage__empty { display: grid; place-items: center; gap: 6px; color: var(--text-dim); text-align: center; }
.agent-stage__empty small { max-width: 32ch; }
.agent-stage__caption { display: grid; gap: 2px; padding: 10px 14px; border-top: 1px solid var(--border); }
.agent-stage__caption strong { font-weight: 600; font-size: 13px; }
.agent-stage__caption span { color: var(--text-dim); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-stage__filmstrip { display: flex; gap: 8px; overflow-x: auto; padding: 10px 14px; border-top: 1px solid var(--border); }
.agent-stage__filmstrip .agent-result-thumb { width: 72px; height: 72px; flex: none; }
.agent-stage__filmstrip .agent-result-thumb.is-selected {
  border-color: var(--agent-rail-ring, #f5f5f7);
  box-shadow: inset 0 0 0 2px var(--agent-rail-ring, #f5f5f7);
}
.agent-stage__tools {
  width: 30px; height: 30px;
  display: grid; place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim);
}
.agent-stage__tools:hover { color: var(--text); border-color: var(--border-strong); }
.agent-stage__tools:focus-visible { outline: 2px solid var(--agent-rail-ring, #f5f5f7); outline-offset: 1px; }
.agent-dialog--tools .agent-right-sidebar--overlay {
  position: absolute; inset: 0 0 0 auto;
  width: min(420px, 90vw); height: 100%;
  z-index: 30; background: var(--surface);
  border-left: 1px solid var(--border); overflow-y: auto;
}
```

### 4c. `agent-workspace-sidebar.css` overlay rows (round-2 Blocker 4)

```css
.agent-right-sidebar--overlay { grid-template-rows: auto auto minmax(0, 1fr); }
.agent-right-sidebar__overlay-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); }
```

(base `.agent-right-sidebar` keeps `auto minmax(0,1fr)`; the overlay
modifier adds the header row; panel keeps `min-height: 0`.)

## 5. Test amendments (exact expressions)

`tests/agent-mode-layout-contract.test.js`:
- `:35` `minmax\(420px, 0\.95fr\) minmax\(520px, 1\.05fr\)` →
  `minmax\(360px, 0\.42fr\) minmax\(520px, 0\.58fr\)`
- `:36` `minmax\(420px, 1fr\) minmax\(440px, 1fr\)` →
  `minmax\(340px, 1fr\) minmax\(440px, 1\.2fr\)`

`tests/agent-mode-frontend-contract.test.js`:
- `:113-114` same two substitutions.
- ADD `assert.match(workspace, /AgentStagePane/);` and
  `assert.match(workspace, /toolsPanelOpen/);`

`tests/agent-mode-right-sidebar-contract.test.js`:
- ADD `assert.match(sidebar, /agent-dialog--tools/);`,
  `assert.match(sidebar, /useAgentDialogFocus/);`,
  `assert.match(sidebar, /SidebarBody/);`
- Existing tab/panel assertions remain (SidebarBody keeps the markup).

## Accept criteria

- Desktop 1440x900: chat left, stage right, hero image dominant,
  filmstrip under caption; overlay opens via stage header sliders button
  AND chat "View in Model tab"; closes via Esc, close button, backdrop.
- Desktop 1000x700 (`desktop-rail`): no x-overflow (884px ≥ 780px min).
- Video selected: preview contained inside stage viewport.
- Tablet 900x900: right column unchanged (6 tabs), no overlay.
- typecheck + typecheck:tests + npm test + ui build green.
