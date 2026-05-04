import { createServer, type Server } from "node:net";

const DEFAULT_MAX_ATTEMPTS = 20;

export function parseLocalhostPortFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const port = Number(parsed.port);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

export function stripV1FromOAuthUrl(url: string) {
  return String(url || "").replace(/\/v1\/?$/, "");
}

export function parseOAuthReadyUrl(line: string) {
  const text = String(line || "");
  const match = text.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/v1)?/i);
  return match ? stripV1FromOAuthUrl(match[0]) : null;
}

function checkPort(port: number, host?: string) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
      .once("error", (err: NodeJS.ErrnoException) => {
        probe.close(() => {});
        reject(err);
      })
      .once("listening", () => {
        probe.close(() => resolve(true));
      });
    if (host) probe.listen(port, host);
    else probe.listen(port);
  });
}

interface PortOptions {
  maxAttempts?: number;
  host?: string;
  label?: string;
  onFallback?: (info: { label: string; requestedPort: number; actualPort: number }) => void;
}

export async function findAvailablePort(startPort: number, options: PortOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const host = options.host;
  for (let offset = 0; offset <= maxAttempts; offset++) {
    const port = Number(startPort) + offset;
    try {
      await checkPort(port, host);
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EADDRINUSE") throw err;
    }
  }
  const err = new Error(`No available port found from ${startPort} to ${Number(startPort) + maxAttempts}`) as Error & { code?: string };
  err.code = "PORT_RANGE_EXHAUSTED";
  throw err;
}

interface ListenLike {
  listen: ((port: number, host: string) => Server) | ((port: number) => Server) | ((...args: never[]) => Server);
}

function listenOnce(app: ListenLike, port: number, host?: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const listen = app.listen as (...args: unknown[]) => Server;
    const server = host ? listen.call(app, port, host) : listen.call(app, port);
    server.once("listening", () => resolve(server));
    server.once("error", (err: NodeJS.ErrnoException) => reject(err));
  });
}

export async function listenWithPortFallback(app: ListenLike, startPort: number, options: PortOptions = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const host = options.host;
  const label = options.label || "server";
  for (let offset = 0; offset <= maxAttempts; offset++) {
    const port = Number(startPort) + offset;
    try {
      const server = await listenOnce(app, port, host);
      if (offset > 0 && typeof options.onFallback === "function") {
        options.onFallback({ label, requestedPort: Number(startPort), actualPort: port });
      }
      return server;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "EADDRINUSE") throw err;
      if (offset >= maxAttempts) {
        const exhausted = new Error(`${label} port range exhausted from ${startPort} to ${port}`) as Error & { code?: string; cause?: unknown };
        exhausted.code = "PORT_RANGE_EXHAUSTED";
        exhausted.cause = err;
        throw exhausted;
      }
    }
  }
  throw new Error(`${label} failed to bind`);
}

export function getServerPort(server: Server | null | undefined) {
  const address = server?.address?.();
  return typeof address === "object" && address ? address.port : null;
}
