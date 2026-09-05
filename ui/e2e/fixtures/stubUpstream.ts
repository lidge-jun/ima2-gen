import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type StubMode = "minimax" | "oauth-expired" | "minimax-billing";
export type StubHandle = {
  url: string; calls: string[]; externalAttempts: string[];
  generationRequests: ReadonlyArray<{ path: string; body: unknown }>;
  setMode(mode: StubMode): void;
  holdNextGeneration(): { submitted: Promise<void>; release(): void };
  close(): Promise<void>;
};
type Hold = {
  submitted: Promise<void>; resolve(): void; reject(error: Error): void;
  claimed: boolean; released: boolean; settled: boolean;
  response?: ServerResponse; mode?: StubMode;
};
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function send(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
function generationResponse(response: ServerResponse, mode: StubMode): void {
  if (mode === "oauth-expired") send(response, 401, { error: { message: "token is expired. sign in again", type: "authentication_error" } });
  else if (mode === "minimax-billing") send(response, 200, { base_resp: { status_code: 1008, status_msg: "insufficient balance" } });
  else send(response, 200, { data: { image_base64: [TINY_PNG] }, base_resp: { status_code: 0 } });
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let bytes = 0;
  try {
    for await (const chunk of request) {
      const value = Buffer.from(chunk); bytes += value.length;
      if (bytes > MAX_BODY_BYTES) throw new Error("E2E_STUB_BODY_LIMIT");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw new Error("E2E_STUB_BODY_INVALID"); }
}

export async function startStubUpstream(initialMode: StubMode = "minimax"): Promise<StubHandle> {
  const calls: string[] = [], externalAttempts: string[] = [];
  const generationRequests: Array<{ path: string; body: unknown }> = [];
  const responses = new Set<ServerResponse>();
  const work = new Set<Promise<void>>();
  let mode = initialMode, activeHold: Hold | undefined, closing = false, closePromise: Promise<void> | undefined;
  const settle = (hold: Hold) => {
    hold.settled = true;
    if (activeHold === hold) activeHold = undefined;
  };
  const release = (hold: Hold) => {
    if (hold.released) return;
    hold.released = true;
    if (hold.response && !hold.settled) {
      generationResponse(hold.response, hold.mode!);
      settle(hold);
    }
  };
  const handleGeneration = async (request: IncomingMessage, response: ServerResponse, path: string, responseMode: StubMode, hold?: Hold) => {
    try {
      const body = await readBody(request);
      generationRequests.push({ path, body });
      if (hold) {
        if (closing || response.destroyed) { hold.reject(new Error("E2E fixture request aborted")); settle(hold); return; }
        hold.response = response; hold.mode = responseMode;
        response.once("close", () => settle(hold));
        hold.resolve();
        if (!hold.released) return;
      }
      generationResponse(response, responseMode);
      if (hold) settle(hold);
    } catch {
      if (hold) { hold.reject(new Error("E2E fixture request aborted")); settle(hold); }
      send(response, 400, { error: "Malformed generation request" });
    }
  };
  const server = createServer((request, response) => {
    responses.add(response); response.once("close", () => responses.delete(response));
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const host = String(request.headers.host ?? "");
    calls.push(`${request.method ?? "GET"} ${request.url ?? "/"}`);
    if (host && !/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) {
      externalAttempts.push(host); send(response, 400, { error: "Foreign stub host" }); return;
    }
    if (closing) { send(response, 503, { error: "Stub closed" }); return; }
    const responseMode = mode;
    if (path.endsWith("/image_generation") && request.method === "POST") {
      const hold = activeHold && !activeHold.claimed ? activeHold : undefined;
      if (hold) hold.claimed = true;
      const pending = handleGeneration(request, response, path, responseMode, hold);
      work.add(pending);
      void pending.finally(() => work.delete(pending));
    } else if (responseMode === "oauth-expired") {
      send(response, 401, { error: { message: "token is expired. sign in again", type: "authentication_error" } });
    } else if (path.endsWith("/models")) {
      send(response, 200, { data: [{ id: "image-01" }], base_resp: { status_code: 0 } });
    } else send(response, 404, { error: "not stubbed" });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
  } catch (error) { server.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === "string") { server.close(); throw new Error("Stub failed to bind"); }
  return {
    url: `http://127.0.0.1:${address.port}/v1`, calls, externalAttempts, generationRequests,
    setMode(next) { mode = next; },
    holdNextGeneration() {
      if (closing || activeHold) throw new Error("E2E fixture misuse: generation hold already armed or closed");
      let resolve!: () => void, reject!: (error: Error) => void;
      const submitted = new Promise<void>((accept, refuse) => { resolve = accept; reject = refuse; });
      // Keep an internal rejection observer; callers still receive the original rejected promise.
      void submitted.catch(() => {});
      const hold: Hold = { submitted, resolve, reject, claimed: false, released: false, settled: false };
      activeHold = hold;
      return { submitted, release: () => release(hold) };
    },
    close() {
      closePromise ??= (async () => {
        closing = true;
        if (activeHold) {
          activeHold.reject(new Error("E2E fixture closed"));
          activeHold.released = true; settle(activeHold);
        }
        const stopped = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        for (const response of responses) response.destroy();
        server.closeAllConnections();
        await stopped; await Promise.allSettled([...work]);
      })();
      return closePromise;
    },
  };
}
