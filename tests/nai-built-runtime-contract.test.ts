import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

import { config } from "../config.js";
import { generateViaNai } from "../lib/naiImageAdapter.js";
import { readNaiOptions } from "../lib/naiOptions.js";
import { createTestRuntimeContext } from "../lib/runtimeContext.js";

const originalFetch = globalThis.fetch;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function zipOf(payload: Buffer): Buffer {
  const body = deflateRawSync(payload);
  const name = Buffer.from("image_0.png");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(payload.length, 22);
  header.writeUInt16LE(name.length, 26);
  return Buffer.concat([header, name, body]);
}

function recorder(): Array<{ url: string; init: RequestInit }> {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const payload = zipOf(png);
    return {
      status: 200,
      headers: new Headers({ "content-type": "application/x-zip-compressed" }),
      arrayBuffer: async () => payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength),
      text: async () => "",
    };
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("generated config and normalizer expose Auto SMEA and Decrisper", () => {
  assert.equal(config.naiProvider.defaultAutoSmea, false);
  assert.equal(config.naiProvider.defaultDecrisper, false);
  assert.deepEqual(readNaiOptions({ autoSmea: true, decrisper: false }), {
    autoSmea: true,
    decrisper: false,
  });
});

test("generated adapter preserves explicit false over true operator defaults", async () => {
  const calls = recorder();
  const ctx = createTestRuntimeContext({
    naiApiKey: "nai-test-token",
    config: {
      naiProvider: {
        ...config.naiProvider,
        defaultAutoSmea: true,
        defaultDecrisper: true,
      },
    } as never,
  });
  await generateViaNai("cat", ctx, { autoSmea: false, decrisper: false });
  const parameters = JSON.parse(String(calls[0]!.init.body)).parameters;
  assert.equal(parameters.autoSmea, false);
  assert.equal(parameters.dynamic_thresholding, false);
});
