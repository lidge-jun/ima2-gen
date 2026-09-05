import { createServer, type ServerResponse, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import type { Route } from "@playwright/test";

export interface TrackingStream {
  connections: Array<{ id: number; closed: boolean; frames: number }>;
  violations: string[];
  routeEvents(route: Route): Promise<void>;
  ready(): Promise<void>;
  emit(event: string, data: Record<string, unknown>, id: number): void;
  close(): Promise<void>;
}

function validateOrigin(appOrigin: string): void {
  const origin = new URL(appOrigin);
  if (origin.origin !== appOrigin || origin.protocol !== "http:" || origin.hostname !== "127.0.0.1"
    || !origin.port || origin.port === "3333" || origin.username || origin.password) {
    throw new Error("WP07 requires an owned ephemeral J6 origin");
  }
}

class OwnedTrackingStream implements TrackingStream {
  readonly connections: TrackingStream["connections"] = [];
  readonly violations: string[] = [];
  private readonly path = `/wp07-${randomUUID()}`;
  private readonly responses = new Map<ServerResponse, TrackingStream["connections"][number]>();
  private readonly waiters = new Set<(error?: Error) => void>();
  private readonly server = createServer((request, response) => this.accept(request, response));
  private closed = false;
  private destination = "";
  constructor(private readonly appOrigin: string) {
    this.server.on("error", () => {
      const error = this.fail("Native stream server error");
      for (const settle of [...this.waiters]) settle(error);
    });
  }
  private fail(reason: string): Error { this.violations.push(reason); return new Error(reason); }
  private accept(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? "/", this.appOrigin);
    if (this.closed || request.method !== "GET" || url.pathname !== this.path) {
      this.fail("Unexpected native stream request"); response.writeHead(404).end(); return;
    }
    const connection = { id: this.connections.length + 1, closed: false, frames: 0 };
    this.connections.push(connection); this.responses.set(response, connection);
    response.once("close", () => { connection.closed = true; this.responses.delete(response); });
    response.once("error", () => { this.fail("Native stream response error"); response.destroy(); });
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
      Connection: "keep-alive", "Access-Control-Allow-Origin": this.appOrigin });
    response.flushHeaders();
    for (const settle of [...this.waiters]) settle();
  }
  async listen(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.server.once("error", reject);
        this.server.listen(0, "127.0.0.1", () => { this.server.off("error", reject); resolve(); });
      });
      const address = this.server.address();
      if (!address || typeof address === "string") throw this.fail("Missing owned stream address");
      this.destination = `http://127.0.0.1:${address.port}${this.path}`;
    } catch (error) { this.server.close(); throw error; }
  }
  async routeEvents(route: Route): Promise<void> {
      try {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() !== "GET" || url.origin !== this.appOrigin || url.pathname !== "/api/events") {
          throw this.fail("Unexpected events route");
        }
        const headers = await request.allHeaders();
        if (headers.cookie || headers.authorization) throw this.fail("Unexpected credential on cleanroom stream");
        // Only the unpredictable owned endpoint is reachable; no cookies/credentials are forwarded.
        await route.continue({ url: this.destination + url.search,
          headers: { Accept: "text/event-stream", Origin: this.appOrigin } });
      } catch (error) { this.violations.push("Events routing failed"); await route.abort().catch(() => {}); throw error; }
  }
  ready(): Promise<void> {
      if (this.closed) return Promise.reject(new Error("Tracking stream closed"));
      if (this.responses.size > 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const settle = (error?: Error) => {
          clearTimeout(timer); this.waiters.delete(settle); error ? reject(error) : resolve();
        };
        const timer = setTimeout(() => settle(this.fail("Native stream readiness deadline")), 5_000);
        this.waiters.add(settle);
      });
  }
  emit(event: string, data: Record<string, unknown>, id: number): void {
      if (this.closed || this.responses.size === 0) throw this.fail("No open native stream");
      if (!/^[a-z-]+$/.test(event) || !Number.isSafeInteger(id) || id < 1) throw this.fail("Invalid frame identity");
      const frame = `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      if (Buffer.byteLength(frame) > 4096) throw this.fail("Oversized fixture frame");
      for (const [response, connection] of this.responses) {
        try {
          if (response.destroyed || !response.write(frame)) throw this.fail("Blocked or closed fixture stream");
          connection.frames++;
        } catch (error) { this.violations.push("Frame delivery failed"); throw error; }
      }
  }
  async close(): Promise<void> {
      if (this.closed) return;
      this.closed = true;
      for (const settle of [...this.waiters]) settle(new Error("Tracking stream closed"));
      const responseCloses = [...this.responses.keys()].map((response) => new Promise<void>((resolve) => {
        response.once("close", resolve); response.destroy();
      }));
      try {
        await Promise.all(responseCloses);
        await new Promise<void>((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
      }
      finally { this.server.closeAllConnections(); this.server.removeAllListeners(); }
  }
}

export async function startTrackingStream(appOrigin: string): Promise<TrackingStream> {
  validateOrigin(appOrigin);
  const stream = new OwnedTrackingStream(appOrigin);
  await stream.listen();
  return stream;
}
