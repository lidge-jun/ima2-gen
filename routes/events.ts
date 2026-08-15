import type { Express, Response } from "express";
import type { RouteRuntimeContext } from "../lib/runtimeContext.js";
import { subscribe, replaySince, hasReplayGap, replayOldestId, MAX_SSE_LISTENERS, type BusEvent } from "../lib/eventBus.js";

let activeConnections = 0;

function safeWrite(res: Response, chunk: string): boolean {
  if (res.writableEnded || res.destroyed) return false;
  try {
    res.write(chunk);
    return true;
  } catch {
    return false;
  }
}

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

export function registerEventsRoute(app: Express, _ctx: RouteRuntimeContext) {
  app.get("/api/events", (req, res) => {
    if (activeConnections >= MAX_SSE_LISTENERS) {
      return res.status(503).json({
        error: { code: "SSE_CAPACITY", message: "Too many event stream connections" },
      });
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    activeConnections++;

    const headerLastId = parseLastEventIdHeader(req.headers["last-event-id"]);
    const queryLastId = parseInt(String(req.query.lastEventId ?? ""), 10);
    const lastId = !Number.isNaN(headerLastId) ? headerLastId : queryLastId;
    if (!Number.isNaN(lastId)) {
      if (hasReplayGap(lastId)) {
        const gapPayload = JSON.stringify({
          lastEventId: lastId,
          oldestAvailableId: replayOldestId(),
        });
        if (!safeWrite(res, `event: replay-gap\ndata: ${gapPayload}\n\n`)) {
          activeConnections = Math.max(0, activeConnections - 1);
          return;
        }
      }
      for (const ev of replaySince(lastId)) {
        if (!safeWrite(res, formatSse(ev))) break;
      }
    }

    let cleaned = false;
    const unsub = subscribe((ev) => {
      if (!safeWrite(res, formatSse(ev))) cleanup();
    });

    const heartbeat = setInterval(() => {
      if (!safeWrite(res, ": ping\n\n")) cleanup();
    }, 15_000);

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      unsub();
      clearInterval(heartbeat);
      activeConnections = Math.max(0, activeConnections - 1);
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.end();
        } catch {
          /* socket already torn down */
        }
      }
    }

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);
  });
}
