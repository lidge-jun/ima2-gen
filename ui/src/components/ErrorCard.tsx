// 0.09.8 — persistent, actionable error card for high-severity errors.
// Unlike Toast (3s auto-dismiss, no CTA), ErrorCard stays until dismissed
// and exposes a context-aware CTA (reauth / reload / retry / dismiss).

import { useAppStore } from "../store/useAppStore";
import { useI18n } from "../i18n";
import { errorCodes } from "../lib/errorCodes";

export function ErrorCard() {
  const { t } = useI18n();
  const card = useAppStore((s) => s.errorCard);
  const dismiss = useAppStore((s) => s.dismissErrorCard);
  if (!card) return null;

  const spec = errorCodes[card.code] ?? errorCodes.UNKNOWN;
  const titleKey = `${spec.cardKey ?? "errorCard.unknown"}.title`;
  const bodyKey = `${spec.cardKey ?? "errorCard.unknown"}.body`;
  const ctaKey = spec.cta ? `${spec.cardKey ?? "errorCard.unknown"}.cta` : null;

  const title = t(titleKey);
  const body = t(bodyKey);
  const cta = ctaKey ? t(ctaKey) : null;

  const onCta = () => {
    switch (spec.cta) {
      case "reload":
        window.location.reload();
        return;
      case "retry":
      case "reauth":
      case "dismiss":
      default:
        dismiss();
    }
  };

  return (
    <div className="error-card-backdrop" role="alertdialog" aria-labelledby="error-card-title">
      <div className="error-card">
        <div className="error-card__icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="error-card__content">
          <h3 id="error-card-title" className="error-card__title">{title}</h3>
          <p className="error-card__body">{body}</p>
          {card.fallbackMessage && (
            <details className="error-card__details">
              <summary>{t("errorCard.details")}</summary>
              <pre>{card.fallbackMessage}</pre>
            </details>
          )}
          <div className="error-card__actions">
            <button type="button" className="btn btn--ghost" onClick={dismiss}>
              {t("errorCard.close")}
            </button>
            {cta && (
              <button type="button" className="btn btn--primary" onClick={onCta}>
                {cta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
