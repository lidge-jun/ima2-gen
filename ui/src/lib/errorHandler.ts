// 0.09.8 — centralized catch-block dispatcher.
// Reads `err.code` (set by api.ts jsonFetch / postNodeGenerate), falls back to
// pattern classifier, then routes to showToast or showErrorCard based on the
// spec registered in errorCodes.ts.

import { resolveErrorSpec, type ImaErrorCode } from "./errorCodes";
import { t } from "../i18n";

export type ErrorStore = {
  showToast: (message: string, error?: boolean) => void;
  showErrorCard: (code: ImaErrorCode, params?: { fallbackMessage?: string }) => void;
};

export function handleError(err: unknown, store: ErrorStore): { code: ImaErrorCode; message: string } {
  const { code, spec, message } = resolveErrorSpec(err);
  if (spec.surface === "card") {
    store.showErrorCard(code, { fallbackMessage: message });
  } else {
    const toastMsg = spec.toastKey ? t(spec.toastKey) : message || t("toast.generateFailed");
    store.showToast(toastMsg, true);
  }
  return { code, message };
}
