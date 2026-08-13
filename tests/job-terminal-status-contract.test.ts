// Terminal-status boundary (roadmap 050).
//
// The success vocabulary is split three ways: finishJob defaults to
// "completed", MCP commits write "done", and CLI recovery historically only
// accepted "done". Nothing typed or tested that seam, so a new MCP route
// calling finishJob(requestId) without a status would strand recovery.
//
// These tests drive the REAL producers (finishJob -> listTerminalJobs) and the
// REAL consumer (runMcpJob's replay-gap recovery), and they deliberately
// suppress the live terminal SSE event: commitMediaResult publishes one right
// after recording the snapshot, and a naive test would consume that instead of
// exercising recovery at all.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { normalizeTerminalStatus, isTerminalSuccess, TERMINAL_SUCCESS } from "../lib/jobStatus.ts";
import * as cliJobStatus from "../bin/lib/jobStatus.ts";
import { finishJob, listTerminalJobs, startJob, _resetForTests } from "../lib/inflight.ts";
import { runMcpJob, type McpJobOptions } from "../bin/lib/mcpJob.ts";

describe("terminal status normalization", () => {
  it("collapses every success spelling that reaches the snapshot", () => {
    for (const spelling of ["done", "completed", "complete", "COMPLETED", " done "]) {
      assert.equal(normalizeTerminalStatus(spelling), "done", `${spelling} must count as success`);
      assert.equal(isTerminalSuccess(spelling), true);
    }
    assert.equal(TERMINAL_SUCCESS, "done");
  });

  it("keeps failure spellings out of the success bucket", () => {
    assert.equal(normalizeTerminalStatus("error"), "error");
    assert.equal(normalizeTerminalStatus("failed"), "error");
    assert.equal(normalizeTerminalStatus("canceled"), "canceled");
    assert.equal(normalizeTerminalStatus("cancelled"), "canceled");
    for (const spelling of ["error", "failed", "canceled"]) {
      assert.equal(isTerminalSuccess(spelling), false);
    }
  });

  it("refuses unknown values instead of guessing success", () => {
    for (const value of ["weird", "", null, undefined, 42, {}]) {
      assert.equal(normalizeTerminalStatus(value), "unknown");
      assert.equal(isTerminalSuccess(value), false);
    }
  });

  it("keeps the CLI copy identical to the server module", () => {
    // bin/ is transpiled and bundled separately, so mcpJob cannot import lib/.
    // Drift between the two copies would silently re-open the recovery gap.
    assert.equal(cliJobStatus.TERMINAL_SUCCESS, TERMINAL_SUCCESS);
    const inputs = [
      "done", "completed", "complete", "COMPLETED", " done ",
      "error", "failed", "canceled", "cancelled",
      "weird", "", null, undefined, 42, {},
    ];
    for (const value of inputs) {
      assert.equal(
        cliJobStatus.normalizeTerminalStatus(value),
        normalizeTerminalStatus(value),
        `CLI and server disagree on ${JSON.stringify(value)}`,
      );
    }
  });
});

// --- Integration: producer -> snapshot -> CLI recovery -------------------

type Client = ServerResponse;
const clients = new Set<Client>();
const reconnectCursors: string[] = [];
let serverBase = "";
let server: ReturnType<typeof createServer>;
// Each case registers what finishJob should record before the stream drops.
const pending = new Map<string, string | undefined | null>();

function emit(res: Client, event: string, data: unknown, id: number) {
  res.write(`id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Serves the same two endpoints runMcpJob uses. The SSE stream never emits a
// terminal event: it emits progress, then drops the connection, which is the
// replay gap that forces recovery through /api/inflight.
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
    if (url.searchParams.has("lastEventId")) {
      // The reconnect cannot be replayed from that cursor, which is exactly the
      // condition that sends the client to the inflight snapshot.
      reconnectCursors.push(String(url.searchParams.get("lastEventId")));
      res.write(`event: replay-gap\ndata: {"oldestAvailableId":99}\n\n`);
      return;
    }
    clients.add(res);
    res.on("close", () => clients.delete(res));
    return;
  }
  if (url.pathname === "/api/inflight") {
    // The real snapshot, not a fixture: whatever finishJob recorded.
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jobs: [], terminalJobs: listTerminalJobs() }));
    return;
  }
  if (req.method === "POST") {
    const body = await readJson(req);
    const requestId = String(body.requestId ?? "");
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ accepted: true, requestId }));
    setImmediate(() => finishAndDropStream(requestId));
    return;
  }
  res.writeHead(404).end();
}

function opts(requestId: string): McpJobOptions {
  return {
    serverBase,
    kind: "image",
    body: { provider: "runway", prompt: "test" },
    requestId,
    timeoutMs: 5_000,
    json: true,
  };
}

// Finishes the job the way a producer would, then drops the stream so the CLI
// has to recover from the snapshot rather than from a live terminal event.
function finishAndDropStream(requestId: string) {
  if (!pending.has(requestId)) return;
  const status = pending.get(requestId);
  startJob({ requestId, kind: "image", meta: {} });
  for (const client of clients) emit(client, "progress", { jobId: requestId, phase: "persisting" }, 10);
  finishJob(requestId, status === null
    ? { meta: { filename: `${requestId}.png` } }
    : { status, meta: { filename: `${requestId}.png` } });
  for (const client of [...clients]) client.end();
}

describe("finishJob snapshot reaches CLI recovery", () => {
  before(async () => {
    server = createServer(handler);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    serverBase = `http://127.0.0.1:${address.port}`;
  });

  after(() => {
    for (const client of clients) client.end();
    server.closeAllConnections();
    server.close();
    _resetForTests();
  });

  it("recovers a job finished with the MCP 'done' spelling", async () => {
    _resetForTests();
    pending.set("status-done", TERMINAL_SUCCESS);
    const result = await runMcpJob(opts("status-done"));
    assert.equal(result.filename, "status-done.png");
    assert.ok(reconnectCursors.length > 0, "recovery must have reconnected after the gap");
  });

  it("recovers a job finished with the 'completed' spelling (e1)", async () => {
    _resetForTests();
    pending.set("status-completed", "completed");
    const result = await runMcpJob(opts("status-completed"));
    assert.equal(result.filename, "status-completed.png");
  });

  it("recovers a job finished without any status at all (e3)", async () => {
    // finishJob's default is "completed"; before this phase recovery only
    // accepted "done", so this call stranded the CLI.
    _resetForTests();
    pending.set("status-omitted", null);
    const result = await runMcpJob(opts("status-omitted"));
    assert.equal(result.filename, "status-omitted.png");
  });

  it("still surfaces failures rather than treating them as success", async () => {
    _resetForTests();
    pending.set("status-error", "error");
    await assert.rejects(runMcpJob(opts("status-error")));
  });
});
