import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import dgram from "node:dgram";
import http2 from "node:http2";
import { Server } from "node:http";
import { syncBuiltinESMExports } from "node:module";

interface CallerLease { owner: AdditionalNetworkIsolation; server: Server; port: number; active: boolean }
const caller = new AsyncLocalStorage<CallerLease>();
let activeIsolation: AdditionalNetworkIsolation | undefined;

function matchesCaller(args: unknown[], lease: CallerLease | undefined): boolean {
  if (!lease?.active || !lease.server.listening) return false;
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (!first || typeof first !== "object") return false;
  const options = first as Record<string, unknown>;
  return options.host === "127.0.0.1" && Number(options.port) === lease.port
    && ["path", "fd", "lookup", "socketPath"].every(key => options[key] === undefined);
}

/** Complements the pinned HTTP/lookup fixture; only its private caller can open TCP. */
class AdditionalNetworkIsolation {
  private readonly leases = new Set<CallerLease>();
  private readonly restores: Array<() => void> = [];
  private readonly seen = new WeakMap<object, Set<string>>();
  private restored = false;

  constructor(private readonly violations: unknown[], private readonly nativeFetch: typeof fetch) {
    assert.equal(activeIsolation, undefined, "Concurrent network fixtures are not supported");
    activeIsolation = this; this.install();
  }

  private patch(target: object, key: string, tcp = false): void {
    if (this.seen.get(target)?.has(key)) return;
    const original: unknown = Reflect.get(target, key);
    if (typeof original !== "function") return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    const keys = this.seen.get(target) ?? new Set<string>(); keys.add(key); this.seen.set(target, keys);
    Object.defineProperty(target, key, { configurable: true, enumerable: descriptor?.enumerable ?? false,
      writable: true, value: function (this: unknown, ...args: unknown[]) {
        // Cached library references must follow the current fixture, not a retired ledger.
        const owner = activeIsolation;
        if (!owner) return Reflect.apply(original, this, args);
        const lease = caller.getStore();
        if (tcp && lease?.owner === owner && matchesCaller(args, lease)) return Reflect.apply(original, this, args);
        const error = new Error(`Forbidden fixture network call: ${key}`);
        owner.violations.push(error); throw error;
      } });
    this.restores.push(() => { if (descriptor) Object.defineProperty(target, key, descriptor); else Reflect.deleteProperty(target, key); });
  }

  private install(): void {
    try {
      for (const target of [dns, dnsPromises]) {
        this.patch(target, "lookupService");
        for (const key of Object.keys(target)) if (/^(resolve|reverse)/.test(key)) this.patch(target, key);
        for (const key of Object.getOwnPropertyNames(target.Resolver.prototype)) {
          if (/^(resolve|reverse)/.test(key)) this.patch(target.Resolver.prototype, key);
        }
      }
      this.patch(net, "connect", true); this.patch(net, "createConnection", true); this.patch(net.Socket.prototype, "connect", true);
      this.patch(tls, "connect"); this.patch(tls.TLSSocket.prototype, "connect"); this.patch(http2, "connect");
      this.patch(dgram, "createSocket"); this.patch(dgram.Socket.prototype, "send"); this.patch(dgram.Socket.prototype, "connect");
      this.patch(globalThis, "WebSocket");
      syncBuiltinESMExports();
    } catch (error) { this.restore(); throw error; }
  }

  async fetchOwned(server: Server, input: Parameters<typeof fetch>[0], init: RequestInit = {}): Promise<Response> {
    let port: number;
    try {
      assert.ok(server instanceof Server, "Caller requires an actual owned HTTP server");
      const address = Server.prototype.address.call(server);
      assert.ok(server.listening && address && typeof address !== "string" && address.address === "127.0.0.1");
      assert.notEqual(address.port, 3333, "User live server port is outside fixture scope");
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, `http://127.0.0.1:${address.port}`);
      assert.equal(url.username + url.password, ""); port = address.port;
    } catch (error) { this.violations.push(error); throw error; }
    assert.equal(activeIsolation, this, "Caller capability belongs to an inactive fixture");
    const lease = { owner: this, server, port, active: true }; this.leases.add(lease);
    try { return await caller.run(lease, () => this.nativeFetch(input, init)); }
    finally { lease.active = false; this.leases.delete(lease); }
  }

  restore(): void {
    if (this.restored) return;
    for (const lease of this.leases) lease.active = false;
    caller.disable();
    for (const restore of [...this.restores].reverse()) restore();
    syncBuiltinESMExports();
    this.restored = true;
    if (activeIsolation === this) activeIsolation = undefined;
  }
}

export function isolateAdditionalNetwork(violations: unknown[], nativeFetch: typeof fetch) {
  const isolation = new AdditionalNetworkIsolation(violations, nativeFetch);
  return { fetchOwned: isolation.fetchOwned.bind(isolation), restore: () => isolation.restore() };
}
