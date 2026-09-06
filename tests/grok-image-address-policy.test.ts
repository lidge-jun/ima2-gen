import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { getEventListeners } from "node:events";
import { Socket } from "node:net";
import type { LookupAddress } from "node:dns";
import type { GrokImageDownloadPolicy } from "../lib/grokImageDownloadPolicy.ts";

const host = "artifact.fixture.invalid";
const fixtureUrl = `https://${host}/image?signature=SIGNED_QUERY_SENTINEL`;
const calls: string[] = [];
const escapes: string[] = [];
function denyDns(): never { throw new Error("DNS fixture not activated"); }
let lookupFixture: (hostname: string) => LookupAddress[] | Promise<LookupAddress[]> = denyDns;
let resolveTarget: typeof import("../lib/grokImageDownloadPolicy.ts").resolveImageDownloadTarget;
const restores: Array<() => void> = [];

before(async () => {
  try {
    assert.ok(process.execArgv.includes("--experimental-test-module-mocks"));
    const sockets = mock.method(Socket.prototype, "connect", () => {
      escapes.push("socket"); throw new Error("No sockets permitted in address policy tests");
    });
    restores.push(() => sockets.mock.restore());
    const callbackDns = mock.module("node:dns", { namedExports: { lookup: () => {
      escapes.push("callback DNS"); throw new Error("No native DNS permitted");
    } } });
    restores.push(() => callbackDns.restore());
    const dns = mock.module("node:dns/promises", { namedExports: {
      lookup: (hostname: string, options: unknown) => {
        calls.push(hostname);
        assert.deepEqual(options, { all: true });
        return lookupFixture(hostname);
      },
    } });
    restores.push(() => dns.restore());
    // Import SOURCE only after the native DNS sentinel; no emitted graph/config imports.
    ({ resolveImageDownloadTarget: resolveTarget } = await import("../lib/grokImageDownloadPolicy.ts"));
  } catch (error) {
    for (const restore of restores.splice(0).reverse()) restore();
    throw error;
  }
});
beforeEach(() => { calls.length = 0; lookupFixture = denyDns; });
afterEach(() => { assert.deepEqual(escapes, []); });
after(() => { for (const restore of restores.reverse()) restore(); });

function resolve(rawUrl = fixtureUrl, policy: GrokImageDownloadPolicy = {}, signal = new AbortController().signal) {
  return resolveTarget(new URL(rawUrl), policy, signal);
}
function answers(values: LookupAddress[]): void {
  lookupFixture = (hostname) => { assert.equal(hostname, host); return values; };
}
function safeFailure(error: unknown): boolean {
  assert.ok(error instanceof Error);
  assert.equal(Reflect.get(error, "code"), "GROK_IMAGE_DOWNLOAD_FAILED");
  assert.equal(Reflect.get(error, "status"), 502);
  assert.doesNotMatch(error.message + error.stack + JSON.stringify(error),
    /SIGNED_QUERY_SENTINEL|USER_SENTINEL|PASSWORD_SENTINEL|RAW_DNS_SENTINEL|artifact\.fixture/);
  assert.equal(error.cause, undefined);
  return true;
}

test("inactive DNS fails closed with a safe public error", async () => {
  await assert.rejects(resolve(), safeFailure);
  assert.deepEqual(calls, [host]);
});

const deniedV4 = [
  ["0.0.0.0", "0.255.255.255"], ["10.0.0.0", "10.255.255.255"],
  ["100.64.0.0", "100.127.255.255"], ["127.0.0.0", "127.255.255.255"],
  ["169.254.0.0", "169.254.255.255"], ["172.16.0.0", "172.31.255.255"],
  ["192.0.0.0", "192.0.0.255"], ["192.0.2.0", "192.0.2.255"],
  ["192.88.99.0", "192.88.99.255"], ["192.168.0.0", "192.168.255.255"],
  ["198.18.0.0", "198.19.255.255"], ["198.51.100.0", "198.51.100.255"],
  ["203.0.113.0", "203.0.113.255"], ["224.0.0.0", "239.255.255.255"],
  ["240.0.0.0", "255.255.255.255"],
];
for (const range of deniedV4) {
  test(`denies IPv4 CIDR endpoints ${range.join(" - ")} and mapped equivalents`, async () => {
    for (const address of range) {
      answers([{ address, family: 4 }]);
      await assert.rejects(resolve(), safeFailure);
      answers([{ address: `::ffff:${address}`, family: 6 }]);
      await assert.rejects(resolve(), safeFailure);
    }
  });
}

