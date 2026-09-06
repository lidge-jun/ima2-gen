import assert from "node:assert/strict";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { syncBuiltinESMExports } from "node:module";
import { bounded, PromiseTracker } from "./_executionTrackedWrites.ts";
import { FixtureClientRequest, type FixtureAddress } from "./_grokImageFixtureStreams.ts";

export interface ImageFixtureRequest {
  url: string;
  method: "GET";
  headers: Headers;
  body: string;
  signal: AbortSignal | undefined;
}
export interface ImageTransportFixture {
  calls: readonly ImageFixtureRequest[];
  resolutions: readonly { hostname: string; addresses: readonly FixtureAddress[] }[];
  violations: readonly unknown[];
  activate(options: {
    hosts: Readonly<Record<string, readonly FixtureAddress[]>>;
    respond(call: ImageFixtureRequest): Response | Promise<Response>;
  }): void;
  deactivate(): Promise<void>;
  drain(timeoutMs?: number): Promise<void>;
  restore(): Promise<void>;
}

type Activation = Parameters<ImageTransportFixture["activate"]>[0];
type NodeCallback = (response: http.IncomingMessage) => void;
type RequestInput = string | URL | http.RequestOptions;

/** Only wrap a synchronous, owned server.listen call; named ESM DNS stays trapped. */
export function listenOwnedLoopback<T>(listen: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(dns, "lookup");
  Object.defineProperty(dns, "lookup", { configurable: true, enumerable: true, writable: true,
    value: (hostname: string, optionsOrCallback: unknown, suppliedCallback?: unknown) => {
      if (hostname !== "127.0.0.1") throw new Error("Owned loopback bind only permits literal 127.0.0.1");
      const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : suppliedCallback;
      assert.ok(typeof callback === "function", "Loopback bind lookup requires a callback");
      const options = typeof optionsOrCallback === "number" ? { family: optionsOrCallback } :
        (optionsOrCallback ?? {}) as { family?: number | string; all?: boolean };
      const family = options.family ?? 0;
      process.nextTick(() => {
        if (family !== 0 && family !== 4 && family !== "IPv4") {
          callback(new Error("Loopback bind has no matching address family"), options.all ? [] : "", 0);
        } else if (options.all) callback(null, [{ address: "127.0.0.1", family: 4 }]);
        else callback(null, "127.0.0.1", 4);
      });
    },
  });
  try { return listen(); }
  finally {
    if (descriptor) Object.defineProperty(dns, "lookup", descriptor);
    else Reflect.deleteProperty(dns, "lookup");
  }
}

function requestArguments(protocol: string, input: RequestInput,
  optionsOrCallback?: http.RequestOptions | NodeCallback, callback?: NodeCallback) {
  const extra = typeof optionsOrCallback === "object" ? optionsOrCallback : {};
  const base = typeof input === "string" || input instanceof URL ? {} : input;
  const options = { ...base, ...extra };
  const url = typeof input === "string" || input instanceof URL ? new URL(input) :
    new URL(`${options.protocol ?? protocol}//${options.hostname ?? options.host ?? "localhost"}${options.port ? `:${options.port}` : ""}${options.path ?? "/"}`);
  // A URL plus conflicting option overrides must not evade the literal host map.
  if (options.hostname) url.hostname = options.hostname;
  if (options.port) url.port = String(options.port);
  if (options.protocol) url.protocol = options.protocol;
  if (options.path) { const path = new URL(options.path, url); url.pathname = path.pathname; url.search = path.search; }
  const headers = new Headers();
  if (Array.isArray(options.headers)) {
    for (let i = 0; i < options.headers.length; i += 2) headers.append(options.headers[i]!, options.headers[i + 1]!);
  } else {
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
    }
  }
  return { options, url, headers, callback: typeof optionsOrCallback === "function" ? optionsOrCallback : callback };
}

