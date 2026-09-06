// 260718: download retry — transient completion-moment failures must not drop
// a remote-succeeded asset.
import { test, before, beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import promiseDns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";
import { DownloadNetwork, PUBLIC_IMAGE, PUBLIC_NEXT, eventTurn, fakeClock, type Address } from "./_grokDownloadPolicyCases.ts";

const network = new DownloadNetwork();
let downloadMediaResult: typeof import("../lib/mcp/downloadMediaResult.ts").downloadMediaResult;
before(async () => {
  network.install();
  ({ downloadMediaResult } = await import("../lib/mcp/downloadMediaResult.ts"));
});
beforeEach((t) => { network.activate(); assert.ok("mock" in t); t.mock.method(Math, "random", () => 0); });
afterEach(async () => { await network.finish(); });
after(() => network.restore());

function fakeResponse(body = "mp4-bytes") {
  return { chunks: [Buffer.from(body)], headers: { "content-type": "video/mp4" } };
}

// Every DNS/socket boundary is intercepted by the existing Grok transport fixture.
const URL = "https://93.184.216.34/out.mp4?_jwt=x";
const FAST = { kind: "video" as const, attempts: 5, baseDelayMs: 1, v4Fallback: false };

test("retry: network failure then 403 then success commits on attempt 3", async () => {
  network.respond = ({ index }) => index === 0 ? { preheaderError: new TypeError("fetch failed") }
    : index === 1 ? { status: 403, holdBody: true } : fakeResponse();
  const result = await downloadMediaResult(URL, FAST);
  try {
    assert.equal(result.contentType, "video/mp4");
    assert.equal(result.bytes, 9);
    assert.equal(result.sanitizedUrl, "https://93.184.216.34/out.mp4");
    assert.equal(await readFile(result.tempPath, "utf8"), "mp4-bytes");
  } finally { await result.cleanup(); }
  assert.equal(network.exchanges.length, 3);
  assert.equal(network.exchanges[1].reads, 0);
});

test("retry: exhaustion surfaces the last error", async () => {
  network.respond = () => ({ preheaderError: new TypeError("fetch failed") });
  await assert.rejects(
    downloadMediaResult(URL, { kind: "video", attempts: 3, baseDelayMs: 1, v4Fallback: false }),
    /fetch failed/,
  );
  assert.equal(network.exchanges.length, 3);
});

test("no retry on permanent client error (400)", async () => {
  network.respond = () => ({ status: 400, holdBody: true });
  await assert.rejects(downloadMediaResult(URL, FAST), /MCP_DOWNLOAD_FAILED:400/);
  assert.equal(network.exchanges.length, 1);
  assert.equal(network.exchanges[0].reads, 0);
});

test("no retry on content-type mismatch", async () => {
  network.respond = () => ({ headers: { "content-type": "text/html" }, holdBody: true });
  await assert.rejects(downloadMediaResult(URL, FAST), /MCP_RESULT_TYPE_MISMATCH/);
  assert.equal(network.exchanges.length, 1);
  assert.equal(network.exchanges[0].reads, 0);
});

test("default is single attempt (back-compat)", async () => {
  network.respond = () => ({ preheaderError: new TypeError("fetch failed") });
  await assert.rejects(downloadMediaResult(URL, { kind: "video", v4Fallback: false }), /fetch failed/);
  assert.equal(network.exchanges.length, 1);
});

test("transient DNS failure keeps the existing retry policy", async () => {
  network.resolve = async () => {
    if (network.resolutions.length === 1) throw new Error("EAI_AGAIN");
    return [{ address: "8.8.8.8", family: 4 }];
  };
  network.respond = () => fakeResponse();
  const result = await downloadMediaResult(PUBLIC_IMAGE, { ...FAST, v4Fallback: true });
  try { assert.equal(result.bytes, 9); }
  finally { await result.cleanup(); }
  assert.equal(network.resolutions.length, 2);
  assert.equal(network.exchanges.length, 1);
});

for (const location of [undefined, "", PUBLIC_NEXT]) {
  test(`missing Location or redirect budget releases every rejected body: ${location}`, async () => {
    network.respond = () => ({ status: 302, headers: location === undefined ? {} : { location }, holdBody: true });
    await assert.rejects(downloadMediaResult(PUBLIC_IMAGE, FAST), location ? /MCP_DOWNLOAD_FAILED:302/ : /MCP_DOWNLOAD_REDIRECT_INVALID/);
    assert.equal(network.exchanges.length, location ? 6 : 1);
    assert.ok(network.exchanges.every(({ reads }) => reads === 0));
  });
}

for (const addresses of [[], [{ address: "100.127.255.255", family: 4 }],
  [{ address: "::ffff:6440:1", family: 6 }], [{ address: "::ffff:7f00:1", family: 6 }],
  [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }]] as Address[][]) {
  test(`reject all nonpublic DNS answers before request: ${JSON.stringify(addresses)}`, async () => {
    network.hosts["artifact.fixture.invalid"] = addresses;
    await assert.rejects(downloadMediaResult(PUBLIC_IMAGE, FAST), /MCP_DOWNLOAD_PRIVATE_IP/);
    assert.equal(network.resolutions.length, 1);
    assert.equal(network.exchanges.length, 0);
  });
}