for (const address of [
  "::", "::1", "fe80::1", "fc00::1", "fdff::1", "ff02::1", "100::1",
  "64:ff9b::808:808", "::127.0.0.1", "::8.8.8.8", "::808:808",
  "::ffff:7f00:1", "::ffff:a00:1", "::ffff:c058:6302", "::ffff:c000:201",
  "1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "4000::",
  "2001::", "2001:2::1", "2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff",
  "2001:db8::", "2001:db8:ffff:ffff:ffff:ffff:ffff:ffff",
  "2002::", "2002:ffff:ffff:ffff:ffff:ffff:ffff:ffff",
  "3fff::", "3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff",
]) {
  test(`denies special/compatible IPv6 ${address}`, async () => {
    answers([{ address, family: 6 }]);
    await assert.rejects(resolve(), safeFailure);
  });
}

test("allows public IPv4/IPv6 and exact conservative range neighbors", async () => {
  const ipv4 = ["8.8.8.8", "1.0.0.0", "9.255.255.255", "11.0.0.0", "100.63.255.255",
    "100.128.0.0", "126.255.255.255", "128.0.0.0", "169.253.255.255", "169.255.0.0",
    "172.15.255.255", "172.32.0.0", "192.0.1.0", "192.0.3.0", "192.88.98.255",
    "192.88.100.0", "192.167.255.255", "192.169.0.0", "198.17.255.255", "198.20.0.0",
    "198.51.99.255", "198.51.101.0", "203.0.112.255", "203.0.114.0", "223.255.255.255"];
  const ipv6 = ["2000::", "2001:200::", "2001:db7:ffff:ffff:ffff:ffff:ffff:ffff",
    "2001:db9::", "2003::", "2606:4700:4700::1111", "3ffe:ffff::1", "3fff:1000::",
    "3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "::ffff:8.8.8.8", "::ffff:808:808",
    "0:0:0:0:0:FFFF:0808:0808"];
  const values = [...ipv4.map((address) => ({ address, family: 4 })),
    ...ipv6.map((address) => ({ address, family: 6 }))];
  answers(values);
  const result = await resolve();
  assert.deepEqual(result.addresses, values);
  assert.notEqual(result.addresses, values);
  assert.equal(result.url.href, fixtureUrl);
});

test("IP literals skip DNS, normalize brackets/numeric hosts and retain real family", async () => {
  for (const address of ["127.1", "2130706433", "0x7f000001", "0177.0.0.1", "[::ffff:7f00:1]"]) {
    await assert.rejects(resolve(`https://${address}/image`), safeFailure);
  }
  assert.deepEqual((await resolve("https://[::ffff:8.8.8.8]/")).addresses,
    [{ address: "::ffff:808:808", family: 6 }]);
  assert.deepEqual((await resolve("https://8.8.8.8/")).addresses, [{ address: "8.8.8.8", family: 4 }]);
  assert.deepEqual(calls, []);
});

test("empty, invalid, family-mismatched or mixed DNS sets deny the whole target", async () => {
  for (const invalid of [
    [], [{ address: "8.8.8.8", family: 6 }], [{ address: "2606:4700::1", family: 4 }],
    [{ address: "8.8.8.8", family: 0 }], [{ address: "8.8.8.8", family: "4" }],
    [{ address: "::ffff:8.8.8.8", family: 4 }], [{ address: "[2606:4700::1]", family: 6 }],
    [{ address: "invalid", family: 4 }], [{ address: "fe80::1%en0", family: 6 }],
    [{ address: "", family: 4 }], [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }],
    [{ address: "127.0.0.1", family: 4 }, { address: "8.8.8.8", family: 4 }],
  ]) {
    // Deliberately malformed external resolver records, not an internal type bypass.
    answers(invalid as LookupAddress[]);
    await assert.rejects(resolve(), safeFailure);
  }
});

