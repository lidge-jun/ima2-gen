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
  sanitizeError,
  sanitizeFields,
  shouldLog,
} from "../lib/logger.ts";

test("logger redacts secrets, raw prompts, base64-ish fields, and bodies", () => {
  const safe = sanitizeFields({
    requestId: "req_1",
    prompt: "draw my exact private prompt",
    promptChars: 28,
    authorization: "Bearer sk-secret",
    imageB64: "aGVsbG8=",
    references: ["aGVsbG8="],
    body: { raw: true },
  }) as Record<string, unknown>;

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

const errorStringCorpus = [
  {
    label: "opaque URL userinfo, query and fragment",
    input: "fetch https://user:opaque_user_4711@example.invalid/p?custom=opaque_query_5822#opaque_fragment_6933",
    expected: "fetch [redacted-url]",
    markers: ["opaque_user_4711", "opaque_query_5822", "opaque_fragment_6933"],
  },
  {
    label: "mixed custom schemes, encoded credentials and multiple URLs",
    input: 'fetch CuStOm+v1://user:opaque%5Fencoded%5F1111@example.invalid:8443/p?Unknown=opaque%5Fvalue%5F2222 then "HTTPS://example.invalid/opaque_path_3333?X-Signed=opaque_signed_4444"',
    expected: 'fetch [redacted-url] then "[redacted-url]"',
    markers: ["opaque%5Fencoded%5F1111", "opaque_encoded_1111", "opaque%5Fvalue%5F2222", "opaque_value_2222", "opaque_path_3333", "opaque_signed_4444"],
  },
  {
    label: "protocol-relative URL",
    input: "fetch //user:opaque_relative_7044@example.invalid/p failed",
    expected: "fetch [redacted-url] failed",
    markers: ["opaque_relative_7044"],
  },
  {
    label: "protocol-relative URL after equals",
    input: "url=//user:opaque_equals_7045@example.invalid/p failed",
    expected: "url=[redacted-url] failed",
    markers: ["opaque_equals_7045"],
  },
  {
    label: "protocol-relative URL after comma",
    input: "urls,//user:opaque_comma_7046@example.invalid/p failed",
    expected: "urls,[redacted-url] failed",
    markers: ["opaque_comma_7046"],
  },
  {
    label: "protocol-relative URL after bracket",
    input: "urls[//user:opaque_bracket_7047@example.invalid/p] failed",
    expected: "urls[[redacted-url] failed",
    markers: ["opaque_bracket_7047"],
  },
  {
    label: "protocol-relative URL after brace",
    input: "urls{//user:opaque_brace_7048@example.invalid/p} failed",
    expected: "urls{[redacted-url] failed",
    markers: ["opaque_brace_7048"],
  },
  {
    label: "query fragments with unknown names and encoded values",
    input: "query ?custom=opaque_query_8155&X-Amz-Signature=opaque_sig_9266 &Other=opaque%5Fquery%5F9377",
    expected: "query ?custom=[redacted]&X-Amz-Signature=[redacted] &Other=[redacted]",
    markers: ["opaque_query_8155", "opaque_sig_9266", "opaque%5Fquery%5F9377", "opaque_query_9377"],
  },
  {
    label: "punctuated Bearer and image data before whitespace normalization",
    input: '  failed\nwith bEaReR opaque_bearer_1488:%!?@suffix "data:image/png;base64,b3BhcXVlX2ltYWdlXzE1OTk="\tend  ',
    expected: 'failed with Bearer [redacted] "data:image/[redacted]" end',
    markers: ["opaque_bearer_1488", "suffix", "b3BhcXVlX2ltYWdlXzE1OTk="],
  },
  {
    label: "redaction precedes 240-character truncation",
    input: `${"a".repeat(238)} https://opaque_long_2600@example.invalid/p`,
    expected: `${"a".repeat(238)} [...`,
    markers: ["https", "opaque_long_2600", "example.invalid"],
  },
];

for (const fixture of errorStringCorpus) {
  test(`logger scrubs ${fixture.label} through public outputs`, () => {
    const lines: string[] = [];
    const error = Object.assign(new Error(fixture.input), { code: "UPSTREAM_FAILED", status: 503 });
    try {
      configureLogger({ level: "error", sink: { error: (line: string) => lines.push(line) } });
      const safe = sanitizeError(error);
      const formatted = formatLog("logger", "field", { detail: fixture.input });
      logError("logger", "failure", error);
      for (const output of [JSON.stringify(safe), formatted, ...lines]) {
        for (const marker of fixture.markers) assert.equal(output.includes(marker), false, marker);
      }
      assert.deepEqual(safe, {
        name: "Error", code: "UPSTREAM_FAILED", status: 503, message: fixture.expected,
      });
      assert.equal(formatted, `[logger.field] detail=${JSON.stringify(fixture.expected)}`);
      assert.deepEqual(lines, [
        `[logger.failure] errorName="Error" errorCode="UPSTREAM_FAILED" errorStatus=503 errorMessage=${JSON.stringify(fixture.expected)}`,
      ]);
      assert.ok(safe.message.length <= 243);
    } finally {
      configureLogger({ level: "info", sink: console });
    }
  });
}

test("logger preserves string errors and safe scalar metadata including status zero", () => {
  const lines: string[] = [];
  const cases = [
    { error: "fetch https://opaque_string_3700@example.invalid/p", expected: { name: "Error", code: undefined, status: undefined, message: "fetch [redacted-url]" } },
    { error: { name: "TimeoutError", code: "TIMEOUT", status: 504, message: "request timed out" }, expected: { name: "TimeoutError", code: "TIMEOUT", status: 504, message: "request timed out" } },
    { error: { name: "RateLimitError", code: "AUTH_RATE_LIMITED", status: 429, message: "retry later" }, expected: { name: "RateLimitError", code: "AUTH_RATE_LIMITED", status: 429, message: "retry later" } },
    { error: { name: "LocalError", code: "LOCAL_FAILED", status: 0, message: "" }, expected: { name: "LocalError", code: "LOCAL_FAILED", status: 0, message: "" } },
    { error: { name: "https://opaque_name_4811@example.invalid", code: "?custom=opaque_code_5922", status: 503, message: "failed" }, expected: { name: "[redacted-url]", code: "?custom=[redacted]", status: 503, message: "failed" } },
    { error: { name: { raw: "opaque_meta_6033" }, code: { raw: "opaque_meta_6033" }, status: Infinity, message: { raw: "opaque_meta_6033" } }, expected: { name: "Error", code: undefined, status: undefined, message: "Unknown error" } },
  ];
  try {
    configureLogger({ level: "error", sink: { error: (line: string) => lines.push(line) } });
    for (const fixture of cases) {
      const safe = sanitizeError(fixture.error);
      logError("logger", "scalar", fixture.error, { requestId: "req_safe", provider: "synthetic" });
      assert.deepEqual(safe, fixture.expected);
      assert.equal(lines.at(-1)?.includes('requestId="req_safe" provider="synthetic"'), true);
    }
    assert.equal(lines.length, cases.length);
    assert.ok(lines[1].includes('errorCode="TIMEOUT" errorStatus=504 errorMessage="request timed out"'));
    assert.ok(lines[2].includes('errorCode="AUTH_RATE_LIMITED" errorStatus=429 errorMessage="retry later"'));
    assert.ok(lines[3].includes('errorStatus=0 errorMessage=""'));
    for (const marker of ["opaque_string_3700", "opaque_name_4811", "opaque_code_5922", "opaque_meta_6033"]) {
      assert.equal(JSON.stringify(lines).includes(marker), false, marker);
    }
  } finally {
    configureLogger({ level: "info", sink: console });
  }
});

test("logger omits nested errors, bodies and cycles while scrubbing a direct cause message", () => {
  const lines: string[] = [];
  const cause = new Error("fetch https://user:opaque_cause_7144@example.invalid/p?custom=opaque_cause_query_7255 Bearer opaque_cause_bearer_7366:%");
  const error = Object.assign(new AggregateError([new Error("opaque_aggregate_7477")], "outer failed", { cause }), {
    code: "UPSTREAM_FAILED", status: 503, response: { body: "opaque_body_7588" },
    rawResponse: "opaque_raw_7699", stack: "opaque_stack_7700",
  });
  Object.assign(error, { self: error });
  try {
    configureLogger({ level: "error", sink: { error: (line: string) => lines.push(line) } });
    const safe = sanitizeError(error);
    const fields = sanitizeFields({ failure: error, context: { error }, errors: [error], detail: cause.message });
    const formatted = formatLog("logger", "nested", { failure: error, context: { error }, detail: cause.message });
    logError("logger", "nested", error, { failure: error, detail: cause.message });
    assert.deepEqual(safe, { name: "AggregateError", code: "UPSTREAM_FAILED", status: 503, message: "outer failed" });
    assert.deepEqual(Object.keys(safe), ["name", "code", "status", "message"]);
    assert.deepEqual(fields, {
      failure: { name: "AggregateError", code: "UPSTREAM_FAILED", status: 503, message: "outer failed" },
      context: "[object]", errors: "[array:1]", detail: "fetch [redacted-url] Bearer [redacted]",
    });
    assert.equal(formatted, '[logger.nested] failure="[object Object]" context="[object]" detail="fetch [redacted-url] Bearer [redacted]"');
    assert.deepEqual(lines, ['[logger.nested] failure="[object Object]" detail="fetch [redacted-url] Bearer [redacted]" errorName="AggregateError" errorCode="UPSTREAM_FAILED" errorStatus=503 errorMessage="outer failed"']);
    for (const output of [JSON.stringify(safe), JSON.stringify(fields), formatted, ...lines]) {
      for (const marker of ["opaque_cause_7144", "opaque_cause_query_7255", "opaque_cause_bearer_7366", "opaque_aggregate_7477", "opaque_body_7588", "opaque_raw_7699", "opaque_stack_7700"]) {
        assert.equal(output.includes(marker), false, marker);
      }
    }
  } finally {
    configureLogger({ level: "info", sink: console });
  }
});
