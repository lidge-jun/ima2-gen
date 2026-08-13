export const GENERATION_ERROR_CLASSES = [
  "AUTH_INVALID",
  "AUTH_EXPIRED",
  "BILLING_REQUIRED",
  "MODEL_UNAVAILABLE",
  "CAPABILITY_UNSUPPORTED",
  "CONTENT_REJECTED",
  "RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "NETWORK_FAILURE",
  "INTERNAL_STATE_ERROR",
] as const;

export type GenerationErrorClass = (typeof GENERATION_ERROR_CLASSES)[number];

export type ProviderErrorDecoration = {
  rawCode: string;
  errorClass: GenerationErrorClass;
};
