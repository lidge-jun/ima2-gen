import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import dns from "node:dns";
import promiseDns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { executionTestProcess } from "./_executionTestProcess.ts";
import {
  DownloadNetwork, PUBLIC_IMAGE, PUBLIC_NEXT, LOCAL_ORIGIN, IMAGE_BYTES,
  deferred, downloadError, eventTurn, fakeClock, observeProcessErrors,
  assertNoCallerListeners, observeAbortSignals, isolateDownloadConfig, type Download, type Address,
} from "./_grokDownloadPolicyCases.ts";
import { registerDownloadRetryCases, readBodySourceUnit } from "./_grokDownloadRetryCases.ts";

async function standaloneNetworkProbe(probe: (fixture: DownloadNetwork) => Promise<void>) {
  const targets: Array<[object, string]> = [[promiseDns, "lookup"], [dns, "lookup"],
    [http, "request"], [http, "get"], [https, "request"], [https, "get"], [globalThis, "fetch"]];
  const descriptors = targets.map(([target, name]) => Object.getOwnPropertyDescriptor(target, name));
  const fixture = new DownloadNetwork();
  try { fixture.install(); await probe(fixture); }
  finally {
    fixture.restore();
    targets.forEach(([target, name], index) => {
      assert.deepEqual(Object.getOwnPropertyDescriptor(target, name), descriptors[index], `restore exact ${name} descriptor`);
    });
  }
}

function registerNetworkSafetyCases() {
  for (const phase of ["pre-import", "between-cases"]) for (const transport of ["DNS", "HTTP", "HTTPS"]) {
    test(`M1 fixture ${phase} caught inactive ${transport} must prevent activation`, async () => {
      await standaloneNetworkProbe(async (fixture) => {
        if (phase === "between-cases") { fixture.activate(); await fixture.finish(); }
        assert.equal(fixture.active, false);
        if (transport === "DNS") {
          await assert.rejects(promiseDns.lookup("artifact.fixture.invalid", { all: true }), /Unowned network attempt: DNS/);
        } else {
          const request = transport === "HTTP" ? http.request : https.request;
          assert.throws(() => request(PUBLIC_IMAGE, { agent: false }), /Unowned network attempt: inactive HTTP/);
        }
        const ledger = fixture.violations; const recorded = [...ledger];
        assert.ok(recorded.length > 0);
        for (let attempt = 0; attempt < 2; attempt++) {
          assert.throws(() => fixture.activate(), /Prior network violations prevent fixture activation/);
          assert.equal(fixture.active, false); assert.equal(fixture.violations, ledger);
          assert.deepEqual(fixture.violations, recorded, "caught denials must never disappear");
        }
        await assert.rejects(fixture.finish(), /no swallowed fixture\/network failures/);
        assert.deepEqual(fixture.violations, recorded);
      });
    });
  }
  for (const hostname of ["inherited.fixture.invalid", "toString"]) {
    test(`M1 fixture refuses inherited hostname key ${hostname} without native DNS`, async () => {
      await standaloneNetworkProbe(async (fixture) => {
        fixture.activate();
        Object.setPrototypeOf(fixture.hosts, { "inherited.fixture.invalid": [{ address: "8.8.8.8", family: 4 }] });
        await assert.rejects(promiseDns.lookup(hostname, { all: true }), /Unowned network attempt: DNS/);
        assert.deepEqual(fixture.resolutions, []); assert.deepEqual(fixture.exchanges, []);
        assert.equal(fixture.violations.length, 1);
        assert.throws(() => fixture.activate(), /Prior network violations prevent fixture activation/);
        await assert.rejects(fixture.finish(), /no swallowed fixture\/network failures/);
        assert.equal(fixture.violations.length, 1);
      });
    });
  }
}

