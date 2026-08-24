import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { shouldDismissOnScroll } from "../../lib/portalDismiss";

export type SelectItem<V extends string> = {
  value: V;
  label: ReactNode;
  sub?: ReactNode;
  disabled?: boolean;
  title?: string;
  stacked?: boolean;
  /** Plain-text used for keyboard typeahead when `label` is not a string. */
  searchText?: string;
};

export type SelectGroup<V extends string> = {
  label?: ReactNode;
  items: ReadonlyArray<SelectItem<V>>;
};

type Props<V extends string> = {
  items?: ReadonlyArray<SelectItem<V>>;
  /** Grouped options with header rows; takes precedence over `items`. */
  groups?: ReadonlyArray<SelectGroup<V>>;
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /**
   * Renders the open list into document.body with fixed positioning so it
   * escapes overflow-clipped containers (sidebar). Closes on scroll/resize
   * so the fixed panel never detaches from its trigger (020, audit R2-2).
   */
  portal?: boolean;
  /** Short label shown on the closed trigger instead of the selected label. */
  triggerLabel?: ReactNode;
  /** Secondary trigger text (e.g. current reasoning effort). */
  triggerSub?: ReactNode;
  /** Trigger label when nothing is selected. */
  placeholder?: ReactNode;
  title?: string;
};

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

const flattenGroups = <V extends string>(
  groups: ReadonlyArray<SelectGroup<V>> | undefined,
  items: ReadonlyArray<SelectItem<V>> | undefined,
): { flat: SelectItem<V>[]; rendered: ReadonlyArray<SelectGroup<V>> } => {
  if (groups && groups.length > 0) {
    const visible = groups.filter((group) => group.items.length > 0);
    return { flat: visible.flatMap((group) => [...group.items]), rendered: visible };
  }
  const fallback = items ?? [];
  return { flat: [...fallback], rendered: [{ items: fallback }] };
};

const enabledEdgeIndex = <V extends string>(
  items: ReadonlyArray<SelectItem<V>>,
  edge: "first" | "last",
  fallback: number,
): number => {
  if (edge === "first") {
    const index = items.findIndex((item) => !item.disabled);
    return index >= 0 ? index : fallback;
  }
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index]?.disabled) return index;
  }
  return fallback;
};

/**
 * Select — solid dropdown listbox (Phase 020 kit). Replaces native <select>
 * where item metadata (sub text) matters. Full keyboard support:
 * Enter/Space/ArrowDown open, Arrow keys move, Enter selects, Escape closes.
 * Supports grouped options and portal rendering for clipped containers (020).
 */
