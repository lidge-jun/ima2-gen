import type { ErrorSpec } from "./errorCodes";

export const PRIORITY_ERROR_CLASSES = ["BILLING_REQUIRED", "AUTH_INVALID", "AUTH_EXPIRED"] as const;
export type PriorityErrorClass = (typeof PRIORITY_ERROR_CLASSES)[number];

export const ERROR_CLASS_SPECS = {
  AUTH_INVALID: { surface: "card", cardKey: "errorCard.authClass", cta: "reauth" },
  AUTH_EXPIRED: { surface: "card", cardKey: "errorCard.authClass", cta: "reauth" },
  BILLING_REQUIRED: { surface: "card", cardKey: "errorCard.billingRequired" },
  RATE_LIMITED: { surface: "toast", toastKey: "toast.errorClass.rateLimited", cta: "retry" },
  PROVIDER_TIMEOUT: { surface: "toast", toastKey: "toast.errorClass.providerTimeout", cta: "retry" },
  NETWORK_FAILURE: { surface: "toast", toastKey: "toast.errorClass.networkFailure", cta: "retry" },
  CONTENT_REJECTED: { surface: "toast", toastKey: "toast.errorClass.contentRejected" },
  CAPABILITY_UNSUPPORTED: { surface: "toast", toastKey: "toast.errorClass.capabilityUnsupported" },
  MODEL_UNAVAILABLE: { surface: "toast", toastKey: "toast.errorClass.modelUnavailable" },
  INTERNAL_STATE_ERROR: { surface: "toast", toastKey: "toast.errorClass.internalState", cta: "reload" },
} as const satisfies Record<string, ErrorSpec>;

export type KnownErrorClass = keyof typeof ERROR_CLASS_SPECS;

export function isPriorityErrorClass(value: unknown): value is PriorityErrorClass {
  return typeof value === "string" && (PRIORITY_ERROR_CLASSES as readonly string[]).includes(value);
}

export function classSpec(value: unknown): ErrorSpec | undefined {
  if (typeof value !== "string") return undefined;
  return (ERROR_CLASS_SPECS as Record<string, ErrorSpec>)[value];
}
