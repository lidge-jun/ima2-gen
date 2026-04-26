import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { THEME_FAMILIES, type ThemeFamily, type ThemePreference } from "../types";

const MODE_OPTIONS: ThemePreference[] = ["system", "dark", "light"];

export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const themeFamily = useAppStore((s) => s.themeFamily);
  const setThemeFamily = useAppStore((s) => s.setThemeFamily);

  const [familyOpen, setFamilyOpen] = useState(false);
  const familyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!familyOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!familyRef.current) return;
      if (!familyRef.current.contains(e.target as Node)) {
        setFamilyOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFamilyOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [familyOpen]);

  const familyLabel = (family: ThemeFamily) => t(`theme.family.${family}`);

  return (
    <div className="theme-toggle" aria-label={t("theme.label")}>
      <div className="theme-toggle__row">
        <span className="theme-toggle__label" id="theme-style-label">
          {t("theme.styleLabel")}
        </span>
        <div className="theme-toggle__family" ref={familyRef}>
          <button
            type="button"
            className="theme-toggle__family-trigger"
            aria-haspopup="listbox"
            aria-expanded={familyOpen}
            aria-labelledby="theme-style-label"
            onClick={() => setFamilyOpen((v) => !v)}
          >
            <span
              className={`theme-toggle__family-dot theme-toggle__family-dot--${themeFamily}`}
              aria-hidden="true"
            />
            <span className="theme-toggle__family-name">{familyLabel(themeFamily)}</span>
            <span className="theme-toggle__family-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          {familyOpen ? (
            <ul className="theme-toggle__family-menu" role="listbox" aria-labelledby="theme-style-label">
              {THEME_FAMILIES.map((family) => (
                <li key={family} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={themeFamily === family}
                    className={`theme-toggle__family-option ${
                      themeFamily === family ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setThemeFamily(family);
                      setFamilyOpen(false);
                    }}
                  >
                    <span
                      className={`theme-toggle__family-dot theme-toggle__family-dot--${family}`}
                      aria-hidden="true"
                    />
                    <span className="theme-toggle__family-name">{familyLabel(family)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="theme-toggle__row">
        <span className="theme-toggle__label" id="theme-mode-label">
          {t("theme.modeLabel")}
        </span>
        <div
          className="theme-toggle__mode"
          role="group"
          aria-labelledby="theme-mode-label"
        >
          {MODE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`theme-toggle__btn ${theme === option ? "is-active" : ""}`}
              onClick={() => setTheme(option)}
              aria-pressed={theme === option}
              title={t(`theme.${option}`)}
            >
              {t(`theme.${option}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
