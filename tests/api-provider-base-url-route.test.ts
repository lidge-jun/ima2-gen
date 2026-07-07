import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "../config.js";
import { mountKeyRoutes } from "../routes/keys.ts";
import { createTestRuntimeContext } from "../lib/runtimeContext.ts";

const roots: string[] = [];
const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function withApp(fn: (args: { baseUrl: string; configFile: string; ctx: ReturnType<typeof createTestRuntimeContext> }) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "ima2-api-base-url-route-"));
  roots.push(root);
  const configFile = join(root, "config.json");
  const ctx = createTestRuntimeContext({
    config: {
      ...config,
      storage: {
        ...config.storage,
        configDir: root,
        configFile,
      },
      apiProvider: {
        ...config.apiProvider,
        baseUrl: "https://api.openai.com/v1",
      },
    },
  });
  const app = express();
  app.use(express.json());
  mountKeyRoutes(app, ctx);
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const address = server.address() as import("node:net").AddressInfo;
  try {
    await fn({ baseUrl: `http://127.0.0.1:${address.port}`, configFile, ctx });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("OpenAI API provider base URL settings route", () => {
  it("reports the current base URL without exposing API keys", async () => {
    await withApp(async ({ baseUrl }) => {
      const res = await fetch(`${baseUrl}/api/keys/status`);
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.deepEqual(body.openaiBaseUrl, {
        value: "https://api.openai.com/v1",
        defaultValue: "https://api.openai.com/v1",
        custom: false,
      });
      assert.equal(JSON.stringify(body).includes("sk-"), false);
    });
  });

  it("saves a custom base URL to config.json and hot-updates runtime config", async () => {
    await withApp(async ({ baseUrl, configFile, ctx }) => {
      const res = await fetch(`${baseUrl}/api/config/api-provider/base-url`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: " https://proxy.example.com/v1/ " }),
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.deepEqual(body, {
        ok: true,
        baseUrl: "https://proxy.example.com/v1",
        custom: true,
      });
      assert.equal(ctx.config.apiProvider.baseUrl, "https://proxy.example.com/v1");
      const saved = JSON.parse(await readFile(configFile, "utf-8"));
      assert.equal(saved.apiProvider.baseUrl, "https://proxy.example.com/v1");
    });
  });

  it("rejects invalid base URLs before writing config", async () => {
    await withApp(async ({ baseUrl, configFile, ctx }) => {
      const res = await fetch(`${baseUrl}/api/config/api-provider/base-url`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: "ftp://proxy.example.com/v1" }),
      });
      const body = await res.json();

      assert.equal(res.status, 400);
      assert.equal(body.code, "INVALID_OPENAI_BASE_URL");
      assert.equal(ctx.config.apiProvider.baseUrl, "https://api.openai.com/v1");
      await assert.rejects(() => readFile(configFile, "utf-8"));
    });
  });

  it("restores the default base URL", async () => {
    await withApp(async ({ baseUrl, configFile, ctx }) => {
      await fetch(`${baseUrl}/api/config/api-provider/base-url`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: "https://proxy.example.com/v1" }),
      });

      const res = await fetch(`${baseUrl}/api/config/api-provider/base-url`, { method: "DELETE" });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.deepEqual(body, {
        ok: true,
        baseUrl: "https://api.openai.com/v1",
        custom: false,
      });
      assert.equal(ctx.config.apiProvider.baseUrl, "https://api.openai.com/v1");
      const saved = JSON.parse(await readFile(configFile, "utf-8"));
      assert.equal(saved.apiProvider?.baseUrl, undefined);
    });
  });

  it("validates OpenAI API keys against the configured base URL", async () => {
    await withApp(async ({ baseUrl, ctx }) => {
      ctx.config.apiProvider.baseUrl = "https://yunwu.example/v1";
      const validationUrls: string[] = [];
      globalThis.fetch = (async (url, init) => {
        const textUrl = String(url);
        if (textUrl.startsWith(baseUrl)) return originalFetch(url, init);
        validationUrls.push(textUrl);
        return Response.json({ data: [{ id: "gpt-image-2" }] });
      }) as typeof fetch;

      const res = await fetch(`${baseUrl}/api/keys/openai`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: "sk-proxy-test-key" }),
      });
      const body = await res.json();

      assert.equal(res.status, 200);
      assert.equal(body.ok, true);
      assert.deepEqual(validationUrls, ["https://yunwu.example/v1/models"]);
    });
  });
});
