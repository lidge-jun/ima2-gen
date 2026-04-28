import { randomUUID } from "crypto";
import { logEvent } from "./logger.js";
const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const IGNORED_LOG_PATHS = new Set(["/api/health", "/api/inflight"]);
export function normalizeRequestId(value) {
    return typeof value === "string" && REQUEST_ID_RE.test(value) ? value : `req_${randomUUID()}`;
}
function requestPath(req) {
    return String(req.originalUrl || req.url || "").split("?")[0] || "/";
}
export function createRequestLogger() {
    return function requestLogger(req, res, next) {
        const path = requestPath(req);
        if (!path.startsWith("/api/"))
            return next();
        const requestId = normalizeRequestId(req.get("x-request-id"));
        const startedAt = Date.now();
        req.id = requestId;
        res.setHeader("X-Request-Id", requestId);
        const ignoreLog = IGNORED_LOG_PATHS.has(path);
        if (!ignoreLog) {
            logEvent("http", "request", {
                requestId,
                method: req.method,
                path,
                client: req.get("x-ima2-client") || "ui",
            });
        }
        res.on("finish", () => {
            if (ignoreLog)
                return;
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
