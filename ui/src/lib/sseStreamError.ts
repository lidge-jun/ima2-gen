/** Normalize SSE `error` payloads from flat (abortJob) and nested (writeNodeError) shapes. */
export function parseSseErrorPayload(
  data: Record<string, unknown>,
  fallbackMessage = "Generation failed",
): Error & { code?: string; status?: number; rawCode?: string; errorClass?: string } {
  const nested = data.error;
  let message = fallbackMessage;
  let code: string | undefined;
  let rawCode: string | undefined;
  let errorClass: string | undefined;

  if (typeof nested === "string") {
    message = nested;
  } else if (nested && typeof nested === "object") {
    const obj = nested as { message?: string; code?: string; rawCode?: string; errorClass?: string };
    if (typeof obj.message === "string" && obj.message) message = obj.message;
    if (typeof obj.code === "string") code = obj.code;
    if (typeof obj.rawCode === "string") rawCode = obj.rawCode;
    if (typeof obj.errorClass === "string") errorClass = obj.errorClass;
  }

  if (typeof data.code === "string") code = code ?? data.code;
  if (typeof data.rawCode === "string") rawCode = rawCode ?? data.rawCode;
  if (typeof data.errorClass === "string") errorClass = errorClass ?? data.errorClass;
  const status = typeof data.status === "number" ? data.status : undefined;

  const e = new Error(message) as Error & { code?: string; status?: number; rawCode?: string; errorClass?: string };
  e.code = code;
  e.status = status;
  if (rawCode) e.rawCode = rawCode;
  if (errorClass) e.errorClass = errorClass;
  return e;
}
