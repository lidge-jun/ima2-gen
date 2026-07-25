import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { errorCodes } from "../lib/errorCodes";
import { useAppStore } from "../store/useAppStore";

const TOAST_VISIBLE_TIMEOUT_MS = 3_000;
const TOAST_MAX_VISIBLE = 5;

export function Toast() {
  const { t } = useI18n();
  const toasts = useAppStore((s) => s.toastLog);
  const errorCards = useAppStore((s) => s.errorCardLog);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const dismissErrorCard = useAppStore((s) => s.dismissErrorCard);
  const [isTabActive, setIsTabActive] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const syncTabActivity = () => setIsTabActive(document.visibilityState === "visible");

    document.addEventListener("visibilitychange", syncTabActivity);
    window.addEventListener("focus", syncTabActivity);
    window.addEventListener("blur", syncTabActivity);
    return () => {
      document.removeEventListener("visibilitychange", syncTabActivity);
      window.removeEventListener("focus", syncTabActivity);
      window.removeEventListener("blur", syncTabActivity);
    };
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    const rowKeys = new Set([
      ...toasts.map((toast) => `toast-${toast.id}`),
      ...errorCards.map((card) => `error-card-${card.id}`),
    ]);

    for (const [key, timer] of timers) {
      if (!rowKeys.has(key) || !isTabActive) {
        clearTimeout(timer);
        timers.delete(key);
      }
    }

    if (!isTabActive) return;

    for (const toast of toasts) {
      const key = `toast-${toast.id}`;
      if (timers.has(key)) continue;
      const timer = setTimeout(() => {
        timers.delete(key);
        dismissToast(toast.id);
      }, TOAST_VISIBLE_TIMEOUT_MS);
      timers.set(key, timer);
    }

    for (const card of errorCards) {
      const key = `error-card-${card.id}`;
      if (timers.has(key)) continue;
      const timer = setTimeout(() => {
        timers.delete(key);
        dismissErrorCard(card.id);
      }, TOAST_VISIBLE_TIMEOUT_MS);
      timers.set(key, timer);
    }
  }, [dismissErrorCard, dismissToast, errorCards, isTabActive, toasts]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  const rows = [
    ...toasts.map((toast) => ({
      kind: "toast" as const,
      id: toast.id,
      key: `toast-${toast.id}`,
      message: toast.message,
      error: toast.error,
      createdAt: toast.createdAt,
    })),
    ...errorCards.map((card) => {
      const spec = errorCodes[card.code] ?? errorCodes.UNKNOWN;
      const title = t(`${spec.cardKey ?? "errorCard.unknown"}.title`);
      const body = t(`${spec.cardKey ?? "errorCard.unknown"}.body`);
      return {
        kind: "error-card" as const,
        id: card.id,
        key: `error-card-${card.id}`,
        message: card.fallbackMessage ? `${title}: ${body} ${card.fallbackMessage}` : `${title}: ${body}`,
        error: true,
        createdAt: card.createdAt,
      };
    }),
  ].sort((a, b) => a.createdAt - b.createdAt).slice(-TOAST_MAX_VISIBLE);

  if (rows.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions removals">
      {rows.map((row) => {
        const cls = ["toast", "visible", row.error ? "error" : "", row.kind === "error-card" ? "toast--card" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <div className={cls} key={row.key} role={row.error ? "alert" : "status"}>
            <span className="toast__message">{row.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              aria-label={t("common.dismiss")}
              onClick={() => (row.kind === "error-card" ? dismissErrorCard(row.id) : dismissToast(row.id))}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
