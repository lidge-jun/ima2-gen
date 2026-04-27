import { useEffect, useState, type KeyboardEvent } from "react";
import { useI18n } from "../i18n";
import { useAppStore } from "../store/useAppStore";

const QUICK_COUNTS = [1, 2, 4] as const;

function normalizeCount(value: number): number {
  return Math.min(8, Math.max(1, Math.trunc(value || 1)));
}

export function CountPicker() {
  const count = useAppStore((s) => s.count);
  const setCount = useAppStore((s) => s.setCount);
  const uiMode = useAppStore((s) => s.uiMode);
  const multimodeEnabled = useAppStore((s) => s.multimode);
  const multimodeMaxImages = useAppStore((s) => s.multimodeMaxImages);
  const setMultimodeMaxImages = useAppStore((s) => s.setMultimodeMaxImages);
  const { t } = useI18n();
  const multimode = uiMode === "classic" && multimodeEnabled;
  const value = multimode ? multimodeMaxImages : count;
  const setValue = multimode ? setMultimodeMaxImages : setCount;
  const [open, setOpen] = useState(!QUICK_COUNTS.includes(value as (typeof QUICK_COUNTS)[number]));
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setOpen(!QUICK_COUNTS.includes(value as (typeof QUICK_COUNTS)[number]));
    setDraft(String(value));
  }, [multimode, value]);

  function commit(value = draft) {
    const next = normalizeCount(Number.parseInt(value, 10));
    setValue(next);
    setDraft(String(next));
  }

  function setQuick(value: number) {
    setOpen(false);
    setDraft(String(value));
    setValue(value);
  }

  function step(delta: number) {
    const next = normalizeCount(value + delta);
    setOpen(true);
    setDraft(String(next));
    setValue(next);
  }

  function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div className="option-group count-picker">
      <div className="section-title">{multimode ? t("multimode.maxStages") : t("count.title")}</div>
      <div className="option-row">
        {QUICK_COUNTS.map((quick) => (
          <button
            key={quick}
            type="button"
            className={`option-btn${value === quick && !open ? " active" : ""}`}
            onClick={() => setQuick(quick)}
          >
            {quick}
          </button>
        ))}
        <button
          type="button"
          className={`option-btn${open ? " active" : ""}`}
          onClick={() => {
            setOpen((next) => !next);
            setDraft(String(value));
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
            {value >= 5
              ? t(multimode ? "multimode.highCountHint" : "count.highCountHint")
              : t(multimode ? "multimode.minMaxHint" : "count.minMaxHint")}
          </p>
        </>
      ) : null}
    </div>
  );
}
