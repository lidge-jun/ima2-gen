import type { ReactNode } from "react";

type ChipProps = {
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  title?: string;
};

/**
 * Chip — selectable pill (Phase 020 kit). Foundation for preset chips (060)
 * and @mention element chips (070); in 020 it ships as the shared primitive.
 */
export function Chip({ selected, onSelect, onRemove, removeLabel, disabled, className, children, title }: ChipProps) {
  return (
    <span
      className={`ctl-chip${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      <button
        type="button"
        className="ctl-chip__body"
        aria-pressed={onSelect ? selected : undefined}
        disabled={disabled}
        title={title}
        onClick={onSelect}
      >
        {children}
      </button>
      {onRemove ? (
        <button
          type="button"
          className="ctl-chip__remove"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
            <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      ) : null}
    </span>
  );
}

type ChipRowProps = {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function ChipRow({ className, children, ariaLabel }: ChipRowProps) {
  return (
    <div className={`ctl-chip-row${className ? ` ${className}` : ""}`} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
