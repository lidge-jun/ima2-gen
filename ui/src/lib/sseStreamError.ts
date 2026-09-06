import { resolveErrorSpec } from "./errorCodes";

/**
 * Canonical job envelope fields the UI reads (#151 stage 2). The envelope is
 * the primary source for terminal classification; the flat/nested payload
 * reads below remain the fallback for servers that predate it.
 */
type SseEnvelope = {
  phase?: string;
  terminal?: boolean;
  error?: { code?: string; message?: string };
};

function envelopeOf(data: Record<string, unknown>): SseEnvelope | null {
  const raw = data.envelope;
  if (!raw || typeof raw !== "object") return null;
  return raw as SseEnvelope;
}

/** Normalize SSE `error` payloads from flat (abortJob) and nested (writeNodeError) shapes. */
export function parseSseErrorPayload(
  data: Record<string, unknown>,
  fallbackMessage = "Generation failed",
): Error & { code?: string; status?: number; rawCode?: string; errorClass?: string; phase?: string } {
  const nested = data.error;
  let message = fallbackMessage;
  let code: string | undefined;
  let rawCode: string | undefined;
  let errorClass: string | undefined;
  let phase: string | undefined;

  // #151 stage 2: envelope-first. When the event carries a terminal canonical
  // envelope, its error code and canonical phase take precedence.
  const envelope = envelopeOf(data);
  if (envelope && envelope.terminal === true) {
    if (typeof envelope.phase === "string") phase = envelope.phase;
    if (envelope.error && typeof envelope.error === "object") {
      if (typeof envelope.error.code === "string") code = envelope.error.code;
      if (typeof envelope.error.message === "string" && envelope.error.message) {
        message = envelope.error.message;
      }
    }
  }

  if (typeof nested === "string") {
    if (message === fallbackMessage) message = nested;
  } else if (nested && typeof nested === "object") {
    const obj = nested as { message?: string; code?: string; rawCode?: string; errorClass?: string };
    if (typeof obj.message === "string" && obj.message && message === fallbackMessage) message = obj.message;
    if (typeof obj.code === "string") code = code ?? obj.code;
    if (typeof obj.rawCode === "string") rawCode = obj.rawCode;
    if (typeof obj.errorClass === "string") errorClass = obj.errorClass;
  }

  if (typeof data.code === "string") code = code ?? data.code;
  if (typeof data.rawCode === "string") rawCode = rawCode ?? data.rawCode;
  if (typeof data.errorClass === "string") errorClass = errorClass ?? data.errorClass;
  let status = typeof data.status === "number" ? data.status : undefined;
  const resolved = resolveErrorSpec({ code, rawCode, message, errorClass });
  if (resolved.code === "JOB_TRACKING_TIMEOUT") {
    code = resolved.code;
    message = resolved.message;
    status = 504;
    phase = "timed_out";
    rawCode = undefined;
    errorClass = undefined;
  }

  const e = new Error(message) as Error & { code?: string; status?: number; rawCode?: string; errorClass?: string; phase?: string };
  e.code = code;
  e.status = status;
  if (rawCode) e.rawCode = rawCode;
  if (errorClass) e.errorClass = errorClass;
  if (phase) e.phase = phase;
  return e;
}