test("protocol and URL userinfo are rejected before DNS even with exact trust", async () => {
  for (const url of [`http://${host}/image`, `ftp://${host}/image`, "file:///image",
    `https://USER_SENTINEL:PASSWORD_SENTINEL@${host}/image`]) {
    const trust = url.startsWith("http:") ? {} : { trustedProxyOrigin: new URL(url).origin };
    await assert.rejects(resolve(url, trust), safeFailure);
  }
  // WHATWG URL rejects zone identifiers before a URL can reach the policy API.
  assert.throws(() => new URL("https://[fe80::1%25en0]/image"), TypeError);
  assert.deepEqual(calls, []);
});

test("only normalized exact trusted origin grants local HTTP/HTTPS access", async () => {
  answers([{ address: "127.0.0.1", family: 4 }, { address: "::1", family: 6 }]);
  const policy = Object.freeze({ trustedProxyOrigin: `http://${host}:80/config-path` });
  assert.equal((await resolve(`http://${host}/image`, policy)).addresses.length, 2);
  await assert.rejects(resolve(`http://${host}:81/image`, policy), safeFailure);
  await assert.rejects(resolve(`https://${host}/image`, policy), safeFailure);
  await assert.rejects(resolve(`http://other.fixture.invalid/image`, policy), safeFailure);
  assert.equal((await resolve(fixtureUrl, { trustedProxyOrigin: `https://${host}:443` })).addresses.length, 2);
  await assert.rejects(resolve(fixtureUrl), safeFailure);
  answers([{ address: "8.8.8.8", family: 6 }]);
  await assert.rejects(resolve(`http://${host}/image`, policy), safeFailure);
  await assert.rejects(resolve(fixtureUrl, { trustedProxyOrigin: "RAW_DNS_SENTINEL" }), safeFailure);
});

test("raw DNS failures are redacted and do not carry causes", async () => {
  lookupFixture = () => Promise.reject(new Error(`RAW_DNS_SENTINEL ${fixtureUrl}`));
  await assert.rejects(resolve(), safeFailure);
});

test("pre-aborted and same-turn aborted calls start no DNS", async () => {
  const controller = new AbortController();
  const reason = new Error("caller stopped");
  controller.abort(reason);
  await assert.rejects(resolve(fixtureUrl, {}, controller.signal), (error) => error === reason);
  await assert.rejects(resolve("https://8.8.8.8", {}, controller.signal), (error) => error === reason);
  const pendingController = new AbortController();
  const pending = resolve(fixtureUrl, {}, pendingController.signal);
  pendingController.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.deepEqual(calls, []);
  assert.equal(getEventListeners(pendingController.signal, "abort").length, 0);
});

for (const late of ["fulfill", "reject"] as const) {
  test(`held DNS abort settles before late ${late}, with listener cleanup`, async () => {
    let enter!: () => void;
    let release!: (value: LookupAddress[]) => void;
    let reject!: (error: Error) => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const held = new Promise<LookupAddress[]>((resolve, fail) => { release = resolve; reject = fail; });
    lookupFixture = () => { enter(); return held; };
    const controller = new AbortController();
    const reason = new Error("caller stopped during DNS");
    const pending = resolve(fixtureUrl, {}, controller.signal);
    try {
      await entered;
      controller.abort(reason);
      await assert.rejects(pending, (error) => error === reason);
      assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    } finally {
      controller.abort(reason);
      if (late === "fulfill") release([{ address: "8.8.8.8", family: 4 }]);
      else reject(new Error("late resolver failure"));
      await Promise.allSettled([pending, held]);
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, [host]); // node:test also fails on any unhandled rejection.
  });
}

test("abort at DNS fulfillment cannot return a pinned target", async () => {
  const controller = new AbortController();
  const reason = new Error("abort at resolution");
  lookupFixture = () => { controller.abort(reason); return [{ address: "8.8.8.8", family: 4 }]; };
  await assert.rejects(resolve(fixtureUrl, {}, controller.signal), (error) => error === reason);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("normal resolution removes listeners and snapshots the URL across DNS", async () => {
  const controller = new AbortController();
  const original = new URL(fixtureUrl);
  lookupFixture = () => { original.hostname = "127.0.0.1"; return [{ address: "8.8.8.8", family: 4 }]; };
  const target = await resolveTarget(original, {}, controller.signal);
  assert.equal(target.url.href, fixtureUrl);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
