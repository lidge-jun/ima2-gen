import { createServer } from "node:net";

const DEFAULT_MAX_ATTEMPTS = 20;

export function parseLocalhostPortFromUrl(url) {
  try {
    const parsed = new URL(url);
    const port = Number(parsed.port);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

export function stripV1FromOAuthUrl(url) {
  return String(url || "").replace(/\/v1\/?$/, "");
}

export function parseOAuthReadyUrl(line) {
  const text = String(line || "");
  const match = text.match(/https?:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/v1)?/i);
  return match ? stripV1FromOAuthUrl(match[0]) : null;
}

function checkPort(port, host) {
  return new Promise((resolve, reject) => {
    const probe = createServer()
      .once("error", (err) => {
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

export async function findAvailablePort(startPort, options = {}) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const host = options.host;
  for (let offset = 0; offset <= maxAttempts; offset++) {
    const port = Number(startPort) + offset;
    try {
      await checkPort(port, host);
      return port;
    } catch (err) {
      if (err?.code !== "EADDRINUSE") throw err;
    }
  }
  const err = new Error(`No available port found from ${startPort} to ${Number(startPort) + maxAttempts}`);
  err.code = "PORT_RANGE_EXHAUSTED";
  throw err;
}

function listenOnce(app, port, host) {
  return new Promise((resolve, reject) => {
    const server = host ? app.listen(port, host) : app.listen(port);
    server.once("listening", () => resolve(server));
    server.once("error", (err) => reject(err));
  });
}

export async function listenWithPortFallback(app, startPort, options = {}) {
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
      if (err?.code !== "EADDRINUSE") throw err;
      if (offset >= maxAttempts) {
        const exhausted = new Error(`${label} port range exhausted from ${startPort} to ${port}`);
        exhausted.code = "PORT_RANGE_EXHAUSTED";
        exhausted.cause = err;
        throw exhausted;
      }
    }
  }
  throw new Error(`${label} failed to bind`);
}

export function getServerPort(server) {
  const address = server?.address?.();
  return typeof address === "object" && address ? address.port : null;
}
