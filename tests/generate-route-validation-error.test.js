import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerGenerateRoutes } from "../routes/generate.js";
import { registerNodeRoutes } from "../routes/nodes.js";

const upstreamMessage = "Invalid size '512x512'. Requested resolution is below the current minimum pixel budget.";

function writeInvalidSize(res) {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    error: {
      message: upstreamMessage,
      type: "image_generation_user_error",
      param: "tools",
      code: "invalid_value",
    },
  }));
}

describe("generation route validation errors", () => {
  let rootDir;
  let oauthServer;
  let appServer;
  let baseUrl;
  let upstreamRequests = 0;

  before(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "ima2-generate-validation-"));
    await mkdir(join(rootDir, "generated"), { recursive: true });

    oauthServer = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/v1/responses") {
        upstreamRequests += 1;
        writeInvalidSize(res);
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise((resolve) => oauthServer.listen(0, "127.0.0.1", resolve));
    const oauthAddress = oauthServer.address();

    const app = express();
    app.use(express.json({ limit: "2mb" }));
    const ctx = {
      rootDir,
      oauthUrl: `http://127.0.0.1:${oauthAddress.port}`,
      config: {
        ids: { generatedHexBytes: 4 },
        oauth: { validModeration: new Set(["auto", "low"]) },
        storage: { generatedDir: join(rootDir, "generated") },
      },
    };
    registerGenerateRoutes(app, ctx);
    registerNodeRoutes(app, ctx);
    await new Promise((resolve) => {
      appServer = app.listen(0, "127.0.0.1", resolve);
    });
    const appAddress = appServer.address();
    baseUrl = `http://127.0.0.1:${appAddress.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => appServer.close((err) => (err ? reject(err) : resolve())));
    await new Promise((resolve, reject) => oauthServer.close((err) => (err ? reject(err) : resolve())));
    await rm(rootDir, { recursive: true, force: true });
  });

  it("returns invalid image size instead of safety refusal", async () => {
    upstreamRequests = 0;
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "a simple red circle",
        quality: "low",
        size: "512x512",
        moderation: "low",
        requestId: "req_invalid_size_route",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error, upstreamMessage);
    assert.equal(body.code, "invalid_value");
    assert.equal(upstreamRequests, 1, "non-retryable validation errors should not be retried");
  });


  it("returns invalid image size from node generation instead of safety refusal", async () => {
    upstreamRequests = 0;
    const res = await fetch(`${baseUrl}/api/node/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentNodeId: null,
        prompt: "a simple red circle",
        quality: "low",
        size: "512x512",
        moderation: "low",
        requestId: "req_invalid_size_node",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, "invalid_value");
    assert.equal(body.error.message, upstreamMessage);
    assert.equal(upstreamRequests, 1, "non-retryable node validation errors should not be retried");
  });
});
