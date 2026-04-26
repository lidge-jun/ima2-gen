import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateViaOAuth, parseOpenAIErrorBody } from "../lib/oauthProxy.js";

test("OAuth non-ok responses do not expose raw upstream body in logs or errors", async () => {
  const privateText = "private prompt text from upstream body";
  const server = createServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { message: privateText } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  try {
    await assert.rejects(
      generateViaOAuth("safe test", "medium", "1024x1024", "low", [], "req_safe", "auto", {
        oauthUrl: `http://127.0.0.1:${port}`,
      }),
      (err) => {
        assert.equal(err.message, "OAuth proxy returned 500");
        assert.equal(err.status, 500);
        assert.equal(err.code, "OAUTH_UPSTREAM_ERROR");
        assert.ok(!err.message.includes(privateText));
        return true;
      },
    );
    assert.ok(!logs.join("\n").includes(privateText));
  } finally {
    console.log = originalLog;
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OAuth 400 validation JSON preserves actionable metadata", async () => {
  const upstream = {
    error: {
      message: "Invalid size '512x512'. Requested resolution is below the current minimum pixel budget.",
      type: "invalid_request_error",
      param: "tools[0].size",
      code: "invalid_value",
    },
  };
  const server = createServer((_req, res) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(upstream));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    await assert.rejects(
      generateViaOAuth("safe test", "medium", "512x512", "low", [], "req_invalid", "auto", {
        oauthUrl: `http://127.0.0.1:${port}`,
      }),
      (err) => {
        assert.equal(err.message, upstream.error.message);
        assert.equal(err.status, 400);
        assert.equal(err.code, "INVALID_REQUEST");
        assert.equal(err.upstreamCode, "invalid_value");
        assert.equal(err.upstreamType, "invalid_request_error");
        assert.equal(err.upstreamParam, "tools[0].size");
        return true;
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OpenAI error body parser ignores malformed and preserves fields", () => {
  assert.equal(parseOpenAIErrorBody("not json"), null);
  assert.deepEqual(
    parseOpenAIErrorBody(JSON.stringify({
      error: {
        message: "Invalid request",
        type: "invalid_request_error",
        param: "size",
        code: "invalid_value",
      },
    })),
    {
      message: "Invalid request",
      type: "invalid_request_error",
      param: "size",
      code: "invalid_value",
    },
  );
});
