import type { BrowserContext, Route } from "@playwright/test";

export type TransportAttempt = { kind: string; method: string; url: string; allowed: boolean };
export type IsolatedAsset = { contentType: string; body: string | Buffer };
export type IsolatedTraffic = { attempts: TransportAttempt[]; unexpected: string[]; routes: Array<{ method: string; url: string; outcome: string }> };

declare global {
  interface Window { wp08RecordTransport(attempt: TransportAttempt): Promise<void>; wp08Transport: TransportAttempt[] }
}

export async function installIsolatedComponentTransport(context: BrowserContext,
  assets: Map<string, IsolatedAsset>, allowedFetchUrls: string[], traffic: IsolatedTraffic): Promise<void> {
  if (context.pages().length || context.serviceWorkers().length || !assets.size) throw new Error("Component context must be unused");
  const origin = new URL(assets.keys().next().value!);
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || origin.port === "3333") throw new Error("Invalid synthetic origin");
  for (const address of [...assets.keys(), ...allowedFetchUrls]) {
    const url = new URL(address);
    if (url.origin !== origin.origin || url.username || url.password || !assets.has(address)) throw new Error("Unowned component asset");
  }
  const handler = async (route: Route) => {
    const request = route.request();
    const record = { method: request.method(), url: request.url(), outcome: "pending" };
    traffic.routes.push(record);
    try {
      const asset = request.method() === "GET" ? assets.get(request.url()) : undefined;
      if (!asset) {
        traffic.unexpected.push(`${record.method} ${record.url}`);
        record.outcome = "aborted";
        await route.abort("blockedbyclient");
        return;
      }
      await route.fulfill({ status: 200, ...asset }); record.outcome = "fulfilled-synthetic";
    } catch (error) {
      record.outcome = "route-error";
      traffic.unexpected.push(String(error));
      await route.abort("failed").catch(() => {});
    }
  };
  await context.exposeBinding("wp08RecordTransport", (_source, attempt: TransportAttempt) => {
    traffic.attempts.push(attempt);
  });
  await context.addInitScript((urls: string[]) => {
    const allowed = new Set(urls);
    window.wp08Transport = [];
    const record = (kind: string, method: string, url: string, permitted = false) => {
      const item = { kind, method, url, allowed: permitted };
      window.wp08Transport.push(item);
      void window.wp08RecordTransport(item).catch((error: unknown) => console.error("WP08 transport evidence failed", error));
    };
    const denied = () => new DOMException("WP08 transport denied", "SecurityError");
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input), location.href).href;
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const permitted = method === "GET" && allowed.has(url);
      record("fetch", method, url, permitted);
      return permitted ? fetch(input, init) : Promise.reject(denied());
    };
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
      record("xhr", method, String(url)); throw denied();
    };
    navigator.sendBeacon = (url) => { record("beacon", "POST", String(url)); return false; };
    if (navigator.serviceWorker) navigator.serviceWorker.register = (url) => {
      record("serviceWorker", "REGISTER", String(url)); return Promise.reject(denied());
    };
    for (const name of ["EventSource", "WebSocket", "Worker", "SharedWorker"] as const) {
      const original = window[name];
      if (!original) continue;
      Object.defineProperty(window, name, { configurable: true, value: new Proxy(original, {
        construct(_target, args) { record(name, "CONNECT", String(args[0])); throw denied(); },
      }) });
    }
    localStorage.setItem("ima2.locale", "en");
  }, allowedFetchUrls);
  await context.route("**/*", handler);
  await context.routeWebSocket("**/*", (socket) => { traffic.unexpected.push(`websocket ${socket.url()}`); socket.close(); });
  context.on("serviceworker", () => traffic.unexpected.push("serviceworker created"));
}
