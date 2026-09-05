// #151 stage 2 — the CLI consumes the canonical envelope.
//
// runMcpJob's terminal detection historically keyed off event names and raw
// payload fields. These tests pin the new order: a terminal envelope decides
// the outcome first, servers without envelopes still work through the old
// branches, and the progress callback stays reachable either way.
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { runMcpJob, McpJobError, type McpJobOptions } from "../bin/lib/mcpJob.ts";

type Client = ServerResponse;
const clients = new Set<Client>();
let serverBase = "";
let server: ReturnType<typeof createServer>;
// Script per requestId: events to emit once the job is submitted.
const scripts = new Map<string, Array<{ event: string; data: Record<string, unknown> }>>();
const requests: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
const violations: string[] = [];

function emit(res: Client, event: string, data: unknown, id: number) {
  res.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  try {
    let text = "";
    for await (const chunk of req) text += String(chunk);
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const request: (typeof requests)[number] = { method: req.method ?? "", path: url.pathname };
  requests.push(request);
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.flushHeaders();
    clients.add(res);
    res.on("close", () => clients.delete(res));
    return;
  }
  if (req.method === "POST" && ["/api/mcp/generate", "/api/mcp/media-action"].includes(url.pathname)) {
    const body = await readJson(req);
    request.body = body;
    const requestId = String(body.requestId ?? "");
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true, requestId }));
    setImmediate(() => {
      const script = scripts.get(requestId) ?? [];
      let id = 1;
      for (const client of clients) {
        for (const step of script) emit(client, step.event, { jobId: requestId, ...step.data }, id++);
      }
    });
    return;
  }
  violations.push(`${req.method} ${req.url}`);
  res.writeHead(404).end();
}

function opts(requestId: string, onProgress?: (phase: string) => void): McpJobOptions {
  return {
    serverBase,
    kind: "image",
    body: { provider: "runway", prompt: "test" },
    requestId,
    timeoutMs: 20_000,
    json: true,
    ...(onProgress ? { onProgress } : {}),
  };
}

