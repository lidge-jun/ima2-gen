import { providerErrorClass } from "./providerMap.js";

export interface ErrorEnvelopeFields {
  rawCode?: string | undefined;
  errorClass?: string | undefined;
}

export function errorEnvelopeFields(err: unknown): ErrorEnvelopeFields {
  if (!err || typeof err !== "object") return {};
  const source = err as Record<string, unknown>;
  const rawCode = typeof source.rawCode === "string" ? source.rawCode : undefined;
  const preservedClass = typeof source.errorClass === "string" ? source.errorClass : undefined;
  const code = typeof source.code === "string" ? source.code : undefined;
  const errorClass = preservedClass ?? providerErrorClass(rawCode ?? code, source.status);
  if (!rawCode && !errorClass) return {};
  return { ...(rawCode || (errorClass && code) ? { rawCode: rawCode ?? code } : {}), ...(errorClass ? { errorClass } : {}) };
}
