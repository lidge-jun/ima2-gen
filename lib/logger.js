const REDACTED = "[redacted]";
const MAX_VALUE_LEN = 240;
const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

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
  "styleSheet",
  "style_sheet",
  "image",
  "imageB64",
  "image_url",
  "references",
  "rawResponse",
]);

const ALLOWED_PROMPT_METRICS = new Set(["promptChars", "promptMode"]);

let activeLevel = "info";
let activeSink = console;

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
  const safeFields = sanitizeFields(fields);
  const parts = Object.entries(safeFields)
    .map(([key, value]) => {
      const formatted = formatValue(value);
      return formatted === undefined ? null : `${key}=${formatted}`;
    })
    .filter(Boolean);
  return `[${scope}.${event}]${parts.length ? ` ${parts.join(" ")}` : ""}`;
}

export function normalizeLogLevel(level) {
  return typeof level === "string" && Object.hasOwn(LOG_LEVELS, level) ? level : "info";
}

export function configureLogger(options = {}) {
  activeLevel = normalizeLogLevel(options.level);
  activeSink = options.sink || console;
}

export function shouldLog(level) {
  const normalized = normalizeLogLevel(level);
  return LOG_LEVELS[normalized] >= LOG_LEVELS[activeLevel] && activeLevel !== "silent";
}

function writeLog(level, line) {
  if (!shouldLog(level)) return;
  const writer = activeSink[level] || activeSink.log || console.log;
  writer.call(activeSink, line);
}

export function logDebug(scope, event, fields = {}) {
  writeLog("debug", formatLog(scope, event, fields));
}

export function logEvent(scope, event, fields = {}) {
  writeLog("info", formatLog(scope, event, fields));
}

export function logWarn(scope, event, fields = {}) {
  writeLog("warn", formatLog(scope, event, fields));
}

export function logError(scope, event, err, fields = {}) {
  const safe = sanitizeError(err);
  writeLog("error", formatLog(scope, event, {
    ...fields,
    errorName: safe.name,
    errorCode: safe.code,
    errorStatus: safe.status,
    errorMessage: safe.message,
  }));
}