if (executionTestProcess(import.meta.url)) {
  registerNetworkSafetyCases();
  describe("download wrapper integration", () => {
    const network = new DownloadNetwork();
    let download: Download;
    let restoreConfig: (() => Promise<void>) | undefined;
    before(async () => {
      try {
        network.install(); // After standalone safety probes; before ANY production download import.
        restoreConfig = await isolateDownloadConfig();
        download = (await import("../lib/grokImageDownload.js")).downloadGrokImageUrl;
      } catch (error) { network.restore(); await restoreConfig?.(); throw error; }
    });
    beforeEach(() => network.activate());
    afterEach(async () => { try { await network.finish(); } catch (error) { throw error; } });
    after(async () => { network.restore(); await restoreConfig?.(); });
    registerDownloadRetryCases(() => ({ network, download }));

    for (let redirects = 0; redirects <= 5; redirects++) {
      test(`public wrapper accepts ${redirects} vetted HTTPS redirects`, async () => {
        network.respond = ({ index }) => index < redirects
          ? { status: [301, 302, 303, 307, 308][index % 5], headers: { location: `${PUBLIC_NEXT}?hop=${index}` }, holdBody: true }
          : {};
        const result = await download(PUBLIC_IMAGE);
        assert.deepEqual(result.buffer, IMAGE_BYTES);
        assert.equal(result.b64, IMAGE_BYTES.toString("base64"));
        assert.equal(result.mime, "image/png");
        assert.equal(network.resolutions.length, redirects + 1);
        assert.equal(network.exchanges.length, redirects + 1);
        for (let index = 0; index < redirects; index++) {
          assert.equal(network.exchanges[index].reads, 0, "redirect body not consumed");
          assert.ok(network.order.indexOf(`destroy:${index}`) < network.order.indexOf(`get:${index + 1}`));
        }
      });
    }

    for (const location of [undefined, "", "  ", `${PUBLIC_NEXT}?loop=1`]) {
      test(`rejects missing/empty Location or sixth redirect: ${String(location)}`, async () => {
        network.respond = () => ({ status: 302, headers: location === undefined ? {} : { location }, holdBody: true });
        await assert.rejects(download(PUBLIC_IMAGE), downloadError());
        assert.equal(network.exchanges.length, location?.trim() ? 6 : 1);
      });
    }

    const rejectedAddresses: Address[][] = [
      [{ address: "127.0.0.1", family: 4 }], [{ address: "10.0.0.1", family: 4 }],
      [{ address: "192.168.1.1", family: 4 }], [{ address: "169.254.169.254", family: 4 }],
      [{ address: "::1", family: 6 }], [{ address: "fc00::1", family: 6 }],
      [{ address: "::ffff:127.0.0.1", family: 6 }], [{ address: "::ffff:7f00:1", family: 6 }],
      [{ address: "2001:db8::1", family: 6 }], [{ address: "192.0.2.1", family: 4 }],
      [{ address: "8.8.8.8", family: 4 }, { address: "127.0.0.1", family: 4 }], [],
    ];
    for (const addresses of rejectedAddresses) {
      test(`HTTPS public wrapper rejects DNS answers before GET: ${JSON.stringify(addresses)}`, async () => {
        network.hosts["artifact.fixture.invalid"] = addresses;
        await assert.rejects(download(PUBLIC_IMAGE), downloadError());
        assert.equal(network.resolutions.length, 1, "permanent refusal is not retried");
        assert.equal(network.exchanges.length, 0);
      });
    }

    for (const url of ["https://127.1/image", "https://0x7f000001/image", "https://2130706433/image",
      "https://[::ffff:7f00:1]/image", "http://artifact.fixture.invalid/image", "file:///image",
      "https://user-sentinel:password-sentinel@artifact.fixture.invalid/image"]) {
      test(`refuses unsafe scheme/numeric/userinfo input ${url}`, async () => {
        await assert.rejects(download(url), downloadError());
        assert.equal(network.resolutions.length, 0);
        assert.equal(network.exchanges.length, 0);
      });
    }

    test("trusted exact named origin permits relative same-origin redirect, not another port", async () => {
      const policy = Object.freeze({ trustedProxyOrigin: LOCAL_ORIGIN });
      network.respond = ({ index }) => index === 0 ? { status: 302, headers: { location: "/final" }, holdBody: true } : {};
      assert.deepEqual((await download(`${LOCAL_ORIGIN}/image`, undefined, undefined, policy)).buffer, IMAGE_BYTES);
      assert.equal(network.exchanges.length, 2);
      await assert.rejects(download("http://private.fixture.invalid:43211/image", undefined, undefined, policy), downloadError());
      assert.equal(network.exchanges.length, 2);
      assert.deepEqual(policy, { trustedProxyOrigin: LOCAL_ORIGIN });
    });

    for (const chain of [
      [PUBLIC_IMAGE, `${LOCAL_ORIGIN}/image`],
      [`${LOCAL_ORIGIN}/image`, PUBLIC_NEXT, `${LOCAL_ORIGIN}/again`],
      [`${LOCAL_ORIGIN}/image`, "https://private.fixture.invalid:43211/image"],
      [PUBLIC_IMAGE, "https://private.fixture.invalid/image"],
    ]) {
      test(`trust is monotone across ${chain.join(" -> ")}`, async () => {
        const policy = Object.freeze({ trustedProxyOrigin: LOCAL_ORIGIN });
        network.respond = ({ index }) => ({ status: 302, headers: { location: chain[index + 1] }, holdBody: true });
        await assert.rejects(download(chain[0], undefined, undefined, policy), downloadError());
        assert.equal(network.exchanges.length, chain.length - 1);
        assert.ok(network.exchanges.every(({ reads }) => reads === 0));
        assert.deepEqual(policy, { trustedProxyOrigin: LOCAL_ORIGIN });
      });
    }

    test("untrusted localhost has no implicit proxy exception", async () => {
      await assert.rejects(download(`${LOCAL_ORIGIN}/image`), downloadError());
      assert.equal(network.exchanges.length, 0);
    });

    test("Host/SNI preserve DNS name; IP literals omit SNI; pinned family/all never fall back", async () => {
      network.hosts["artifact.fixture.invalid"] = [
        { address: "8.8.8.8", family: 4 }, { address: "2606:4700:4700::1111", family: 6 },
      ];
      await download(PUBLIC_IMAGE);
      await download("https://8.8.8.8/image");
      await download("https://[2606:4700:4700::1111]/image");
      const [named, v4, v6] = network.exchanges;
      assert.equal(new Headers(named.options.headers as Record<string, string>).get("host"), "artifact.fixture.invalid");
      assert.equal(named.options.servername, "artifact.fixture.invalid");
      assert.equal(v4.options.servername, undefined);
      assert.equal(v6.options.servername, undefined);
      assert.equal(network.resolutions.length, 1);
    });

    for (const timeout of [false, true]) for (const lateReject of [false, true]) {
      test(`held DNS settles public promise before release: timeout=${timeout}, lateReject=${lateReject}`, async (t) => {
        observeProcessErrors(t);
        const signals = observeAbortSignals(t);
        const advance = fakeClock(t);
        const controller = new AbortController();
        const entered = deferred();
        const resolver = deferred<Address[]>();
        network.resolve = () => { entered.resolve(); return resolver.promise; };
        const pending = download(PUBLIC_IMAGE, controller.signal, 1_000);
        const refused = assert.rejects(pending, downloadError(timeout ? 504 : 499,
          timeout ? "GROK_IMAGE_TIMEOUT" : "GENERATION_CANCELED"));
        try {
          await entered.promise;
          if (timeout) await advance(1_000); else controller.abort({ arbitrary: "caller reason" });
          await refused; // Actual wrapper settles while resolver remains pending.
          assert.equal(network.exchanges.length, 0);
          assert.equal(advance.pending.size, 0);
          assertNoCallerListeners(controller.signal);
          for (const signal of signals) assertNoCallerListeners(signal);
        } finally {
          if (lateReject) resolver.reject(new Error("late resolver rejection"));
          else resolver.resolve([{ address: "8.8.8.8", family: 4 }]);
          controller.abort(); await Promise.allSettled([pending]); await eventTurn();
        }
        assert.equal(network.exchanges.length, 0);
      });
    }

    test("pre-aborted caller starts neither DNS nor GET and clears wrapper timer", async (t) => {
      const advance = fakeClock(t);
      const controller = new AbortController(); controller.abort("arbitrary reason");
      await assert.rejects(download(PUBLIC_IMAGE, controller.signal), downloadError(499, "GENERATION_CANCELED"));
      assert.deepEqual(network.resolutions, []); assert.deepEqual(network.exchanges, []);
      assert.equal(advance.pending.size, 0); assertNoCallerListeners(controller.signal);
    });

    test("a redirect consumes the original deadline before the next held DNS", async (t) => {
      const advance = fakeClock(t);
      const firstHeaders = deferred(); const nextDns = deferred(); const resolver = deferred<Address[]>();
      const controller = new AbortController();
      network.respond = () => ({ status: 302, headers: { location: PUBLIC_NEXT }, headerGate: firstHeaders.promise });
      network.resolve = async (hostname) => {
        if (hostname === "cdn.fixture.invalid") { nextDns.resolve(); return resolver.promise; }
        return network.hosts[hostname];
      };
      const pending = download(PUBLIC_IMAGE, controller.signal, 1_000);
      const refused = assert.rejects(pending, downloadError(504, "GROK_IMAGE_TIMEOUT"));
      try {
        await eventTurn(); assert.equal(network.exchanges.length, 1);
        await advance(600); firstHeaders.resolve(); await nextDns.promise;
        await advance(399); assert.equal(advance.pending.size, 1);
        await advance(1); await refused;
        assert.equal(network.exchanges.length, 1); assert.equal(advance.pending.size, 0);
      } finally {
        firstHeaders.resolve(); resolver.resolve([{ address: "1.1.1.1", family: 4 }]);
        controller.abort(); await Promise.allSettled([pending]); await eventTurn();
      }
      assert.equal(network.exchanges.length, 1);
    });

    for (const at of ["headers", "body", "late-headers"] as const) for (const timeout of [false, true]) {
      test(`${timeout ? "deadline" : "abort"} during ${at} closes Node request/body`, async (t) => {
        observeProcessErrors(t);
        const advance = fakeClock(t); const controller = new AbortController(); const headers = deferred();
        network.respond = () => ({ chunks: at === "body" ? [IMAGE_BYTES] : [], holdBody: true,
          ...(at === "late-headers" ? { headerGate: headers.promise } : {}) });
        const pending = download(PUBLIC_IMAGE, controller.signal, 1_000);
        const refused = assert.rejects(pending, downloadError(timeout ? 504 : 499,
          timeout ? "GROK_IMAGE_TIMEOUT" : "GENERATION_CANCELED"));
        try {
          await eventTurn(); assert.equal(network.exchanges.length, 1);
          if (at !== "late-headers") await network.exchanges[0].ready.promise;
          if (timeout) await advance(1_000); else controller.abort(new Error("caller sentinel"));
          await refused;
          headers.resolve(); await eventTurn();
          assert.equal(network.exchanges[0].request.destroyed, true);
          assert.equal(network.exchanges[0].response?.destroyed, true);
          assertNoCallerListeners(controller.signal); assert.equal(advance.pending.size, 0);
        } finally { headers.resolve(); controller.abort(); await Promise.allSettled([pending]); }
      });
    }

    for (const headers of [{}, { "content-length": "0" }, { "content-length": "999" }]) {
      test(`rejects empty streamed body: ${JSON.stringify(headers)}`, async () => {
        network.respond = () => ({ headers, chunks: [] });
        await assert.rejects(download(PUBLIC_IMAGE), downloadError());
        assert.equal(network.exchanges.length, 1);
      });
    }

    test("declared size over 50 MiB fails without reading or Buffer.concat", async (t) => {
      const concat = t.mock.method(Buffer, "concat");
      network.respond = () => ({ headers: { "content-length": String(50 * 1024 * 1024 + 1) }, holdBody: true });
      await assert.rejects(download(PUBLIC_IMAGE), (error) => { downloadError()(error); assert.match(String(error), /50MB limit/); return true; });
      assert.equal(network.exchanges[0].reads, 0); assert.equal(concat.mock.callCount(), 0);
    });

    test("small private body-source unit covers exact/overflow/lying/null/empty without public-wrapper claims", async (t) => {
      const readBody = readBodySourceUnit();
      for (const size of [4, 5]) for (const declared of [null, "1", "4"]) {
        let canceled = 0; const controller = new AbortController();
        const response = { status: 200, headers: { get: () => declared },
          body: (async function* () { yield Buffer.alloc(2); yield Buffer.alloc(size - 2); })(), cancel() { canceled++; } };
        const concat = t.mock.method(Buffer, "concat");
        try {
          if (size === 4) assert.equal((await readBody(response, { maxBytes: 4, signal: controller.signal })).length, 4);
          else {
            await assert.rejects(readBody(response, { maxBytes: 4, signal: controller.signal }), { reason: "too-large" });
            assert.ok(canceled > 0); assert.equal(concat.mock.callCount(), 0);
          }
          assertNoCallerListeners(controller.signal);
        } finally { concat.mock.restore(); }
      }
      for (const body of [null, (async function* () {})()]) {
        await assert.rejects(readBody({ status: 200, headers: { get: () => null }, body, cancel() {} },
          { maxBytes: 4, signal: new AbortController().signal }), { reason: "empty" });
      }
    });

    // Canonical hosted CI executes these without skip/env gates. Local focused runs must
    // select the small cases explicitly; no 50 MiB allocation belongs in a worker smoke.
    for (const overflow of [false, true]) for (const lyingHeader of [false, true]) {
      test(`[hosted CI] public wrapper streamed 50 MiB${overflow ? "+1" : " exact"}, lyingHeader=${lyingHeader}`, async (t) => {
        const chunk = Buffer.alloc(1024 * 1024, 0x41);
        const chunks = Array.from({ length: 50 }, () => chunk);
        if (overflow) chunks.push(Buffer.from([0x42]));
        network.respond = () => ({ chunks, headers: lyingHeader ? { "content-length": "1" } : {} });
        const concat = t.mock.method(Buffer, "concat");
        if (overflow) {
          await assert.rejects(download(PUBLIC_IMAGE), (error) => {
            downloadError()(error); assert.match(String(error), /50MB limit/); return true;
          });
          assert.equal(concat.mock.callCount(), 0, "overflow rejected before Buffer.concat");
        } else {
          const result = await download(PUBLIC_IMAGE);
          assert.equal(result.buffer.length, 50 * 1024 * 1024);
          assert.equal(result.buffer[0], 0x41); assert.equal(result.buffer.at(-1), 0x41);
        }
        assert.equal(network.exchanges.length, 1); assert.equal(network.exchanges[0].response?.destroyed, true);
      });
    }

    test("safe errors and retry logs redact userinfo, signed queries and raw Node secrets", async (t) => {
      const output: string[] = [];
      for (const name of ["warn", "error", "info", "log"] as const) t.mock.method(console, name, (...args) => output.push(args.join(" ")));
      const secret = "signed-query-credential-sentinel";
      const url = `${PUBLIC_IMAGE}?token=${secret}`;
      network.respond = ({ index }) => index === 0 ? { status: 503, headers: { "retry-after": "0" }, holdBody: true }
        : { preheaderError: new Error(`nonretryable transport ${url} ${secret}`) };
      await assert.rejects(download(url), (error) => {
        downloadError()(error); output.push(String(error), JSON.stringify(error)); return true;
      });
      await assert.rejects(download(`https://${secret}:password@artifact.fixture.invalid/image`), (error) => {
        downloadError()(error); output.push(String(error), JSON.stringify(error)); return true;
      });
      assert.doesNotMatch(output.join("\n"), /signed-query-credential-sentinel|password|token=/);
      assert.equal(network.exchanges.length, 2);
    });
  });
}
