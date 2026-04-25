import { test } from "node:test";
import assert from "node:assert/strict";
import {
  configureLogger,
  formatLog,
  logDebug,
  logError,
  logEvent,
  logWarn,
  normalizeLogLevel,
  sanitizeFields,
  shouldLog,
} from "../lib/logger.js";

test("logger redacts secrets, raw prompts, base64-ish fields, and bodies", () => {
  const safe = sanitizeFields({
    requestId: "req_1",
    prompt: "draw my exact private prompt",
    promptChars: 28,
    authorization: "Bearer sk-secret",
    imageB64: "aGVsbG8=",
    references: ["aGVsbG8="],
    body: { raw: true },
  });

  assert.equal(safe.requestId, "req_1");
  assert.equal(safe.prompt, "[redacted]");
  assert.equal(safe.promptChars, 28);
  assert.equal(safe.authorization, "[redacted]");
  assert.equal(safe.imageB64, "[redacted]");
  assert.equal(safe.references, "[redacted]");
  assert.equal(safe.body, "[redacted]");
});

test("formatLog includes safe correlation fields without raw prompt text", () => {
  const line = formatLog("node", "request", {
    requestId: "req_2",
    sessionId: "s_123",
    prompt: "secret prompt text",
    quality: "medium",
    refs: 2,
  });

  assert.match(line, /^\[node\.request\]/);
  assert.match(line, /requestId="req_2"/);
  assert.match(line, /sessionId="s_123"/);
  assert.match(line, /quality="medium"/);
  assert.match(line, /refs=2/);
  assert.doesNotMatch(line, /secret prompt text/);
});

test("formatLog scrubs bearer tokens and data URLs from string fields", () => {
  const line = formatLog("oauth", "error", {
    errorMessage: "failed with Bearer sk-test and data:image/png;base64,aGVsbG8=",
  });

  assert.doesNotMatch(line, /sk-test/);
  assert.doesNotMatch(line, /aGVsbG8=/);
  assert.match(line, /Bearer \[redacted\]/);
  assert.match(line, /data:image\/\[redacted\]/);
});

test("logger level filtering and sink configuration preserve existing helpers", () => {
  const lines = [];
  const sink = {
    log: (line) => lines.push(["log", line]),
    warn: (line) => lines.push(["warn", line]),
    error: (line) => lines.push(["error", line]),
  };

  try {
    configureLogger({ level: "warn", sink });
    assert.equal(normalizeLogLevel("debug"), "debug");
    assert.equal(normalizeLogLevel("nope"), "info");
    assert.equal(shouldLog("info"), false);
    assert.equal(shouldLog("warn"), true);

    logDebug("logger", "debug_hidden");
    logEvent("logger", "info_hidden");
    logWarn("logger", "warn_visible");
    logError("logger", "error_visible", new Error("boom"));

    assert.deepEqual(lines.map(([method]) => method), ["warn", "error"]);
    assert.match(lines[0][1], /^\[logger\.warn_visible\]/);
    assert.match(lines[1][1], /^\[logger\.error_visible\]/);
  } finally {
    configureLogger({ level: "info", sink: console });
  }
});

test("debug logs fall back to sink.log when sink.debug is absent", () => {
  const lines = [];
  try {
    configureLogger({
      level: "debug",
      sink: {
        log: (line) => lines.push(line),
      },
    });

    logDebug("logger", "debug_visible", { requestId: "req_debug" });

    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[logger\.debug_visible\]/);
    assert.match(lines[0], /requestId="req_debug"/);
  } finally {
    configureLogger({ level: "info", sink: console });
  }
});
