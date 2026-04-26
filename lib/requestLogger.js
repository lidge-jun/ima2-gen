import { randomUUID } from "crypto";
import { logEvent } from "./logger.js";

// Strict allowlist for client-supplied request ids. Anything else is replaced
// with a server-generated uuid so a hostile client cannot inject newlines or
// terminal escapes into the log stream.
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

// /api/health and /api/inflight are polled aggressively by the UI; logging
// every hit drowns the signal. We still set req.id + X-Request-Id on these
// so cross-request tracing works when something does go wrong.
const QUIET_PATHS = new Set(["/api/health", "/api/inflight"]);

export function normalizeRequestId(value) {
  return typeof value === "string" && REQUEST_ID_RE.test(value)
    ? value
    : `req_${randomUUID()}`;
}

function pathOf(req) {
  return String(req.originalUrl || req.url || "").split("?")[0] || "/";
}

export function createRequestLogger() {
  return function requestLogger(req, res, next) {
    const path = pathOf(req);
    if (!path.startsWith("/api/")) return next();

    const requestId = normalizeRequestId(req.get("x-request-id"));
    const startedAt = Date.now();
    req.id = requestId;
    res.setHeader("X-Request-Id", requestId);

    const quiet = QUIET_PATHS.has(path);
    if (!quiet) {
      logEvent("http", "request", {
        requestId,
        method: req.method,
        path,
        client: req.get("x-ima2-client") || "ui",
        authUser: req.authUser || null,
      });
    }

    res.on("finish", () => {
      if (quiet) return;
      logEvent("http", "response", {
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  };
}
