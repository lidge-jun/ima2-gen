import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import type { AppConfig } from "../lib/runtimeContext.js";
import { createLocalAccessPolicy, parsePublicOrigins, protectedRequestPath } from "../lib/localAccessPolicy.ts";

// Partial transport/config fixtures: the pure policy reads only these boundary fields.
function policy(host = "0.0.0.0", publicOrigins: readonly string[] = []) {
  return createLocalAccessPolicy({ server: { host, publicOrigins } } as AppConfig);
}
function request(host: string, options: { origin?: string; localAddress?: string; port?: number; method?: string; site?: string; encrypted?: boolean; raw?: string[] } = {}): Request {
  const headers: Record<string, string> = { host };
  if (options.origin !== undefined) headers.origin = options.origin;
  if (options.site !== undefined) headers["sec-fetch-site"] = options.site;
  return { headers, rawHeaders: options.raw ?? Object.entries(headers).flat(),
    socket: { localAddress: options.localAddress ?? "192.168.1.20", localPort: options.port ?? 49123, encrypted: options.encrypted },
    method: options.method ?? "GET", url: "/api/health", originalUrl: "/api/health" } as unknown as Request;
}

test("pure policy: exact origins normalize, deduplicate, freeze and reject unsafe config", () => {
  const origins = parsePublicOrigins(["HTTPS://Studio.Example:443/", "https://studio.example", "http://studio.example:8080"]);
  assert.deepEqual(origins, ["https://studio.example", "http://studio.example:8080"]);
  assert.equal(Object.isFrozen(origins), true);
  for (const value of [null, undefined, "[]", {}, ["null"], ["file:///tmp"], ["https://*.example"], ["https://u:p@host"],
    ["https://@host"], ["https://host/a/.."], ["https:///host"], ["https://host?"], ["https://host#"], [" https://host"],
    ["https://host", "http://host"], ["https://host:80", "http://host"], ["https://host", "http://host:443"], Array(17).fill("https://host")]) {
    assert.throws(() => parsePublicOrigins(value), { code: "INVALID_PUBLIC_ORIGINS", message: "Invalid public origins configuration" });
  }
});

test("pure policy: actual socket port and IPv4 IPv6 mapped literals; loopback and bind hostname", () => {
  for (const [address, host] of [["192.168.1.20", "192.168.1.20"], ["::ffff:192.168.1.20", "192.168.1.20"],
    ["::ffff:c0a8:114", "192.168.1.20"], ["2001:db8::1", "[2001:db8::1]"]]) {
    assert.equal(policy().resolveOrigin(request(`${host}:49123`, { localAddress: address })), `http://${host}:49123`);
  }
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) assert.equal(policy().resolveOrigin(request(`${host}:49123`)), `http://${host}:49123`);
  assert.equal(policy("studio.lan").resolveOrigin(request("studio.lan:49123")), "http://studio.lan:49123");
  assert.throws(() => policy("192.168.1.20").resolveOrigin(request("localhost:49123")), { code: "LOCAL_HOST_REJECTED" });
  assert.equal(policy().resolveOrigin(request("192.168.1.20:443", { port: 443, encrypted: true })), "https://192.168.1.20");
});

test("pure policy: hostile Host malformed values duplicate raw fields and wrong ports fail", () => {
  for (const host of ["evil.test:49123", "192.168.1.20:80", "0.0.0.0:49123", "user@192.168.1.20:49123", "192.168.1.20:49123/x", "192.168.1.20:49123,evil", " 192.168.1.20:49123"]) {
    assert.throws(() => policy().resolveOrigin(request(host)), { code: "LOCAL_HOST_REJECTED" });
  }
  assert.throws(() => policy().resolveOrigin(request("192.168.1.20:49123", { raw: ["Host", "192.168.1.20:49123", "HOST", "evil.test"] })), { code: "LOCAL_HOST_REJECTED" });
  assert.throws(() => policy().resolveOrigin(request("192.168.1.20:49123", { raw: ["Host", "192.168.1.20:49123", "Origin", "http://192.168.1.20:49123", "origin", "http://evil.test"] })), { code: "LOCAL_ORIGIN_REJECTED" });
});

