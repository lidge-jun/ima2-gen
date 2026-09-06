import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type StubMode = "minimax" | "oauth-expired" | "minimax-billing";
export type StubHandle = {
  url: string; calls: string[]; externalAttempts: string[];
  generationRequests: ReadonlyArray<{ path: string; body: unknown }>;
  readonly generationReplies: number;
  setMode(mode: StubMode): void;
  redirectNextGeneration(target: string): void;
  holdNextGeneration(): { submitted: Promise<void>; release(): void };
  close(): Promise<void>;
};
type Hold = {
  submitted: Promise<void>; resolve(): void; reject(error: Error): void;
  claimed: boolean; released: boolean; settled: boolean;
  response?: ServerResponse; reply?: { mode: StubMode; redirect?: string };
};
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function send(response: ServerResponse, status: number, body: unknown): boolean {
  if (response.destroyed || response.writableEnded) return false;
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
  return true;
}
function generationResponse(response: ServerResponse, reply: { mode: StubMode; redirect?: string }): boolean {
  if (response.destroyed || response.writableEnded) return false;
  if (reply.redirect) { response.writeHead(307, { Location: reply.redirect }); response.end(); return true; }
  if (reply.mode === "oauth-expired") return send(response, 401, { error: { message: "token is expired. sign in again", type: "authentication_error" } });
  if (reply.mode === "minimax-billing") return send(response, 200, { base_resp: { status_code: 1008, status_msg: "insufficient balance" } });
  return send(response, 200, { data: { image_base64: [TINY_PNG] }, base_resp: { status_code: 0 } });
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
  let redirect: string | undefined, generationReplies = 0;
  const reply = (response: ServerResponse, value: { mode: StubMode; redirect?: string }) => {
    if (generationResponse(response, value)) generationReplies++;
  };
  const settle = (hold: Hold) => {
    hold.settled = true;
    if (activeHold === hold) activeHold = undefined;
  };
  const release = (hold: Hold) => {
    if (hold.released) return;
    hold.released = true;
    if (hold.response && !hold.settled) {
      reply(hold.response, hold.reply!);
      settle(hold);
    }
  };
  const handleGeneration = async (request: IncomingMessage, response: ServerResponse, path: string, responseValue: { mode: StubMode; redirect?: string }, hold?: Hold) => {
    try {
      const body = await readBody(request);
      generationRequests.push({ path, body });
      if (hold) {
        if (closing || response.destroyed) { hold.reject(new Error("E2E fixture request aborted")); settle(hold); return; }
        hold.response = response; hold.reply = responseValue;
        response.once("close", () => settle(hold));
        hold.resolve();
        if (!hold.released) return;
      }
      reply(response, responseValue);
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
      const responseValue = { mode: responseMode, ...(redirect ? { redirect } : {}) }; redirect = undefined;
      const pending = handleGeneration(request, response, path, responseValue, hold);
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
    get generationReplies() { return generationReplies; },
    setMode(next) { mode = next; },
    redirectNextGeneration(target) {
      const url = new URL(target);
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.username || url.password || redirect) throw new Error("E2E_STUB_REDIRECT");
      redirect = target;
    },
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
