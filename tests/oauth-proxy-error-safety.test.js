import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateViaOAuth } from "../lib/oauthProxy.js";

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
