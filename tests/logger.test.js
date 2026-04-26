import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeFields,
  sanitizeError,
  formatLog,
  configureLogger,
  logEvent,
  logWarn,
  logError,
} from "../lib/logger.js";

describe("sanitizeFields", () => {
  it("redacts known secret keys", () => {
    const out = sanitizeFields({
      prompt: "draw a cat",
      references: ["data:image/png;base64,aGVsbG8="],
      authorization: "Bearer abc.def",
      apiKey: "sk-test",
      method: "POST",
    });
    assert.equal(out.prompt, "[redacted]");
    assert.equal(out.references, "[redacted]");
    assert.equal(out.authorization, "[redacted]");
    assert.equal(out.apiKey, "[redacted]");
    assert.equal(out.method, "POST");
  });

  it("redacts heuristic keys (token/secret/b64/dataurl substrings)", () => {
    const out = sanitizeFields({
      accessToken: "x",
      clientSecret: "x",
      imageB64: "AAAA",
      thumbnailDataUrl: "data:image/png;base64,...",
      regular: "ok",
    });
    assert.equal(out.accessToken, "[redacted]");
    assert.equal(out.clientSecret, "[redacted]");
    assert.equal(out.imageB64, "[redacted]");
    assert.equal(out.thumbnailDataUrl, "[redacted]");
    assert.equal(out.regular, "ok");
  });

  it("preserves promptChars / promptMode metric allowlist", () => {
    const out = sanitizeFields({ promptChars: 42, promptMode: "edit" });
    assert.equal(out.promptChars, 42);
    assert.equal(out.promptMode, "edit");
  });

  it("scrubs Bearer tokens and base64 data urls inside string values", () => {
    const out = sanitizeFields({
      header: "Bearer eyJhbGc.iOi.JIUz",
      stray: "see data:image/png;base64,AAAABBBCCC for details",
    });
    assert.equal(out.header, "Bearer [redacted]");
    assert.equal(out.stray, "see data:image/[redacted] for details");
  });

  it("truncates very long string values", () => {
    const big = "x".repeat(500);
    const out = sanitizeFields({ note: big });
    assert.ok(out.note.endsWith("..."));
    assert.ok(out.note.length <= 244);
  });

  it("flattens arrays and objects to type tags (no payload leak)", () => {
    const out = sanitizeFields({
      list: [1, 2, 3],
      obj: { a: 1 },
      buf: Buffer.from("hi"),
    });
    assert.equal(out.list, "[array:3]");
    assert.equal(out.obj, "[object]");
    assert.equal(out.buf, "[buffer:2]");
  });
});

describe("sanitizeError", () => {
  it("returns a stable shape and scrubs secrets in message", () => {
    const err = new Error("Bearer secret.token failed");
    err.code = "ECONN";
    err.status = 502;
    const out = sanitizeError(err);
    assert.equal(out.name, "Error");
    assert.equal(out.code, "ECONN");
    assert.equal(out.status, 502);
    assert.equal(out.message, "Bearer [redacted] failed");
  });

  it("handles null/undefined", () => {
    assert.deepEqual(sanitizeError(null), { message: "Unknown error" });
  });
});

describe("formatLog", () => {
  it("renders [scope.event] key=val pairs with quoted strings", () => {
    const line = formatLog("http", "request", {
      requestId: "req_1",
      method: "POST",
      path: "/api/generate",
      durationMs: 12,
    });
    assert.equal(
      line,
      `[http.request] requestId="req_1" method="POST" path="/api/generate" durationMs=12`,
    );
  });

  it("omits undefined fields", () => {
    const line = formatLog("x", "y", { a: 1, b: undefined });
    assert.equal(line, `[x.y] a=1`);
  });

  it("renders null as null literal", () => {
    const line = formatLog("x", "y", { a: null });
    assert.equal(line, `[x.y] a=null`);
  });
});

describe("configureLogger sink", () => {
  it("routes logEvent/logWarn/logError to the injected sink", () => {
    const lines = [];
    configureLogger({
      sink: {
        log: (l) => lines.push(["log", l]),
        warn: (l) => lines.push(["warn", l]),
        error: (l) => lines.push(["error", l]),
      },
    });
    try {
      logEvent("a", "b", { x: 1 });
      logWarn("a", "c");
      logError("a", "d", new Error("boom"));
      assert.equal(lines.length, 3);
      assert.equal(lines[0][0], "log");
      assert.match(lines[0][1], /^\[a.b\] x=1$/);
      assert.equal(lines[1][0], "warn");
      assert.equal(lines[2][0], "error");
      assert.match(lines[2][1], /errorMessage="boom"/);
    } finally {
      configureLogger({ sink: console });
    }
  });
});