describe("mcp job envelope consumption", () => {
  before(async () => {
    server = createServer(handler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    serverBase = `http://127.0.0.1:${addr.port}`;
  });

  beforeEach(() => { requests.length = 0; });

  afterEach(() => {
    assert.equal(requests.filter(request => request.method === "POST").length, 1);
    assert.deepEqual(violations, []);
  });

  after(async () => {
    for (const client of clients) client.end();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(server.listening, false);
    assert.equal(clients.size, 0);
  });

  it("a terminal cancelled envelope decides the outcome with its code and the flat error text", async () => {
    const requestId = "env-cancel-1";
    scripts.set(requestId, [
      { event: "progress", data: { phase: "running" } },
      {
        event: "error",
        data: {
          error: "Generation canceled",
          status: 499,
          envelope: {
            version: 1, jobId: requestId, requestId, sequence: 2,
            phase: "cancelled", terminal: true,
            error: { code: "GENERATION_CANCELED", message: "Generation canceled", status: 499 },
          },
        },
      },
    ]);
    const phases: string[] = [];
    await assert.rejects(
      () => runMcpJob(opts(requestId, (p) => phases.push(p))),
      (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, "GENERATION_CANCELED");
        // The message comes from data.error (flat producer shape), not the
        // generic fallback — this is the user-visible improvement.
        assert.equal(error.message, "Generation canceled");
        return true;
      },
    );
    assert.deepEqual(phases, ["running"], "progress callback must stay reachable");
  });

  it("an envelope without error code falls back to data.code, then the phase default", async () => {
    const requestId = "env-timeout-1";
    scripts.set(requestId, [
      {
        event: "error",
        data: {
          error: "took too long",
          envelope: {
            version: 1, jobId: requestId, requestId, sequence: 1,
            phase: "timed_out", terminal: true,
          },
        },
      },
    ]);
    await assert.rejects(
      () => runMcpJob(opts(requestId)),
      (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, "MCP_JOB_TIMEOUT");
        assert.equal(error.message, "took too long");
        return true;
      },
    );
  });

  it("servers without envelopes still terminate through the event-name fallback", async () => {
    const requestId = "no-env-1";
    scripts.set(requestId, [
      { event: "error", data: { code: "LEGACY_FAIL", message: "legacy failure" } },
    ]);
    await assert.rejects(
      () => runMcpJob(opts(requestId)),
      (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, "LEGACY_FAIL");
        assert.equal(error.message, "legacy failure");
        return true;
      },
    );
  });

  it("a completed envelope on a done event resolves through doneResult", async () => {
    const requestId = "env-done-1";
    scripts.set(requestId, [
      {
        event: "done",
        data: {
          filename: "out.png",
          url: "/generated/out.png",
          envelope: {
            version: 1, jobId: requestId, requestId, sequence: 1,
            phase: "completed", terminal: true,
          },
        },
      },
    ]);
    const result = await runMcpJob(opts(requestId));
    assert.equal(result.filename, "out.png");
    assert.equal(result.url, "/generated/out.png");
  });

  for (const variant of ["envelope", "envelope-data-code", "legacy", "video", "upscale"] as const) {
    it(`tracking expiry uses a fixed warning without metadata (${variant})`, async () => {
      const requestId = `tracking-${variant}`;
      const data: Record<string, unknown> = {
        code: "JOB_TRACKING_TIMEOUT", error: "synthetic private prompt", message: "synthetic credential",
        status: 401, errorClass: "AUTH_EXPIRED", meta: { message: "synthetic provider reply" },
      };
      if (variant === "envelope" || variant === "envelope-data-code") {
        data.envelope = { terminal: true, phase: "timed_out",
          error: variant === "envelope" ? { code: "JOB_TRACKING_TIMEOUT", message: "unsafe envelope" } : {} };
        if (variant === "envelope") data.code = "AUTH_EXPIRED";
      }
      scripts.set(requestId, [{ event: "error", data }]);
      const options = opts(requestId);
      if (variant === "video") options.kind = "video";
      if (variant === "upscale") {
        options.postPath = "/api/mcp/media-action";
        options.body = { provider: "runway", action: "upscale", filename: "owned.png" };
      }
      await assert.rejects(runMcpJob(options), (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, "JOB_TRACKING_TIMEOUT");
        assert.equal(error.message, "Job tracking expired; upstream completion is unknown. Inspect history before retrying.");
        assert.equal(error.status, 504);
        assert.equal(error.body, undefined);
        return true;
      });
      assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
        ["GET", "/api/events"], ["POST", options.postPath ?? "/api/mcp/generate"],
      ]);
      assert.deepEqual(requests[1]?.body, { ...options.body, kind: options.kind, requestId });
    });
  }

  for (const code of ["AGY_TIMEOUT", "MCP_JOB_TIMEOUT", "AUTH_EXPIRED", "UNKNOWN"]) {
    it(`preserves selected ${code} over conflicting tracking fields`, async () => {
      const requestId = `nontracking-${code}`;
      scripts.set(requestId, [{ event: "error", data: {
        code: "JOB_TRACKING_TIMEOUT", rawCode: "JOB_TRACKING_TIMEOUT", error: "ordinary error",
        envelope: { terminal: true, phase: "timed_out", error: { code } },
      } }]);
      await assert.rejects(runMcpJob(opts(requestId)), (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, code);
        assert.equal(error.message, "ordinary error");
        assert.equal(error.status, undefined);
        return true;
      });
    });
  }

  for (const code of [undefined, "UNKNOWN", "JOB_TRACKING_TIMEOUT_OTHER"]) {
    it(`legacy timeout-like text does not imply tracking expiry (${code ?? "missing"})`, async () => {
      const requestId = `legacy-control-${code ?? "missing"}`;
      scripts.set(requestId, [{ event: "error", data: {
        ...(code ? { code } : {}), rawCode: "JOB_TRACKING_TIMEOUT", message: "ordinary timeout text",
      } }]);
      await assert.rejects(runMcpJob(opts(requestId)), (error: unknown) => {
        assert.ok(error instanceof McpJobError);
        assert.equal(error.code, code ?? "MCP_JOB_FAILED");
        assert.equal(error.message, "ordinary timeout text");
        assert.equal(error.status, undefined);
        return true;
      });
    });
  }

  it("media-action upscale success retains its POST path and result", async () => {
    const requestId = "upscale-success";
    scripts.set(requestId, [{ event: "done", data: { filename: "upscaled.png", url: "/generated/upscaled.png" } }]);
    const options = { ...opts(requestId), postPath: "/api/mcp/media-action",
      body: { provider: "runway", action: "upscale", filename: "owned.png" } };
    const result = await runMcpJob(options);
    assert.equal(result.filename, "upscaled.png");
    assert.equal(result.url, "/generated/upscaled.png");
    assert.equal(requests[1]?.path, "/api/mcp/media-action");
    assert.deepEqual(requests[1]?.body, { ...options.body, kind: "image", requestId });
  });
});
