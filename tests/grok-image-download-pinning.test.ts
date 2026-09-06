import assert from "node:assert/strict";
import dns from "node:dns";
import promiseDns from "node:dns/promises";
import http, { type ClientRequest } from "node:http";
import https from "node:https";
import { channel } from "node:diagnostics_channel";
import { syncBuiltinESMExports } from "node:module";
import type { AddressInfo, LookupFunction, Socket } from "node:net";
import { test, type TestContext } from "node:test";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { bounded } from "./_executionTrackedWrites.ts";
import { deferred, eventTurn, IMAGE_BYTES, isolateDownloadConfig } from "./_grokDownloadPolicyCases.ts";

async function ownedServer() {
  const sockets = new Set<Socket>();
  const observed = { calls: 0, host: "" };
  const server = http.createServer((req, res) => {
    observed.calls++; observed.host = req.headers.host ?? "";
    assert.equal(req.method, "GET"); assert.equal(req.url, "/image");
    for (const name of ["authorization", "cookie", "referer"]) assert.equal(req.headers[name], undefined);
    res.writeHead(200, { "content-type": "image/png", "content-length": String(IMAGE_BYTES.length) });
    res.end(IMAGE_BYTES);
  });
  server.on("connection", (socket) => {
    sockets.add(socket); socket.once("close", () => sockets.delete(socket));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    });
    return { server, sockets, observed, port: (server.address() as AddressInfo).port };
  } catch (error) { server.close(); throw error; }
}

function controlledDns(t: TestContext) {
  const observed = { resolutions: 0, defaults: 0 };
  const dnsMock = t.mock.method(promiseDns, "lookup", async (hostname: string, options: unknown) => {
    assert.equal(hostname, "pinning.fixture.invalid", "only the owned exact name may resolve");
    assert.deepEqual(options, { all: true });
    assert.equal(++observed.resolutions, 1, "second resolver call is forbidden");
    return [{ address: "127.0.0.1", family: 4 }];
  });
  const defaultMock = t.mock.method(dns, "lookup", () => {
    observed.defaults++;
    throw new Error("NATIVE_PINNING_DEFAULT_DNS_FORBIDDEN");
  });
  syncBuiltinESMExports();
  return { observed, restore() { dnsMock.mock.restore(); defaultMock.mock.restore(); syncBuiltinESMExports(); } };
}

type ResponseCallback = (response: http.IncomingMessage) => void;
function guardedLookup(lookup: LookupFunction): LookupFunction {
  assert.equal(typeof lookup, "function");
  return (hostname, options, callback) => lookup(hostname, options, (error, address, family) => {
    if (error) { callback(error, []); return; }
    try {
      if (options.all) {
        assert.ok(Array.isArray(address) && address.length > 0);
        for (const entry of address) {
          assert.equal(entry.address, "127.0.0.1");
          assert.equal(entry.family, 4);
        }
      } else {
        assert.equal(address, "127.0.0.1");
        assert.equal(family, 4);
      }
    } catch {
      // Deny before Node receives a usable address; never turn an unsafe answer
      // into a loopback success or let an asynchronous validation throw escape.
      callback(new Error("NATIVE_PINNING_LOOKUP_TARGET_FORBIDDEN"), []);
      return;
    }
    callback(null, address, family); // Preserve validated values, without coercion.
  });
}

function guardedArguments(input: unknown, options: unknown, callback: unknown, expected: string) {
  assert.ok(typeof input === "string" || input instanceof URL, "native pinning requires an explicit owned URL");
  const url = new URL(input);
  assert.equal(url.href, expected, "native pinning forbids every unowned destination");
  assert.equal(url.protocol, "http:");
  const opts = (typeof options === "function" || options === undefined ? {} : options) as http.RequestOptions;
  assert.ok(opts && typeof opts === "object");
  for (const key of ["hostname", "host", "protocol", "port", "path", "socketPath", "createConnection", "defaultPort", "auth"]) {
    assert.equal(key in opts, false, `native pinning forbids ${key} overrides`);
  }
  assert.equal(opts.method ?? "GET", "GET");
  assert.equal(opts.agent, false, "owned pinning does not use a pooled or custom agent");
  const cb = (typeof options === "function" ? options : callback) as ResponseCallback | undefined;
  assert.ok(cb === undefined || typeof cb === "function");
  // Missing lookup stays missing so the deliberate negative hits default DNS.
  const guardedOptions = opts.lookup === undefined ? opts : { ...opts, lookup: guardedLookup(opts.lookup) };
  return [url, guardedOptions, cb] as const;
}