/** No production import, native fallback, socket, DNS query, or process launch lives here. */
export function installGrokImageTransportFixture(): ImageTransportFixture {
  const calls: ImageFixtureRequest[] = [];
  const resolutions: Array<{ hostname: string; addresses: readonly FixtureAddress[] }> = [];
  const violations: unknown[] = [];
  const inactiveViolations: unknown[] = [];
  const work = new PromiseTracker();
  const restorations: Array<() => void> = [];
  let active: Activation | undefined;
  let restored = false;
  const failure = (error: unknown, signal?: AbortSignal) => {
    if (!(signal?.aborted && error === signal.reason) && !violations.includes(error)) violations.push(error);
  };
  const deny = (message: string): never => {
    const error = new Error(message);
    if (!active) inactiveViolations.push(error);
    failure(error); throw error;
  };
  const addressesFor = (hostname: string) => {
    if (!active) return deny("Image transport outside active fixture");
    if (!Object.hasOwn(active.hosts, hostname)) return deny(`Unmatched image fixture host: ${hostname}`);
    return active.hosts[hostname]!.map((address) => ({ ...address }));
  };
  const lookup = async (hostname: string, options?: { all?: boolean; family?: number } | number) => {
    try {
      const addresses = addressesFor(hostname);
      resolutions.push({ hostname, addresses });
      const family = typeof options === "number" ? options : options?.family;
      const matching = addresses.filter((address) => !family || address.family === family);
      if (typeof options === "object" && options.all) return matching;
      return matching[0] ?? deny("Image fixture DNS has no matching address family");
    } catch (error) { failure(error); throw error; }
  };
  const request = (protocol: string, input: RequestInput,
    optionsOrCallback?: http.RequestOptions | NodeCallback, callback?: NodeCallback) => {
    try {
      if (!active) return deny("Image transport outside active fixture");
      const args = requestArguments(protocol, input, optionsOrCallback, callback);
      assert.equal(args.options.method ?? "GET", "GET", "Only artifact GET is supported");
      const hostname = args.url.hostname.replace(/^\[|\]$/g, "");
      const family = isIP(hostname);
      const addresses = family ? [{ address: hostname, family: family as 4 | 6 }] : addressesFor(hostname);
      const call: ImageFixtureRequest = { url: args.url.href, method: "GET", headers: args.headers,
        body: "", signal: args.options.signal };
      const respond = active.respond;
      const nodeRequest = new FixtureClientRequest({ call, options: args.options, addresses,
        track: (promise) => { work.track(promise); }, failure: (error) => failure(error, call.signal),
        respond: () => { calls.push(call); return respond(call); },
      });
      if (args.callback) nodeRequest.once("response", args.callback);
      return nodeRequest;
    } catch (error) { failure(error); throw error; }
  };
  const patch = (target: object, name: string, value: unknown) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    Object.defineProperty(target, name, { configurable: true, enumerable: descriptor?.enumerable ?? true, writable: true, value });
    restorations.push(() => { if (descriptor) Object.defineProperty(target, name, descriptor); else Reflect.deleteProperty(target, name); });
  };
  try {
    patch(dnsPromises, "lookup", lookup);
    patch(dns, "lookup", () => deny("Default DNS lookup forbidden; pinned custom lookup required"));
    for (const [target, protocol] of [[http, "http:"], [https, "https:"]] as const) {
      const fake = (input: RequestInput, options?: http.RequestOptions | NodeCallback, callback?: NodeCallback) => request(protocol, input, options, callback);
      patch(target, "request", fake);
      patch(target, "get", (input: RequestInput, options?: http.RequestOptions | NodeCallback, callback?: NodeCallback) => {
        const result = fake(input, options, callback); result.end(); return result;
      });
    }
    syncBuiltinESMExports();
  } catch (error) { for (const restore of restorations.reverse()) restore(); syncBuiltinESMExports(); throw error; }
  const drain = async (timeoutMs = 5000) => {
    try {
      await bounded((async () => {
        // Let nextTick error/close and queued late response handlers enroll their work.
        for (let turn = 0; turn < 2; turn++) {
          await work.drain(timeoutMs);
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
        await work.drain(timeoutMs);
      })(), timeoutMs);
    } catch (error) { throw error; }
  };
  return { calls, resolutions, violations, activate(options) {
    assert.ok(!restored && !active && !work.pending.size, "Image fixture is restored, active, or unsettled");
    assert.deepEqual(inactiveViolations, [], "Pre-activation network violations must not be erased");
    calls.length = 0; resolutions.length = 0; violations.length = 0;
    active = { respond: options.respond, hosts: Object.fromEntries(Object.entries(options.hosts).map(
      ([hostname, addresses]) => [hostname, addresses.map((address) => ({ ...address }))])) };
  }, drain, async deactivate() { await drain(); active = undefined; }, async restore() {
    if (restored) return;
    await drain();
    active = undefined;
    for (const restore of restorations.reverse()) restore();
    syncBuiltinESMExports(); restored = true;
  } };
}
