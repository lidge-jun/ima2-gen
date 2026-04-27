import { useState, type KeyboardEvent } from "react";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";

const QUICK_COUNTS = [1, 2, 4] as const;

function normalizeCount(value: number): number {
  return Math.min(8, Math.max(1, Math.trunc(value || 1)));
}

export function CountPicker() {
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);
  const { t } = useI18n();
  const [open, setOpen] = useState(!QUICK_COUNTS.includes(count as (typeof QUICK_COUNTS)[number]));
  const [draft, setDraft] = useState(String(count));

  function commit(value = draft) {
    const next = normalizeCount(Number.parseInt(value, 10));
    setCount(next);
    setDraft(String(next));
  }

  function setQuick(value: number) {
    setOpen(false);
    setDraft(String(value));
    setCount(value);
  }

  function step(delta: number) {
    const next = normalizeCount(count + delta);
    setOpen(true);
    setDraft(String(next));
    setCount(next);
  }

  function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div className="option-group count-picker">
      <div className="section-title">{t("count.title")}</div>
      <div className="option-row">
        {QUICK_COUNTS.map((value) => (
          <button
            key={value}
            type="button"
            className={`option-btn${count === value && !open ? " active" : ""}`}
            onClick={() => setQuick(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className={`option-btn${open ? " active" : ""}`}
          onClick={() => {
            setOpen((next) => !next);
            setDraft(String(count));
          }}
        >
          {t("count.customPlus")}
        </button>
      </div>
      {open ? (
        <>
          <div className="count-picker__custom">
            <button type="button" className="count-picker__step" onClick={() => step(-1)} aria-label={t("count.decrease")}>
              -
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="count-picker__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onBlur={() => commit()}
              onKeyDown={commitOnEnter}
              aria-label={t("count.customLabel")}
            />
            <button type="button" className="count-picker__step" onClick={() => step(1)} aria-label={t("count.increase")}>
              +
            </button>
          </div>
          <p className="option-help">
            {count >= 5 ? t("count.highCountHint") : t("count.minMaxHint")}
          </p>
        </>
      ) : null}
    </div>
  );
}
