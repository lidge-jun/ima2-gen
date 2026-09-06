import express from "express";
import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { RequestHandler, Response } from "express";
import type { RuntimeContext } from "./runtimeContext.js";
import type { createLocalLanAccess } from "./localLanAccess.js";
import { isLocalBind } from "./localAccessPolicy.js";

function missing(res: Response, sidecar = false): void {
  res.status(404).type("text/plain").end(sidecar ? "Generated metadata is not public" : "Generated media not found");
}

function contained(root: string, path: string): boolean {
  return path !== root && path.startsWith(`${root}${sep}`);
}

/** Mount at /generated; access.mediaHeaders must ALSO precede the global guard. */
export function createGeneratedMediaAccess(ctx: RuntimeContext, access: ReturnType<typeof createLocalLanAccess>): RequestHandler[] {
  const lan = !isLocalBind(ctx.config.server.host);
  const root = resolve(ctx.config.storage.generatedDir);
  const inspect: RequestHandler = async (req, res, next) => {
    try {
      const raw = req.url.split("?")[0] || "/";
      if (/%(?:2f|5c)/i.test(raw)) return missing(res);
      const decoded = decodeURIComponent(raw);
      if (/[\0\\]/.test(decoded)) return missing(res);
      const lower = decoded.toLowerCase();
      if (lower.endsWith(".json")) return missing(res, true);
      const target = resolve(root, `.${decoded}`);
      if (!contained(root, target)) return missing(res);
      const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
      if (!contained(realRoot, realTarget)) return missing(res);
      if (realTarget.toLowerCase().endsWith(".json")) return missing(res, true);
      if (lower.endsWith(".svg") || realTarget.toLowerCase().endsWith(".svg")) {
        res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
      if (!res.writableEnded && !res.destroyed) next();
    } catch { if (!res.writableEnded && !res.destroyed) missing(res); }
  };
  const serve = express.static(root, lan ? {
    etag: false, lastModified: false, immutable: false, cacheControl: false, redirect: false, index: false,
  } : { maxAge: ctx.config.storage.staticMaxAge, immutable: true, redirect: false, index: false });
  // Containment is a realpath check, not protection against a malicious local FS writer's race.
  return [access.mediaHeaders, access.guard, inspect, (req, res) => {
    if (lan) { delete req.headers["if-none-match"]; delete req.headers["if-modified-since"]; }
    serve(req, res, error => {
      if (res.writableEnded || res.destroyed) return;
      if (error) {
        if (res.headersSent) { res.end(); return; }
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 416 || status === 412) { res.status(status).type("text/plain").end("Generated media request cannot be satisfied"); return; }
        missing(res); return;
      }
      missing(res);
    });
  }];
}
