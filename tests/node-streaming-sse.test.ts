import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { registerNodeRoutes } from "../routes/nodes.ts";

const PARTIAL_B64 = Buffer.from("partial").toString("base64");
const FINAL_B64 = Buffer.from("final").toString("base64");

function writeOauthSse(res, { includePartial = true } = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  if (includePartial) {
    res.write(
      `data: ${JSON.stringify({
        type: "response.image_generation_call.partial_image",
        partial_image: PARTIAL_B64,
        index: 0,
      })}\n\n`,
    );
  }
  res.write(
    `data: ${JSON.stringify({
      type: "response.output_item.done",
      item: {
        type: "image_generation_call",
        result: FINAL_B64,
        revised_prompt: "revised",
      },
    })}\n\n`,
  );
  res.write(
    `data: ${JSON.stringify({
      type: "response.completed",
      response: { usage: { total_tokens: 7 } },
    })}\n\n`,
  );
  res.end();
}

describe("Node route SSE streaming", () => {
  let rootDir;
  let oauthServer;
  let appServer;
  let baseUrl;
  let oauthBodies = [];

  before(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "ima2-node-stream-"));
    await mkdir(join(rootDir, "generated"), { recursive: true });

    const oauthApp = express();
    oauthApp.use(express.json({ limit: "2mb" }));
    oauthApp.post("/v1/responses", (req, res) => {
      oauthBodies.push(req.body);
      writeOauthSse(res, { includePartial: !!req.body?.tools?.[1]?.partial_images });
    });
    await new Promise((resolve) => {
      oauthServer = oauthApp.listen(0, "127.0.0.1", resolve);
    });
    const oauthAddress = oauthServer.address();

    const app = express();
    app.use(express.json({ limit: "2mb" }));
    registerNodeRoutes(app, {
      rootDir,
      oauthUrl: `http://127.0.0.1:${oauthAddress.port}`,
      config: {
        oauth: { validModeration: new Set(["auto", "low"]) },
        storage: { generatedDir: join(rootDir, "generated") },
      },
    });
    await new Promise((resolve) => {
      appServer = app.listen(0, "127.0.0.1", resolve);
    });
    const appAddress = appServer.address();
    baseUrl = `http://127.0.0.1:${appAddress.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      appServer.close((err) => (err ? reject(err) : resolve()));
    });
    await new Promise((resolve, reject) => {
      oauthServer.close((err) => (err ? reject(err) : resolve()));
    });
    await rm(rootDir, { recursive: true, force: true });
  });

  it("streams partial and final node events for root generation", async () => {
    oauthBodies = [];
    const res = await fetch(`${baseUrl}/api/node/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        parentNodeId: null,
        prompt: "stream a node",
        quality: "medium",
        size: "1024x1024",
        format: "png",
        moderation: "low",
        requestId: "req_stream",
        sessionId: "s_1",
        clientNodeId: "nc_1",
      }),
    });

    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/event-stream/);
    assert.match(text, /event: phase/);
    assert.match(text, /event: partial/);
    assert.match(text, /event: done/);
    assert.ok(text.indexOf("event: partial") < text.indexOf("event: done"));
    assert.equal(oauthBodies[0].tools[1].partial_images, 2);
    assert.equal(oauthBodies[0].stream, true);
  });

  it("keeps the JSON fallback path final-only", async () => {
    oauthBodies = [];
    const res = await fetch(`${baseUrl}/api/node/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentNodeId: null,
        prompt: "json node",
        quality: "medium",
        size: "1024x1024",
        format: "png",
        moderation: "low",
        requestId: "req_json",
        sessionId: "s_1",
        clientNodeId: "nc_2",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.requestId, "req_json");
    assert.match(body.image, /^data:image\/png;base64,/);
    assert.equal(body.revisedPrompt, "revised");
    assert.equal(oauthBodies[0].tools[1].partial_images, undefined);
  });
});