function guardNativeTransport(t: TestContext, expected: string) {
  const nativeHttp = http.request;
  const observed = { delegated: 0, refused: 0 };
  const guarded = (input: unknown, options?: unknown, callback?: unknown) => {
    let args: ReturnType<typeof guardedArguments>;
    try { args = guardedArguments(input, options, callback, expected); }
    catch (error) { observed.refused++; throw error; }
    observed.delegated++;
    return nativeHttp(...args); // Real request/socket; inputs and lookup outputs are guarded.
  };
  const deny = () => { observed.refused++; throw new Error("NATIVE_PINNING_UNOWNED_TRANSPORT"); };
  // This input-validated spy preserves Node's overloaded call surface, not a fake response.
  const request = t.mock.method(http, "request", guarded as unknown as typeof http.request);
  const tls = t.mock.method(https, "request", deny);
  const httpGet = t.mock.method(http, "get", deny); const httpsGet = t.mock.method(https, "get", deny);
  syncBuiltinESMExports();
  return { observed, restore() {
    request.mock.restore(); tls.mock.restore(); httpGet.mock.restore(); httpsGet.mock.restore(); syncBuiltinESMExports();
  } };
}

function observeNativeClient(port: number, requests: ClientRequest[]) {
  const socketClosed = deferred(); const requestClosed = deferred();
  const connected = deferred<{ address: string | undefined; port: number | undefined }>();
  const start = channel("http.client.request.start");
  // Read-only diagnostics observe the real socket behind the input-only request guard.
  const observe = (message: unknown) => {
    assert.ok(message && typeof message === "object" && "request" in message);
    const request = Reflect.get(message, "request") as ClientRequest;
    assert.equal(request.getHeader("host"), `pinning.fixture.invalid:${port}`);
    assert.equal(request.path, "/image"); requests.push(request);
    request.once("close", () => requestClosed.resolve());
    const observeSocket = (socket: Socket) => {
      const record = () => connected.resolve({ address: socket.remoteAddress, port: socket.remotePort });
      if (socket.connecting) socket.once("connect", record); else record();
      socket.once("close", () => socketClosed.resolve());
    };
    if (request.socket) observeSocket(request.socket); else request.once("socket", observeSocket);
  };
  start.subscribe(observe);
  return { connected, socketClosed, requestClosed, close() { start.unsubscribe(observe); } };
}

async function missingLookupFails(origin: string, requests: ClientRequest[]) {
  try {
    await assert.rejects(new Promise<void>((resolve, reject) => {
      try {
        const request = http.request(`${origin}/image`, { agent: false }, () => resolve());
        requests.push(request); request.once("error", reject); request.end();
      } catch (error) { reject(error); }
    }), /NATIVE_PINNING_DEFAULT_DNS_FORBIDDEN/);
  } catch (error) { throw error; }
}

async function proveNativeDownload(fixture: Awaited<ReturnType<typeof ownedServer>>,
  controlled: ReturnType<typeof controlledDns>, requests: ClientRequest[]) {
  const origin = `http://pinning.fixture.invalid:${fixture.port}`;
  const observer = observeNativeClient(fixture.port, requests);
  const controller = new AbortController();
  let pending: Promise<unknown> | undefined;
  const nativeHttp = http.request; const nativeHttps = https.request;
  try {
    const { downloadGrokImageUrl } = await import("../lib/grokImageDownload.js");
    const work = downloadGrokImageUrl(`${origin}/image`, controller.signal, 5_000, { trustedProxyOrigin: origin });
    pending = work;
    const result = await work;
    assert.deepEqual(result.buffer, IMAGE_BYTES);
    assert.equal(result.b64, IMAGE_BYTES.toString("base64")); assert.equal(result.mime, "image/png");
    assert.deepEqual(controlled.observed, { resolutions: 1, defaults: 0 });
    assert.deepEqual(fixture.observed, { calls: 1, host: `pinning.fixture.invalid:${fixture.port}` });
    assert.deepEqual(await bounded(observer.connected.promise), { address: "127.0.0.1", port: fixture.port });
    await bounded(Promise.all([observer.requestClosed.promise, observer.socketClosed.promise]));
    assert.equal(requests.length, 1); assert.equal(requests[0].destroyed, true);
    assert.equal(http.request, nativeHttp); assert.equal(https.request, nativeHttps);
    observer.close();
    // A harness negative oracle, not a production mutation (Main owns that mutation).
    await missingLookupFails(origin, requests);
    assert.deepEqual(controlled.observed, { resolutions: 1, defaults: 1 });
    assert.equal(fixture.observed.calls, 1);
  } finally {
    controller.abort();
    try { if (pending) await bounded(Promise.allSettled([pending])); }
    finally { observer.close(); }
  }
}

