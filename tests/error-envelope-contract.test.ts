import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_DIR = mkdtempSync(join(tmpdir(), "ima2-error-envelope-"));
process.env.IMA2_CONFIG_DIR = TEST_DIR;
process.env.IMA2_DB_PATH = join(TEST_DIR, "sessions.db");

const { errorEnvelopeFields } = await import("../lib/errors/envelope.ts");
const { upstreamErrorFields } = await import("../lib/routeHelpers.ts");
const { writeNodeError } = await import("../lib/nodeHelpers.ts");
const { registerVideoExtendedRoutes } = await import("../routes/videoExtended.ts");
const { createAgentSession } = await import("../lib/agentStore.ts");
const queue = await import("../lib/agentQueueStore.ts");
const db = await import("../lib/db.ts");

after(() => {
  db.closeDb();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function providerError(code: string, status: number) {
  return Object.assign(new Error("ordinary provider failure"), { code, status, rawCode: code, errorClass: errorEnvelopeFields({ code, status }).errorClass });
}

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const value = app.listen(0, "127.0.0.1", () => resolve(value));
  });
  const address = server.address() as import("node:net").AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("062 error transport envelopes", () => {
  it("Classic SSE carries MiniMax fields without changing code", () => {
    const err = providerError("MINIMAX_INSUFFICIENT_BALANCE", 402);
    const payload = { code: "INVALID_REQUEST", ...upstreamErrorFields(err as unknown as Record<string, unknown>) };
    assert.equal(payload.code, "INVALID_REQUEST");
    assert.equal(payload.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(payload.errorClass, "BILLING_REQUIRED");
  });

  it("Node SSE nests fields inside error without changing code", () => {
    let body: unknown;
    const res = {
      writableEnded: false, destroyed: false, headersSent: false,
      status() { return this; },
      json(value: unknown) { body = value; return this; },
    } as unknown as express.Response;
    const err = providerError("MINIMAX_INSUFFICIENT_BALANCE", 402) as unknown as Record<string, unknown>;
    writeNodeError(res, 402, "INVALID_REQUEST", err.message as string, null, err);
    const error = (body as { error: Record<string, unknown> }).error;
    assert.equal(error.code, "INVALID_REQUEST");
    assert.equal(error.rawCode, "MINIMAX_INSUFFICIENT_BALANCE");
    assert.equal(error.errorClass, "BILLING_REQUIRED");
  });

  it("Video SSE call sites carry Grok 502 fields without changing code", () => {
    assert.deepEqual(errorEnvelopeFields(providerError("GROK_VIDEO_REQUEST_FAILED", 502)), {
      rawCode: "GROK_VIDEO_REQUEST_FAILED", errorClass: "NETWORK_FAILURE",
    });
    for (const path of ["routes/video.ts", "routes/videoExtended.ts"]) {
      assert.match(source(path), /publish|dualEmitVideo/);
      assert.match(source(path), /errorEnvelopeFields\((?:err\.raw|error)\)/);
    }
  });

  it("Video JSON restores structured code and fields", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw providerError("GROK_VIDEO_REQUEST_FAILED", 502); };
    const app = express();
    app.use(express.json());
    registerVideoExtendedRoutes(app, { config: { storage: { generatedDir: TEST_DIR }, grokProvider: { proxyHost: "127.0.0.1", proxyPort: 1 } } });
    try {
      await withServer(app, async (baseUrl) => {
        const response = await originalFetch(`${baseUrl}/api/video/edit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "edit", videoUrl: "https://example.test/input.mp4" }),
        });
        const body = await response.json() as Record<string, unknown>;
        assert.equal(body.code, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.rawCode, "GROK_VIDEO_REQUEST_FAILED");
        assert.equal(body.errorClass, "NETWORK_FAILURE");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Multimode preserves the last item failure as representative", () => {
    const adapter = source("lib/grokMultimodeAdapter.ts");
    const pipeline = source("lib/multimodePipeline.ts");
    assert.match(adapter, /lastError = e/);
    assert.match(adapter, /\{ error: lastError \}/);
    assert.match(pipeline, /finishErrorCode = representative\.code \|\| "EMPTY_RESPONSE"/);
    assert.match(pipeline, /errorEnvelopeFields\(generated\.error\)/);
  });

  it("MCP structured code wins over message parsing in every route", () => {
    for (const path of ["routes/mcpMedia.ts", "routes/mcpRecover.ts", "routes/mcpMultishot.ts"]) {
      const text = source(path);
      assert.match(text, /structuredCode|const code = \(error as \{ code\?: unknown \}\)\?\.code/);
      assert.match(text, /errorEnvelopeFields\(error\)/);
    }
    const err = providerError("MINIMAX_NETWORK_FAILED", 502);
    assert.equal((err as Error & { code: string }).code, "MINIMAX_NETWORK_FAILED");
    assert.equal(err.message.split(":")[0], "ordinary provider failure");
  });

  it("Edit JSON carries Gemini fields without changing code", () => {
    const err = providerError("GEMINI_API_RATE_LIMITED", 429);
    const payload = { code: err.code, ...errorEnvelopeFields(err) };
    assert.deepEqual(payload, { code: "GEMINI_API_RATE_LIMITED", rawCode: "GEMINI_API_RATE_LIMITED", errorClass: "RATE_LIMITED" });
    assert.match(source("routes/edit.ts"), /\.\.\.errorEnvelopeFields\(err\.raw\)/);
  });

  it("Agent queue stores Atlas 400 and 502 classes instead of deriving at read time", () => {
    const session = createAgentSession({ title: "error envelope" });
    const cases = [[400, "CAPABILITY_UNSUPPORTED"], [502, "NETWORK_FAILURE"]] as const;
    for (const [status, expectedClass] of cases) {
      const item = queue.createAgentQueueItem({ sessionId: session.id, prompt: `atlas ${status}` });
      const claimed = queue.claimNextAgentQueueItem({ maxGlobalRunning: 10, maxSessionRunning: 10 });
      assert.equal(claimed?.id, item.id);
      const fields = errorEnvelopeFields({ code: "ATLASCLOUD_GENERATE_FAILED", status });
      queue.failAgentQueueItem(item.id, { code: "ATLASCLOUD_GENERATE_FAILED", errorClass: fields.errorClass, message: `failed ${status}` });
      const stored = db.getDb().prepare("SELECT error_code AS code, error_class AS errorClass FROM agent_queue_items WHERE id = ?").get(item.id);
      assert.deepEqual(stored, { code: "ATLASCLOUD_GENERATE_FAILED", errorClass: expectedClass });
      assert.equal(queue.getAgentQueueItem(item.id)?.errorClass, expectedClass);
    }
    assert.deepEqual(queue.getAgentGenerationErrors(session.id).map((record) => record.errorClass).sort(), ["CAPABILITY_UNSUPPORTED", "NETWORK_FAILURE"]);
  });

  it("app codes never gain provider envelope fields", () => {
    assert.deepEqual(errorEnvelopeFields({ code: "SAFETY_REFUSAL", status: 422 }), {});
    const fields = upstreamErrorFields({ code: "SAFETY_REFUSAL", status: 422 });
    assert.equal("rawCode" in fields, false);
    assert.equal("errorClass" in fields, false);
  });
});
