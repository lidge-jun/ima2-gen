import type { ReactNode } from "react";

export type OptionItem<V extends string> = {
  value: V;
  label: ReactNode;
  sub?: ReactNode;
  color?: string;
};

type Props<V extends string> = {
  title?: string;
  items: ReadonlyArray<OptionItem<V>>;
  value: V;
  onChange: (v: V) => void;
};

export function OptionGroup<V extends string>({ title, items, value, onChange }: Props<V>) {
  return (
    <div className="option-group">
      {title ? <div className="section-title">{title}</div> : null}
      <div className="option-row">
        {items.map((it) => (
          <button
            key={it.value}
            className={`option-btn${it.value === value ? " active" : ""}`}
            style={it.color ? { color: it.color } : undefined}
            onClick={() => onChange(it.value)}
            type="button"
          >
            {it.label}
            {it.sub ? (
              <>
                <br />
                <span className="option-sub">{it.sub}</span>
              </>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