if (executionTestProcess(import.meta.url)) {
  test("pinning input guard rejects forged Host and every connection override before native delegation", () => {
    const url = "http://pinning.fixture.invalid:43210/image";
    assert.equal(guardedArguments(url, { agent: false }, undefined, url)[0].href, url);
    for (const input of ["http://8.8.8.8:43210/image", "http://pinning.fixture.invalid:43211/image",
      "https://pinning.fixture.invalid:43210/image", "http://pinning.fixture.invalid:43210/other"]) {
      assert.throws(() => guardedArguments(input, { agent: false, headers: { Host: "pinning.fixture.invalid:43210" } }, undefined, url));
    }
    for (const key of ["hostname", "host", "protocol", "port", "path", "socketPath", "createConnection", "defaultPort", "auth"]) {
      assert.throws(() => guardedArguments(url, { agent: false, [key]: "unowned" }, undefined, url));
    }
  });
  test("pinning lookup guard denies unsafe returned addresses without opening a socket", () => {
    const url = "http://pinning.fixture.invalid:43210/image";
    const unsafe = [
      { all: false, address: "8.8.8.8", family: 4 },
      { all: false, address: "127.0.0.2", family: 4 },
      { all: false, address: "127.1", family: 4 },
      { all: false, address: "127.0.0.1", family: 6 },
      { all: false, address: "127.0.0.1", family: "4" },
      { all: false, address: "::ffff:127.0.0.1", family: 6 },
      { all: true, address: [] },
      { all: true, address: [{ address: "127.0.0.1", family: 4 }, { address: "8.8.8.8", family: 4 }] },
      { all: true, address: [{ address: "127.0.0.1", family: "4" }] },
      { all: true, address: "127.0.0.1", family: 4 },
      { all: false, address: [{ address: "127.0.0.1", family: 4 }] },
    ];
    for (const result of unsafe) {
      const delivered = lookupGuardResult(url, result);
      assert.match(String(delivered[0]), /NATIVE_PINNING_LOOKUP_TARGET_FORBIDDEN/);
      assert.deepEqual(delivered[1], [], "no usable address reaches the native callback");
    }
    for (const result of [{ all: false, address: "127.0.0.1", family: 4 },
      { all: true, address: [{ address: "127.0.0.1", family: 4 }] }]) {
      const delivered = lookupGuardResult(url, result);
      assert.equal(delivered[0], null); assert.equal(delivered[1], result.address);
      assert.equal(delivered[2], result.family);
    }
    const originalError = new Error("owned lookup refusal");
    assert.equal(lookupGuardResult(url, { all: false, error: originalError, address: "8.8.8.8" })[0], originalError);
    assert.equal(guardedArguments(url, { agent: false }, undefined, url)[1].lookup, undefined);
  });
  test("native named-loopback pinning: real HTTP/connect, promise DNS once, no default re-resolution", async (t) => {
    const restoreConfig = await isolateDownloadConfig();
    let fixture: Awaited<ReturnType<typeof ownedServer>> | undefined;
    let controlled: ReturnType<typeof controlledDns> | undefined;
    let guard: ReturnType<typeof guardNativeTransport> | undefined;
    const requests: ClientRequest[] = [];
    try {
      fixture = await ownedServer();
      controlled = controlledDns(t); // Both DNS boundaries installed before download import.
      guard = guardNativeTransport(t, `http://pinning.fixture.invalid:${fixture.port}/image`);
      await proveNativeDownload(fixture, controlled, requests);
      assert.deepEqual(guard.observed, { delegated: 2, refused: 0 });
    } finally {
      try {
        for (const request of requests) request.destroy();
        for (const socket of fixture?.sockets ?? []) socket.destroy();
        if (fixture?.server.listening) {
          await bounded(new Promise<void>((resolve, reject) => fixture!.server.close((error) => error ? reject(error) : resolve())));
        }
        await eventTurn();
      } finally { guard?.restore(); controlled?.restore(); await restoreConfig(); }
    }
    assert.equal(fixture!.server.listening, false); assert.equal(fixture!.sockets.size, 0);
  });
}

function lookupGuardResult(url: string, result: { all: boolean; address: unknown; family?: unknown; error?: Error }) {
  let delivered: unknown[] = [];
  const lookup: LookupFunction = (_hostname, _options, callback) => {
    // Malformed callback values intentionally cross this test-only boundary.
    Reflect.apply(callback, undefined, [result.error ?? null, result.address, result.family]);
  };
  const original = { agent: false as const, lookup };
  const options = guardedArguments(url, original, undefined, url)[1];
  options.lookup!("pinning.fixture.invalid", { all: result.all }, (...args) => { delivered = args; });
  assert.equal(original.lookup, lookup, "do not mutate the DUT's original request options");
  return delivered;
}
