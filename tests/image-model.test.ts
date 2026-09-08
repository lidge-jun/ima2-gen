import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { normalizeImageModel } from "../lib/imageModels.ts";
import { registerNodeRoutes } from "../routes/nodes.ts";

describe("image model normalization", () => {
  it("defaults to GPT-6 Astra without route config", () => {
    assert.deepEqual(normalizeImageModel({}, undefined), { model: "gpt-6-astra" });
  });

  it("accepts supported image models", () => {
    assert.deepEqual(normalizeImageModel({}, "gpt-5.5"), { model: "gpt-5.5" });
    assert.deepEqual(normalizeImageModel({}, "gpt-5.4"), { model: "gpt-5.4" });
    assert.deepEqual(normalizeImageModel({}, "gpt-5.4-mini"), { model: "gpt-5.4-mini" });
  });

  it("accepts GPT-5.6 rollout models", () => {
    assert.deepEqual(normalizeImageModel({}, "gpt-5.6-sol"), { model: "gpt-5.6-sol" });
    assert.deepEqual(normalizeImageModel({}, "gpt-5.6-terra"), { model: "gpt-5.6-terra" });
    assert.deepEqual(normalizeImageModel({}, "gpt-5.6-luna"), { model: "gpt-5.6-luna" });
  });

  it("accepts the GPT-6 Astra model id", () => {
    assert.deepEqual(normalizeImageModel({}, "gpt-6-astra"), { model: "gpt-6-astra" });
  });

  it("normalizes the short Astra alias to the canonical model id", () => {
    assert.deepEqual(normalizeImageModel({}, "astra"), { model: "gpt-6-astra" });
  });

  it("rejects known unsupported OAuth models", () => {
    const result = normalizeImageModel({}, "gpt-5.3-codex-spark");
    assert.equal(result.code, "IMAGE_MODEL_UNSUPPORTED");
    assert.equal(result.status, 400);
  });

  it("rejects unknown models", () => {
    const result = normalizeImageModel({}, "bad-model");
    assert.equal(result.code, "INVALID_IMAGE_MODEL");
    assert.equal(result.status, 400);
  });
});

describe("node route image model validation", () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    registerNodeRoutes(app, {
      rootDir: process.cwd(),
      config: {
        oauth: { validModeration: new Set(["auto", "low"]) },
        storage: { generatedDir: process.cwd() },
      },
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("rejects Spark before OAuth", async () => {
    const res = await fetch(`${baseUrl}/api/node/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "small blue glass fish",
        moderation: "low",
        model: "gpt-5.3-codex-spark",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, "IMAGE_MODEL_UNSUPPORTED");
  });

  it("rejects unknown models before OAuth", async () => {
    const res = await fetch(`${baseUrl}/api/node/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "small blue glass fish",
        moderation: "low",
        model: "bad-model",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error.code, "INVALID_IMAGE_MODEL");
  });
});
