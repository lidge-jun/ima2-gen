import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import express from "express";
import { request } from "node:http";
import { registerHealthRoutes } from "../routes/health.js";

const originalFetch = globalThis.fetch;

function makeCtx(overrides = {}) {
  return {
    hasApiKey: false,
    apiKey: null,
    apiKeySource: "none",
    oauthPort: 10531,
    oauthUrl: "http://127.0.0.1:10531",
    packageVersion: "0.0.0-test",
    startedAt: 1,
    config: {
      oauth: { statusTimeoutMs: 50 },
    },
    ...overrides,
  };
}

async function getJson(app, path) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  try {
    return await new Promise((resolve, reject) => {
      const req = request(
        { hostname: "127.0.0.1", port, path, method: "GET" },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe("/api/billing apiKeySource", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reports none when no API key is configured", async () => {
    const app = express();
    registerHealthRoutes(app, makeCtx());

    const res = await getJson(app, "/api/billing");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      oauth: true,
      apiKeyValid: false,
      apiKeySource: "none",
    });
  });

  it("reports env when the key came from OPENAI_API_KEY", async () => {
    globalThis.fetch = async (url) => ({
      ok: String(url).includes("/v1/models"),
      json: async () => ({}),
    });
    const app = express();
    registerHealthRoutes(app, makeCtx({
      hasApiKey: true,
      apiKey: "test",
      apiKeySource: "env",
    }));

    const res = await getJson(app, "/api/billing");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.apiKeySource, "env");
    assert.strictEqual(res.body.apiKeyValid, true);
  });

  it("reports config when the key came from config.json", async () => {
    globalThis.fetch = async (url) => ({
      ok: String(url).includes("/v1/models"),
      json: async () => ({}),
    });
    const app = express();
    registerHealthRoutes(app, makeCtx({
      hasApiKey: true,
      apiKey: "test",
      apiKeySource: "config",
    }));

    const res = await getJson(app, "/api/billing");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.apiKeySource, "config");
    assert.strictEqual(res.body.apiKeyValid, true);
  });
});
