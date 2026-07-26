import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ElementMentionKind } from "./ElementMentionChip";

export type ElementMentionOption = {
  id: string;
  name: string;
  kind: ElementMentionKind;
  thumbnail?: string;
  tags?: readonly string[];
};

export interface MentionMenuPosition {
  left: number;
  top: number;
  placement: "bottom" | "top";
  maxHeight: number;
}

type ElementMentionMenuProps = {
  open: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  caret: number;
  query: string;
  elements: readonly ElementMentionOption[];
  ariaLabel: string;
  emptyLabel: string;
  kindLabel(kind: ElementMentionKind): string;
  onSelect(element: ElementMentionOption): void;
  onClose(): void;
  onActiveChange?(index: number): void;
};

const VIEWPORT_PADDING = 12;
const MIN_BOTTOM_SPACE = 240;

function getCaretRect(textarea: HTMLTextAreaElement, caret: number): DOMRect {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const properties = ["boxSizing", "width", "height", "overflowX", "overflowY", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textTransform", "textIndent", "textAlign", "wordSpacing", "tabSize"] as const;
  properties.forEach((property) => { mirror.style[property] = style[property]; });
  mirror.style.cssText += ";position:fixed;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;top:0;left:-9999px;";
  mirror.textContent = textarea.value.slice(0, caret);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(caret) || ".";
  mirror.append(marker);
  document.body.append(mirror);
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();
  const hostRect = textarea.getBoundingClientRect();
  return new DOMRect(hostRect.left + markerRect.left - mirrorRect.left - textarea.scrollLeft, hostRect.top + markerRect.top - mirrorRect.top - textarea.scrollTop, 1, markerRect.height || parseFloat(style.lineHeight) || 16);
}

function calculatePosition(textarea: HTMLTextAreaElement, caret: number): MentionMenuPosition {
  const rect = getCaretRect(textarea, caret);
  const below = window.innerHeight - rect.bottom;
  const placement = below < MIN_BOTTOM_SPACE ? "top" : "bottom";
  const available = placement === "bottom" ? below : rect.top;
  return {
    left: Math.max(VIEWPORT_PADDING, Math.min(rect.left, window.innerWidth - 332)),
    top: placement === "bottom" ? rect.bottom + 6 : Math.max(VIEWPORT_PADDING, rect.top - Math.min(320, available - 8)),
    placement,
    maxHeight: Math.max(120, Math.min(320, available - 12)),
  };
}

function isMobile(): boolean { return window.matchMedia("(max-width: 640px)").matches; }

export function ElementMentionMenu({ open, textareaRef, caret, query, elements, ariaLabel, emptyLabel, kindLabel, onSelect, onClose, onActiveChange }: ElementMentionMenuProps) {
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MentionMenuPosition | null>(null);
  const [mobile, setMobile] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const visibleElements = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return elements;
    return elements.filter((element) => [element.name, ...(element.tags ?? [])].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [elements, query]);

  const setActive = (index: number) => { setActiveIndex(index); onActiveChange?.(index); };
  const selectActive = () => { const element = visibleElements[activeIndex]; if (element) onSelect(element); };

  useLayoutEffect(() => {
    if (!open || !textareaRef.current) return;
    const update = () => { if (!textareaRef.current) { onClose(); return; } setMobile(isMobile()); setPosition(calculatePosition(textareaRef.current, caret)); };
    const frameUpdate = () => requestAnimationFrame(update);
    update();
    window.addEventListener("resize", frameUpdate);
    textareaRef.current.addEventListener("scroll", frameUpdate);
    return () => { window.removeEventListener("resize", frameUpdate); textareaRef.current?.removeEventListener("scroll", frameUpdate); };
  }, [open, textareaRef, caret, onClose]);

  useEffect(() => { setActive(0); }, [query, visibleElements.length]);
  useEffect(() => {
    if (!open) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.setAttribute("aria-controls", listId);
    textarea.setAttribute("aria-expanded", "true");
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== textarea) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive((activeIndex + (event.key === "ArrowDown" ? 1 : -1) + visibleElements.length) % Math.max(1, visibleElements.length)); }
      else if (event.key === "Home") { event.preventDefault(); setActive(0); }
      else if (event.key === "End") { event.preventDefault(); setActive(Math.max(0, visibleElements.length - 1)); }
      else if (event.key === "Enter") { if (visibleElements.length) { event.preventDefault(); selectActive(); } }
      else if (event.key === "Tab" && visibleElements.length) { selectActive(); }
    };
    textarea.addEventListener("keydown", onKeyDown);
    return () => { textarea.removeAttribute("aria-controls"); textarea.removeAttribute("aria-expanded"); textarea.removeAttribute("aria-activedescendant"); textarea.removeEventListener("keydown", onKeyDown); };
  }, [open, textareaRef, listId, activeIndex, visibleElements, onClose]);
  useEffect(() => { const textarea = textareaRef.current; const option = visibleElements[activeIndex]; if (textarea && option) textarea.setAttribute("aria-activedescendant", `${listId}-${option.id}`); }, [activeIndex, visibleElements, listId, textareaRef]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(".is-active")?.scrollIntoView({ block: "nearest" }); }, [activeIndex]);

  if (!open || !position || typeof document === "undefined") return null;
  const content = <section className={`element-mention-menu${mobile ? " is-mobile" : ""}`} style={mobile ? undefined : { left: position.left, top: position.top, maxHeight: position.maxHeight }} aria-label={ariaLabel}>
    <ul id={listId} className="element-mention-menu__list" role="listbox" ref={listRef}>
      {visibleElements.length ? visibleElements.map((element, index) => <li key={element.id} id={`${listId}-${element.id}`} role="option" aria-selected={index === activeIndex} className={`element-mention-menu__option${index === activeIndex ? " is-active" : ""}`} onPointerEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); onSelect(element); }}>
        {element.thumbnail ? <img src={element.thumbnail} alt="" className="element-mention-menu__thumbnail" /> : <span className="element-mention-menu__thumbnail is-empty" aria-hidden="true" />}
        <span className="element-mention-menu__copy"><strong>{element.name}</strong><small>{kindLabel(element.kind)}</small></span>
      </li>) : <li className="element-mention-menu__empty" role="presentation">{emptyLabel}</li>}
    </ul>
  </section>;
  return createPortal(content, document.body);
}
