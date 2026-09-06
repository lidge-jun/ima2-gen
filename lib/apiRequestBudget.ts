import type { NextFunction, Request, Response } from "express";

interface ApiRequestPolicy {
  readonly windowMs: number;
  readonly requests: number;
  readonly mutations: number;
  readonly maxPeers: number;
}

interface PeerWindow { expires: number; requests: number; mutations: number }

/** Express routes are case-insensitive by default; do not protect /apix as /api. */
export function isApiRequestPath(path: string): boolean {
  return /^\/api(?:\/|$)/i.test(path);
}

function rejectBudget(res: Response, expires: number, now: number) {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil((expires - now) / 1000))));
  return res.status(429).json({
    error: { code: "API_RATE_LIMITED", message: "Too many API requests; retry after the indicated delay" },
  });
}

/** App-owned windows, bounded memory and socket identity (never proxy headers). */
export function createApiRequestBudget(policy: ApiRequestPolicy, clock = Date.now) {
  const peers = new Map<string, PeerWindow>();
  function prune(now: number): number {
    let earliest = now + policy.windowMs;
    for (const [peer, window] of peers) {
      if (window.expires <= now) peers.delete(peer);
      else earliest = Math.min(earliest, window.expires);
    }
    return earliest;
  }
  return function apiRequestBudget(req: Request, res: Response, next: NextFunction) {
    if (!isApiRequestPath(req.path)) return next();
    const now = clock();
    const peer = req.socket.remoteAddress ?? "unknown-peer";
    let window = peers.get(peer);
    if (!window || window.expires <= now) {
      if (!window && peers.size >= policy.maxPeers) {
        const earliest = prune(now);
        if (peers.size >= policy.maxPeers) return rejectBudget(res, earliest, now);
      }
      window = { expires: now + policy.windowMs, requests: 0, mutations: 0 };
      peers.set(peer, window);
    }
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (window.requests >= policy.requests || (mutation && window.mutations >= policy.mutations)) {
      return rejectBudget(res, window.expires, now);
    }
    window.requests++;
    if (mutation) window.mutations++;
    return next();
  };
}
