import { useTablistKeys } from "../../hooks/useTablistKeys";

export type GalleryFilterTab<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

/**
 * A `role="tablist"` group with the full WAI-ARIA keyboard contract: arrow/Home/End
 * movement plus a single roving `tabIndex={0}`.
 *
 * The roving index is derived from the first *enabled* tab rather than from selection
 * alone. When the selected tab is disabled (gallery scope without a session), keying it
 * off `aria-selected` would leave every tab at -1 and the group unreachable by keyboard.
 */
export function GalleryFilterTabs<T extends string>({
  className,
  ariaLabel,
  tabs,
  value,
  onChange,
}: {
  className: string;
  ariaLabel: string;
  tabs: GalleryFilterTab<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const onKeyDown = useTablistKeys<HTMLDivElement>();
  const selected = tabs.find((tab) => tab.value === value);
  const rovingValue = selected && !selected.disabled
    ? selected.value
    : tabs.find((tab) => !tab.disabled)?.value;

  return (
    <div className={className} role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === rovingValue ? 0 : -1}
          className={tab.value === value ? "active" : ""}
          onClick={() => onChange(tab.value)}
          disabled={tab.disabled}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
