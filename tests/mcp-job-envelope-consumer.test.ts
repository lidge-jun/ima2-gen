// #151 stage 2 — the CLI consumes the canonical envelope.
//
// runMcpJob's terminal detection historically keyed off event names and raw
// payload fields. These tests pin the new order: a terminal envelope decides
// the outcome first, servers without envelopes still work through the old
// branches, and the progress callback stays reachable either way.
import { after, before, describe, it } from "node:test";
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
  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.flushHeaders();
    clients.add(res);
    res.on("close", () => clients.delete(res));
    return;
  }
  if (req.method === "POST") {
    const body = await readJson(req);
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

  after(() => {
    for (const client of clients) client.end();
    server.close();
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
});