export function Select<V extends string>({
  items,
  groups,
  value,
  onChange,
  ariaLabel,
  className,
  id,
  disabled,
  portal = false,
  triggerLabel,
  triggerSub,
  placeholder,
  title,
}: Props<V>) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos>({ top: 0, left: 0, width: 200, maxHeight: 260 });
  const { flat, rendered } = flattenGroups(groups, items);
  const isEmpty = flat.length === 0;
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, flat.findIndex((it) => it.value === value)),
  );
  const typeaheadRef = useRef<{ buffer: string; at: number }>({ buffer: "", at: 0 });

  const selected = flat.find((it) => it.value === value);
  const optionId = (index: number) => `${listId}-opt-${index}`;

  const searchTextOf = (it: SelectItem<V>): string => {
    if (it.searchText) return it.searchText;
    if (typeof it.label === "string") return it.label;
    return it.value;
  };

  // Select-only combobox typeahead (APG): printable keys accumulate in a 1s
  // buffer and move the active option to the next prefix match (audit A2).
  const typeahead = (key: string) => {
    const now = Date.now();
    const state = typeaheadRef.current;
    state.buffer = now - state.at > 1000 ? key : state.buffer + key;
    state.at = now;
    const query = state.buffer.toLowerCase();
    const start = state.buffer.length === 1 ? activeIndex + 1 : activeIndex;
    for (let i = 0; i < flat.length; i += 1) {
      const index = (start + i + flat.length) % flat.length;
      const item = flat[index];
      if (!item || item.disabled) continue;
      if (searchTextOf(item).toLowerCase().startsWith(query)) {
        setActiveIndex(index);
        return;
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      // A portaled list lives outside rootRef; keep it clickable (audit R2-2).
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  useLayoutEffect(() => {
    if (!portal || !open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const gutter = 12;
      const availableWidth = Math.max(0, window.innerWidth - gutter * 2);
      const width = Math.min(300, availableWidth, Math.max(190, rect.width));
      const maxLeft = Math.max(gutter, window.innerWidth - width - gutter);
      const left = Math.min(Math.max(gutter, rect.left), maxLeft);
      const below = window.innerHeight - rect.bottom - gutter;
      const above = rect.top - gutter;
      const direction = below >= 160 || below >= above ? "down" : "up";
      const availableHeight = Math.max(0, direction === "down" ? below : above);
      const maxHeight = Math.min(420, availableHeight);
      const estimatedHeight = 8 + flat.length * 44;
      const renderedHeight = listRef.current?.scrollHeight ?? estimatedHeight;
      const height = Math.min(renderedHeight, maxHeight);
      setMenuPos({
        top: direction === "down"
          ? rect.bottom + 4
          : Math.max(gutter, rect.top - height - 4),
        left,
        width,
        maxHeight,
      });
    }
    const close = () => setOpen(false);
    const closeOnScroll = (event: Event) => {
      // Issue #119: the capture-phase listener also sees scrolls raised inside
      // the portaled list, which is itself a scroll container. Only outside
      // scrolls detach the fixed panel from its trigger.
      if (!shouldDismissOnScroll(event, listRef.current)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [portal, open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openList = () => {
    if (isEmpty) return;
    setActiveIndex(Math.max(0, flat.findIndex((it) => it.value === value)));
    setOpen(true);
  };

  useEffect(() => {
    if (!isEmpty) return;
    setOpen(false);
    setActiveIndex(0);
  }, [isEmpty]);

  const move = (step: number) => {
    let next = activeIndex;
    for (let i = 0; i < flat.length; i += 1) {
      next = (next + step + flat.length) % flat.length;
      if (!flat[next]?.disabled) break;
    }
    setActiveIndex(next);
  };

  const commit = (index: number) => {
    const item = flat[index];
    if (!item || item.disabled) return;
    onChange(item.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(enabledEdgeIndex(flat, "first", activeIndex));
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(enabledEdgeIndex(flat, "last", activeIndex));
    } else if (event.key === "Enter" || event.key === " ") {
      // Space participates in typeahead when a buffer is live (APG).
      if (event.key === " " && Date.now() - typeaheadRef.current.at <= 1000 && typeaheadRef.current.buffer) {
        event.preventDefault();
        typeahead(" ");
        return;
      }
      event.preventDefault();
      commit(activeIndex);
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      typeahead(event.key);
    }
  };

  let flatIndex = -1;
  const list = open && !isEmpty ? (
    <ul
      className={`ctl-select__list${portal ? " ctl-select__list--portal" : ""}`}
      role="listbox"
      id={listId}
      ref={listRef}
      style={portal ? {
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        maxHeight: menuPos.maxHeight,
      } : undefined}
    >
      {rendered.map((group, groupIdx) => (
        <li key={`g-${groupIdx}`} role="presentation" className="ctl-select__group">
          {group.label ? <div className="ctl-select__group-label">{group.label}</div> : null}
          <ul
            role="group"
            aria-label={typeof group.label === "string" ? group.label : undefined}
            className="ctl-select__group-items"
          >
            {group.items.map((it) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <li
                  key={it.value}
                  role="option"
                  id={optionId(index)}
                  data-index={index}
                  aria-selected={it.value === value}
                  aria-disabled={it.disabled || undefined}
                  title={it.title}
                  className={`ctl-select__item${it.value === value ? " is-selected" : ""}${
                    index === activeIndex ? " is-active" : ""
                  }${it.disabled ? " is-disabled" : ""}${it.stacked ? " is-stacked" : ""}`}
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                >
                  <span className="ctl-select__item-label">{it.label}</span>
                  {it.sub ? <span className="ctl-select__item-sub">{it.sub}</span> : null}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  ) : null;

  return (
    <div className={`ctl-select${className ? ` ${className}` : ""}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`ctl-select__trigger${open ? " is-open" : ""}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && flat[activeIndex] ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        disabled={disabled || isEmpty}
        title={title}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className="ctl-select__value">
          {triggerLabel ?? selected?.label ?? placeholder ?? ""}
        </span>
        {(triggerSub ?? selected?.sub)
          ? <span className="ctl-select__value-sub">{triggerSub ?? selected?.sub}</span>
          : null}
        <svg
          className="ctl-select__caret"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {list ? (portal ? createPortal(list, document.body) : list) : null}
    </div>
  );
}