test("pure policy: explicit TLS overrides socket HTTP, NAT/Vite require exact config; forwarding cannot grant trust", () => {
  const tls = policy("0.0.0.0", ["https://192.168.1.20:49123", "https://studio.example", "http://localhost:5173"]);
  assert.equal(tls.resolveOrigin(request("192.168.1.20:49123")), "https://192.168.1.20:49123");
  assert.throws(() => tls.resolveOrigin(request("192.168.1.20:49123", { origin: "http://192.168.1.20:49123" })), { code: "LOCAL_ORIGIN_REJECTED" });
  assert.equal(tls.resolveOrigin(request("studio.example:443", { origin: "https://studio.example" })), "https://studio.example");
  assert.equal(tls.resolveOrigin(request("localhost:5173", { origin: "http://localhost:5173" })), "http://localhost:5173");
  assert.throws(() => policy().resolveOrigin(request("localhost:5173", { origin: "http://localhost:5173" })), { code: "LOCAL_HOST_REJECTED" });
  const spoof = request("evil.test");
  Object.assign(spoof.headers, { "x-forwarded-host": "studio.example", "x-forwarded-proto": "https", forwarded: "host=studio.example;proto=https" });
  assert.throws(() => tls.resolveOrigin(spoof), { code: "LOCAL_HOST_REJECTED" });
  assert.equal(policy("0.0.0.0", ["https://192.168.1.20:80"]).resolveOrigin(request("192.168.1.20:80", { port: 80 })), "https://192.168.1.20:80");
});

test("pure policy: same origin all methods, cookie mutation requires Origin, hostile browser rejected", () => {
  const p = policy(), origin = "http://192.168.1.20:49123";
  for (const method of ["GET", "POST", "HEAD", "OPTIONS", "DELETE"]) {
    const req = request("192.168.1.20:49123", { method, origin });
    assert.equal(p.resolveOrigin(req), origin);
    assert.doesNotThrow(() => p.checkBrowserRequest(req, origin, true));
  }
  for (const origin of ["null", "http://evil.test", "http://192.168.1.20:49124", "https://192.168.1.20:49123"]) {
    assert.throws(() => p.resolveOrigin(request("192.168.1.20:49123", { origin })), { code: "LOCAL_ORIGIN_REJECTED" });
  }
  for (const site of ["cross-site", "same-site"]) assert.throws(() => p.checkBrowserRequest(request("192.168.1.20:49123", { method: "POST", site }), origin, false), { code: "LOCAL_ORIGIN_REJECTED" });
  assert.throws(() => p.checkBrowserRequest(request("192.168.1.20:49123", { method: "POST" }), origin, true), { code: "LOCAL_ORIGIN_REJECTED" });
  assert.doesNotThrow(() => p.checkBrowserRequest(request("192.168.1.20:49123", { method: "POST" }), origin, false));
});

test("pure policy: encoded mount aliases never fall through; unescaped case remains canonical", () => {
  for (const url of ["/%61pi/health", "/api%2fhealth", "/%67enerated/a.png", "/generated%2fa.png", "/x/../generated/a.png", "/generated\\a.png", "/generated/../../x", "/api/../../x", "/%67enerated/../../x"]) {
    const route = protectedRequestPath({ originalUrl: url } as Request);
    assert.equal(route.api || route.media, true, url); assert.equal(route.alias, true, url);
  }
  assert.deepEqual(protectedRequestPath({ originalUrl: "/API/health?token=x" } as Request), { api: true, media: false, alias: false, path: "/api/health" });
  assert.equal(protectedRequestPath({ originalUrl: "/apix" } as Request).api, false);
  assert.equal(protectedRequestPath({ originalUrl: "/generated/../../x" } as Request).media, true);
  assert.throws(() => protectedRequestPath({ originalUrl: "/generated/%zz" } as Request), { code: "LOCAL_PATH_REJECTED" });
});
