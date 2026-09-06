import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createServer } from "node:http";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import http2 from "node:http2";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";
import { AsyncResource } from "node:async_hooks";
import { isolateAdditionalNetwork } from "./_executionNetworkIsolation.ts";
import { openGeminiFixture } from "./_geminiTransportFixture.ts";
import { listenOwnedLoopback } from "./_grokImageTransportFixture.ts";
import { executionTestProcess } from "./_executionTestProcess.ts";

if (executionTestProcess(import.meta.url)) {
  test("owned transport may finish after headers, but its lease ends with its server", async () => {
    let forwarded = 0, resume!: () => unknown;
    const sentinel = mock.method(net, "connect", () => { forwarded++; return new net.Socket(); });
    const server = createServer();
    let scope: ReturnType<typeof isolateAdditionalNetwork> | undefined;
    const violations: unknown[] = [];
    try {
      await new Promise<void>(resolve => listenOwnedLoopback(() => server.listen(0, "127.0.0.1", resolve)));
      const address = server.address(); assert.ok(address && typeof address !== "string");
      const options = { host: "127.0.0.1", port: address.port };
      scope = isolateAdditionalNetwork(violations, async () => {
        resume = AsyncResource.bind(() => net.connect(options));
        return new Response("headers returned");
      });
      await scope.fetchOwned(server, `http://127.0.0.1:${address.port}/`);
      resume(); assert.equal(forwarded, 1, "owned response transport survives header settlement");
      assert.throws(() => net.connect(options), /Forbidden fixture network/, "DUT scope is still denied");
      await new Promise<void>(resolve => server.close(() => resolve()));
      assert.throws(resume, /Forbidden fixture network/, "closed-server lease cannot reconnect");
      assert.equal(forwarded, 1); assert.equal(violations.length, 2);
    } finally {
      scope?.restore(); sentinel.mock.restore(); syncBuiltinESMExports();
      if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  test("a forged server shape cannot mint a native caller capability", async () => {
    const violations: unknown[] = [];
    let reached = 0;
    const scope = isolateAdditionalNetwork(violations, async () => { reached++; return new Response("never"); });
    try {
      const forged = { listening: true, address: () => ({ address: "127.0.0.1", port: 54321 }) };
      await assert.rejects(scope.fetchOwned(forged as unknown as import("node:http").Server,
        "http://127.0.0.1:54321/"), /actual owned HTTP server/);
      assert.equal(reached, 0); assert.equal(violations.length, 1);
    } finally { scope.restore(); }
  });

  test("owned HTTP caller leases work across scopes but never enter server handlers", { timeout: 10000 }, async () => {
    const nativeFetch = globalThis.fetch;
    const originalConnect = net.connect;
    let port = 0, inHandler = false, escaped = 0, requests = 0;
    let handlerError: unknown;
    const spy = mock.method(net, "connect", function (this: unknown, ...args: unknown[]) {
      if (inHandler) { escaped++; return new net.Socket(); }
      return Reflect.apply(originalConnect, this, args);
    });
    const server = createServer((_req, res) => {
      void Promise.resolve().then(() => {
        inHandler = true;
        try { assert.throws(() => net.connect({ host: "127.0.0.1", port }), /Forbidden fixture network/); }
        catch (error) { handlerError = error; }
        finally { inHandler = false; }
        requests++; res.setHeader("Connection", "close"); res.end("owned response");
      });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject); listenOwnedLoopback(() => server.listen(0, "127.0.0.1", resolve));
      });
      const address = server.address(); assert.ok(address && typeof address !== "string"); port = address.port;
      const url = `http://127.0.0.1:${port}/owned`;
      let retired: ReturnType<typeof isolateAdditionalNetwork>["fetchOwned"] | undefined;
      for (let round = 0; round < 2; round++) {
        const violations: unknown[] = [];
        const scope = isolateAdditionalNetwork(violations, nativeFetch);
        try {
          if (retired) await assert.rejects(retired(server, url), /inactive fixture/);
          const response = await scope.fetchOwned(server, url, { method: "POST", body: "fixture" });
          assert.equal(await response.text(), "owned response");
          assert.equal(handlerError, undefined); assert.equal(escaped, 0);
          assert.equal(violations.length, 1, "caught handler attempt must stay in the active ledger");
          retired = scope.fetchOwned;
        } finally { scope.restore(); }
      }
      assert.equal(requests, 2);
    } finally {
      spy.mock.restore(); syncBuiltinESMExports();
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections(); await closed;
    }
  });

  test("Gemini native fixture denies resolver, TCP, TLS, HTTP2 and UDP before harmless sentinels", async () => {
    const entries: Array<[object, string]> = [[dns, "resolveTxt"], [dns, "lookupService"],
      [dnsPromises, "resolveTxt"], [dns.Resolver.prototype, "resolve4"], [dnsPromises.Resolver.prototype, "resolve4"],
      [net, "connect"], [net.Socket.prototype, "connect"], [tls, "connect"], [http2, "connect"],
      [dgram, "createSocket"], [dgram.Socket.prototype, "send"]];
    const saved = entries.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));
    let reached = 0;
    const sentinels = entries.map(() => () => { reached++; return undefined; });
    let fixture: Awaited<ReturnType<typeof openGeminiFixture>> | undefined;
    try {
      entries.forEach(([target, key], index) => Object.defineProperty(target, key,
        { configurable: true, writable: true, value: sentinels[index] }));
      syncBuiltinESMExports(); fixture = await openGeminiFixture();
      for (const [target, key] of entries) assert.throws(() => Reflect.apply(Reflect.get(target, key), target, []), /Forbidden fixture network/);
      assert.equal(reached, 0);
      await assert.rejects(fixture.close(), /Isolation violations/); fixture = undefined;
      entries.forEach(([target, key], index) => assert.equal(Reflect.get(target, key), sentinels[index]));
    } finally {
      if (fixture) await fixture.close().catch(() => {});
      entries.forEach(([target, key], index) => { const descriptor = saved[index];
        if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key); });
      syncBuiltinESMExports();
    }
    entries.forEach(([target, key], index) => assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), saved[index]));
  });

  for (const malformed of ["CONNECT", "disturbed-body"] as const) test(`Gemini ${malformed} normalization failure survives caught fetch rejection`, async () => {
    const fixture = await openGeminiFixture();
    try {
      if (malformed === "CONNECT") await assert.rejects(fetch("https://fixture.invalid", { method: "CONNECT" }));
      else {
        const request = new Request("https://fixture.invalid", { method: "POST", body: "consumed" });
        await request.text(); await assert.rejects(fetch(request));
      }
      assert.equal(fixture.calls.length, 0);
    } finally { await assert.rejects(fixture.close(), /Expected values/); }
  });
}
