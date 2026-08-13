import { resolveErrorSpec, type ResolvedErrorSpec } from "./errorCodes";

export function resolveAgentQueueError(item: {
  errorCode?: string | null;
  errorClass?: string | null;
  errorMessage?: string | null;
}): ResolvedErrorSpec | null {
  if (!item.errorCode && !item.errorClass && !item.errorMessage) return null;
  return resolveErrorSpec({
    code: item.errorCode,
    errorClass: item.errorClass,
    message: item.errorMessage,
  });
}

export function agentQueueErrorLabel(
  resolved: ResolvedErrorSpec | null,
  t: (key: string) => string,
): string | null {
  if (!resolved?.errorClass) return null;
  if (resolved.spec.cardKey) return t(`${resolved.spec.cardKey}.title`);
  if (resolved.spec.toastKey) return t(resolved.spec.toastKey);
  return null;
}
