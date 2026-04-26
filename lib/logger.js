// Sanitized structured logger for server-side events.
// Format: [scope.event] key="value" key2=42
//
// Why a custom logger: every existing console.* call already lives in server.js
// and is left untouched (refactor scope is intentionally narrow). This module
// is what new request-level instrumentation should use, so accidental leakage
// of prompts / refs / auth tokens is caught at the formatter, not at each call
// site.

const REDACTED = "[redacted]";
const MAX_VALUE_LEN = 240;

const SECRET_KEYS = new Set([
  "authorization",
  "cookie",
  "headers",
  "apiKey",
  "token",
  "password",
  "secret",
  "body",
  "prompt",
  "effectivePrompt",
  "userPrompt",
  "revisedPrompt",
  "textPrompt",
  "image",
  "imageB64",
  "image_url",
  "references",
  "rawResponse",
]);

// promptChars / promptMode are length/category metrics, not the prompt itself,
// and are useful enough in request logs to allowlist explicitly.
const ALLOWED_PROMPT_METRICS = new Set(["promptChars", "promptMode"]);

function shouldRedactKey(key) {
  if (ALLOWED_PROMPT_METRICS.has(key)) return false;
  if (SECRET_KEYS.has(key)) return true;
  const lower = key.toLowerCase();
  return (
    lower.includes("token") ||
    lower.includes("authorization") ||
    lower.includes("cookie") ||
    lower.includes("apikey") ||
    lower.includes("api_key") ||
    lower.includes("secret") ||
    lower.includes("b64") ||
    lower.includes("base64") ||
    lower.includes("dataurl")
  );
}

function sanitizeValue(value) {
  if (value == null) return value;
  if (value instanceof Error) return sanitizeError(value);
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (Buffer.isBuffer(value)) return `[buffer:${value.length}]`;
  if (typeof value === "object") return "[object]";
  if (typeof value === "string") {
    const oneLine = value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "data:image/[redacted]")
      .replace(/\s+/g, " ")
      .trim();
    return oneLine.length > MAX_VALUE_LEN ? `${oneLine.slice(0, MAX_VALUE_LEN)}...` : oneLine;
  }
  return value;
}

export function sanitizeError(err) {
  if (!err) return { message: "Unknown error" };
  return {
    name: err.name || "Error",
    code: err.code || undefined,
    status: err.status || undefined,
    message: sanitizeValue(err.message || "Unknown error"),
  };
}

export function sanitizeFields(fields = {}) {
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = shouldRedactKey(key) ? REDACTED : sanitizeValue(value);
  }
  return out;
}

function formatValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(String(value));
}

export function formatLog(scope, event, fields = {}) {
  const safe = sanitizeFields(fields);
  const parts = Object.entries(safe)
    .map(([key, value]) => {
      const formatted = formatValue(value);
      return formatted === undefined ? null : `${key}=${formatted}`;
    })
    .filter(Boolean);
  return `[${scope}.${event}]${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

let activeSink = console;

// Tests inject a sink that captures lines instead of writing to stdout.
export function configureLogger(options = {}) {
  activeSink = options.sink || console;
}

function write(level, line) {
  const writer = activeSink[level] || activeSink.log || console.log;
  writer.call(activeSink, line);
}

export function logEvent(scope, event, fields = {}) {
  write("log", formatLog(scope, event, fields));
}

export function logWarn(scope, event, fields = {}) {
  write("warn", formatLog(scope, event, fields));
}

export function logError(scope, event, err, fields = {}) {
  const safe = sanitizeError(err);
  write("error", formatLog(scope, event, {
    ...fields,
    errorName: safe.name,
    errorCode: safe.code,
    errorStatus: safe.status,
    errorMessage: safe.message,
  }));
}