test("redirects cancel before per-hop DNS and never connect to private or insecure targets", async () => {
  network.respond = ({ index }) => ({ status: 302, headers: { location: index === 0 ? PUBLIC_NEXT : "https://127.0.0.1/image" }, holdBody: true });
  await assert.rejects(downloadMediaResult(PUBLIC_IMAGE, FAST), /MCP_DOWNLOAD_PRIVATE_IP/);
  assert.deepEqual(network.resolutions, ["artifact.fixture.invalid", "cdn.fixture.invalid"]);
  assert.equal(network.exchanges.length, 2);
  assert.ok(network.exchanges.every(({ reads }) => reads === 0));
  assert.ok(network.order.indexOf("destroy:0") < network.order.indexOf("get:1"));
  await assert.rejects(downloadMediaResult("http://private.fixture.invalid/image", FAST), /MCP_DOWNLOAD_INSECURE/);
  assert.equal(network.exchanges.length, 2);
});

for (const v4Fallback of [true, false]) {
  test(`IPv4 preference and fallback=${v4Fallback} reuse validated DNS`, async (t) => {
    network.hosts["artifact.fixture.invalid"] = [
      { address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 },
    ];
    const dns = t.mock.method(promiseDns, "lookup");
    syncBuiltinESMExports();
    try {
    network.respond = ({ index }) => index === 0 ? { preheaderError: new Error("ECONNRESET") } : fakeResponse();
    const pending = downloadMediaResult(PUBLIC_IMAGE, { kind: "video", v4Fallback });
    if (v4Fallback) { const result = await pending; await result.cleanup(); }
    else await assert.rejects(pending, /ECONNRESET/);
    assert.equal(network.resolutions.length, 1);
    assert.equal(network.exchanges.length, v4Fallback ? 2 : 1);
    const dnsArguments: readonly unknown[] = dns.mock.calls[0].arguments;
    assert.deepEqual(dnsArguments[1], { all: true, order: "ipv4first" });
    assert.equal(network.exchanges[0].options.family, undefined, "retain Node's dual-stack connection selection");
    if (v4Fallback) assert.equal(network.exchanges[1].options.family, 4);
    } finally { dns.mock.restore(); syncBuiltinESMExports(); }
  });
}

test("body timeout remains active after headers and destroys both handles", async (t) => {
  const advance = fakeClock(t);
  network.respond = () => ({ ...fakeResponse(), holdBody: true });
  const pending = downloadMediaResult(URL, { kind: "video", timeoutMs: 100, v4Fallback: false });
  const refused = assert.rejects(pending, /MCP_DOWNLOAD_TIMEOUT/);
  await eventTurn();
  assert.equal(network.exchanges.length, 1);
  await advance(100);
  await refused;
  assert.equal(advance.pending.size, 0);
});

for (const declared of [undefined, "1", "5"]) {
  test(`stream cap with declared=${declared} cancels and cleans owned temp directory`, async (t) => {
    const fs = await import("node:fs/promises");
    const removed: string[] = [];
    const original = fs.default.rm;
    t.mock.method(fs.default, "rm", async (path, options) => { removed.push(String(path)); return original(path, options); });
    const { syncBuiltinESMExports } = await import("node:module");
    syncBuiltinESMExports();
    try {
      network.respond = () => ({ chunks: [Buffer.from("abc"), Buffer.from("de")],
        headers: { "content-type": "video/mp4", ...(declared ? { "content-length": declared } : {}) } });
      await assert.rejects(downloadMediaResult(URL, { ...FAST, maxBytes: 4 }), /MCP_DOWNLOAD_TOO_LARGE/);
      assert.equal(network.exchanges.length, 1);
      if (declared === "5") assert.equal(network.exchanges[0].reads, 0);
      else { assert.equal(removed.length, 1); await assert.rejects(fs.stat(removed[0]), { code: "ENOENT" }); }
    } finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  });
}
