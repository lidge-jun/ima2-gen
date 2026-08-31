import { resolveErrorSpec, type ResolvedErrorSpec } from "./errorCodes";

export function resolveAgentQueueError(item: {
  errorCode?: string | null;
  errorClass?: string | null;
  errorRawCode?: string | null;
  errorMessage?: string | null;
}): ResolvedErrorSpec | null {
  if (!item.errorCode && !item.errorClass && !item.errorMessage) return null;
  return resolveErrorSpec({
    code: item.errorCode,
    errorClass: item.errorClass,
    // resolveErrorSpec already falls back to rawCode when the top-level code is a
    // wrapper; the queue path just never forwarded it, so the user saw the generic
    // AGENT_TEXT_ONLY_RESULT instead of the real cause (issue #192).
    rawCode: item.errorRawCode,
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
