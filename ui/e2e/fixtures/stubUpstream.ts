import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export type StubMode = "minimax" | "oauth-expired" | "minimax-billing";

export type StubHandle = {
  url: string;
  close(): Promise<void>;
  calls: string[];
  externalAttempts: string[];
};

const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function send(res: ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": contentType });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export async function startStubUpstream(mode: StubMode = "minimax"): Promise<StubHandle> {
  const calls: string[] = [];
  const externalAttempts: string[] = [];
  const server: Server = createServer((req, res) => {
    const url = req.url || "/";
    const host = String(req.headers.host || "");
    calls.push(`${req.method || "GET"} ${url}`);
    if (host && !host.startsWith("127.0.0.1") && !host.startsWith("localhost")) externalAttempts.push(`${host}${url}`);
    if (mode === "oauth-expired") {
      send(res, 401, {
        error: { message: "token is expired. sign in again", type: "authentication_error" },
      });
      return;
    }
    if (url.includes("/models")) {
      send(res, 200, { data: [{ id: "image-01" }], base_resp: { status_code: 0 } });
      return;
    }
    if (url.includes("/image_generation")) {
      void readBody(req).then(() => {
        if (mode === "minimax-billing") {
          send(res, 200, { base_resp: { status_code: 1008, status_msg: "insufficient balance" } });
          return;
        }
        send(res, 200, {
          data: { image_base64: [TINY_PNG] },
          base_resp: { status_code: 0 },
        });
      });
      return;
    }
    send(res, 404, { error: "not stubbed" });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("stub failed to bind");
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    calls,
    externalAttempts,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
