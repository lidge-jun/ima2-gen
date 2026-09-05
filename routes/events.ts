import type { Express, Request, Response } from "express";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { subscribe, replaySince, hasReplayGap, replayOldestId, latestEventId, MAX_SSE_LISTENERS, type BusEvent } from "../lib/eventBus.js";
import { SSE_STREAM_POLICY } from "../lib/eventsPolicy.js";

let activeConnections = 0;
const HEARTBEAT_MS = 15_000;

function formatSse(ev: BusEvent): string {
  // jobSeq and envelope are additive: the publisher already built them, so this
  // only serializes. Consumers that ignore the new fields see the old payload.
  const payload: Record<string, unknown> = { ...ev.data, jobId: ev.jobId };
  if (ev.jobSeq !== undefined) payload.jobSeq = ev.jobSeq;
  if (ev.envelope !== undefined) payload.envelope = ev.envelope;
  return `id: ${ev.id}\nevent: ${ev.event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function parseLastEventIdHeader(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  return parseInt(raw?.split(",", 1)[0]?.trim() ?? "", 10);
}

class EventConnection {
  private closed = false;
  private pumping = false;
  private blocked = false;
  private unsubscribe: () => void = () => {};
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private deadline: ReturnType<typeof setTimeout> | undefined;

  constructor(private req: Request, private res: Response, private cursor: number) {}

  start(): void {
    activeConnections++;
    this.req.on("close", this.close);
    this.res.on("close", this.close);
    this.res.on("error", this.close);
    this.res.on("drain", this.drain);
    try {
      this.res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      this.res.setHeader("Cache-Control", "no-cache, no-transform");
      this.res.setHeader("Connection", "keep-alive");
      this.res.setHeader("X-Accel-Buffering", "no");
      this.res.flushHeaders?.();
      if (this.closed) return;
      this.unsubscribe = subscribe(this.live);
      this.pump();
      if (!this.closed) this.heartbeat = setInterval(this.ping, HEARTBEAT_MS);
    } catch {
      this.close();
    }
  }

  private write(chunk: string): boolean {
    if (this.closed || this.blocked) return false;
    if (this.res.writableEnded || this.res.destroyed) { this.close(); return false; }
    try {
      const ready = this.res.write(chunk);
      if (this.closed) return false;
      if (!ready) {
        this.blocked = true;
        this.deadline = setTimeout(this.close, SSE_STREAM_POLICY.drainTimeoutMs);
      }
      return ready;
    } catch {
      this.close();
      return false;
    }
  }

  private gap(): boolean {
    if (!hasReplayGap(this.cursor)) return true;
    const oldestAvailableId = replayOldestId();
    const data = JSON.stringify({ lastEventId: this.cursor, oldestAvailableId });
    this.cursor = oldestAvailableId === null ? latestEventId() : oldestAvailableId - 1;
    return this.write(`event: replay-gap\ndata: ${data}\n\n`);
  }

  private pump(): void {
    if (this.closed || this.blocked || this.pumping) return;
    this.pumping = true;
    try {
      do {
        if (!this.gap()) return;
        for (const ev of replaySince(this.cursor)) {
          // write(false) accepts the chunk; drain must start AFTER this ID.
          this.cursor = ev.id;
          if (!this.write(formatSse(ev))) return;
        }
      } while (!this.closed && this.cursor < latestEventId());
    } finally {
      this.pumping = false;
    }
  }

  private live = (ev: BusEvent): void => {
    if (this.closed || this.blocked || this.pumping || ev.id <= this.cursor) return;
    if (ev.id !== this.cursor + 1) { this.pump(); return; }
    this.pumping = true;
    try {
      this.cursor = ev.id;
      this.write(formatSse(ev));
    } finally {
      this.pumping = false;
    }
    this.pump();
  };

  private ping = (): void => {
    if (!this.blocked && !this.pumping) this.write(": ping\n\n");
  };

  private drain = (): void => {
    if (this.closed || !this.blocked) return;
    clearTimeout(this.deadline);
    this.deadline = undefined;
    this.blocked = false;
    this.pump();
  };

  private close = (): void => {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe();
    clearInterval(this.heartbeat);
    clearTimeout(this.deadline);
    this.req.off("close", this.close);
    this.res.off("close", this.close);
    this.res.off("error", this.close);
    this.res.off("drain", this.drain);
    activeConnections--;
    if (!this.res.destroyed) this.res.destroy();
  };
}

export function registerEventsRoute(app: Express, _ctx: RouteRuntimeContext) {
  app.get("/api/events", (req, res) => {
    if (activeConnections >= MAX_SSE_LISTENERS) {
      return res.status(503).json({
        error: { code: "SSE_CAPACITY", message: "Too many event stream connections" },
      });
    }

    const headerLastId = parseLastEventIdHeader(req.headers["last-event-id"]);
    const queryLastId = parseInt(String(req.query.lastEventId ?? ""), 10);
    const lastId = Number.isSafeInteger(headerLastId) ? headerLastId : queryLastId;
    const cursor = Number.isSafeInteger(lastId) ? Math.max(0, lastId) : latestEventId();
    new EventConnection(req, res, cursor).start();
  });
}
