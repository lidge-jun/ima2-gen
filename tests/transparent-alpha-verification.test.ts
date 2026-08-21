// Byte-level alpha verification, tested against REAL encoded images produced by
// sharp rather than hand-written fixtures — a transparency check that trusts a
// synthetic header would be exactly the kind of false confidence the adversarial
// review flagged (260821 round 3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { verifyBufferAlpha, isJpegBuffer, makeTransparentResultError } from "../lib/imageBackgroundParam.ts";
import { decodeRawForAlpha } from "../lib/alphaDecode.ts";

const check = (buf: Buffer) => verifyBufferAlpha(buf, decodeRawForAlpha);

const solid = { width: 8, height: 8, channels: 3 as const, background: { r: 200, g: 30, b: 30 } };
const withAlpha = { width: 8, height: 8, channels: 4 as const, background: { r: 200, g: 30, b: 30, alpha: 0 } };

describe("bufferCarriesAlpha against real encoded bytes", () => {
  it("accepts an RGBA PNG", async () => {
    const buf = await sharp({ create: withAlpha }).png().toBuffer();
    assert.deepEqual(await check(buf), { hasAlpha: true });
  });

  it("rejects an opaque PNG — requesting alpha does not guarantee alpha", async () => {
    const buf = await sharp({ create: solid }).png({ colours: 256 }).toBuffer();
    const verdict = await check(buf);
    assert.equal(verdict.hasAlpha, false);
  });

  it("rejects JPEG, which cannot carry an alpha channel at all", async () => {
    const buf = await sharp({ create: solid }).jpeg().toBuffer();
    assert.deepEqual(await check(buf), { hasAlpha: false, reason: "jpeg" });
    assert.equal(isJpegBuffer(buf), true);
  });

  it("accepts a WebP carrying alpha", async () => {
    const buf = await sharp({ create: withAlpha }).webp().toBuffer();
    assert.equal((await check(buf)).hasAlpha, true);
  });

  it("reports undetectable for non-image bytes instead of guessing", async () => {
    const verdict = await check(Buffer.from("not an image at all", "utf8"));
    assert.deepEqual(verdict, { hasAlpha: false, reason: "undetectable" });
  });
});

// The exact false positive a header-only check shipped: an RGBA container whose
// every alpha byte is 255. Container capability is not transparency.
describe("fully-opaque RGBA is rejected rather than accepted on capability", () => {
  it("rejects an RGBA PNG with no actually-transparent pixel", async () => {
    const buf = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } }).png().toBuffer();
    // sharp agrees the CONTAINER has alpha — that is precisely the trap.
    assert.equal((await sharp(buf).metadata()).hasAlpha, true);
    assert.deepEqual(await check(buf), { hasAlpha: false, reason: "fully-opaque" });
  });

  it("accepts partial transparency (glass, hair, anti-aliased edges)", async () => {
    const base = await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
    const semi = await sharp(base).composite([{
      input: await sharp({ create: { width: 16, height: 16, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.35 } } }).png().toBuffer(),
      blend: "dest-in",
    }]).png().toBuffer();
    assert.equal((await check(semi)).hasAlpha, true);
  });

  it("treats a decode failure as unverified rather than transparent", async () => {
    const verdict = await verifyBufferAlpha(Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]), async () => { throw new Error("decode boom"); });
    assert.deepEqual(verdict, { hasAlpha: false, reason: "undetectable" });
  });
});

// The verifier decides whether a paid generation is kept or thrown away, so a
// false positive (claiming alpha that is not there) is the dangerous direction.
// Every case below is cross-checked against sharp's own metadata rather than an
// expectation the test author asserted from memory.
describe("verdict agrees with sharp across PNG/WebP encodings", () => {
  const alpha = { width: 16, height: 16, channels: 4 as const, background: { r: 10, g: 200, b: 90, alpha: 0 } };
  const solid = { width: 16, height: 16, channels: 3 as const, background: { r: 10, g: 200, b: 90 } };

  const cases: Array<[string, () => Promise<Buffer>]> = [
    ["interlaced RGBA png", () => sharp({ create: alpha }).png({ progressive: true }).toBuffer()],
    ["16-bit RGBA png", () => sharp({ create: alpha }).png().toColourspace("rgb16").toBuffer()],
    ["palette png with alpha", () => sharp({ create: alpha }).png({ palette: true }).toBuffer()],
    ["palette png opaque", () => sharp({ create: solid }).png({ palette: true }).toBuffer()],
    ["grayscale+alpha png", () => sharp({ create: alpha }).greyscale().png().toBuffer()],
    ["lossless webp with alpha", () => sharp({ create: alpha }).webp({ lossless: true }).toBuffer()],
    ["lossy webp opaque", () => sharp({ create: solid }).webp().toBuffer()],
    ["opaque rgb png", () => sharp({ create: solid }).png().toBuffer()],
  ];

  for (const [name, make] of cases) {
    it(`matches sharp for ${name}`, async () => {
      const buf = await make();
      const meta = await sharp(buf).metadata();
      const verdict = await check(buf);
      if (!meta.hasAlpha) {
        assert.equal(verdict.hasAlpha, false, `opaque container accepted for ${name}`);
        return;
      }
      // Container has alpha: the verdict must reflect REAL pixel transparency,
      // computed here independently rather than trusting the implementation.
      const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let anyTransparent = false;
      for (let i = info.channels - 1; i < data.length; i += info.channels) {
        if (data[i]! < 255) { anyTransparent = true; break; }
      }
      assert.equal(verdict.hasAlpha, anyTransparent, `verdict disagrees with real pixel alpha for ${name}`);
    });
  }
});

describe("opaque-result error", () => {
  it("is operational, non-retryable-by-default, and names the cause", () => {
    const err = makeTransparentResultError("atlascloud", "jpeg");
    assert.equal(err.code, "TRANSPARENT_RESULT_OPAQUE");
    assert.equal(err.status, 502);
    assert.equal(err.isOperational, true);
    assert.match(err.message, /cannot carry an alpha channel/);
    assert.match(err.message, /Nothing was saved/);
  });

  it("distinguishes an opaque non-JPEG result", () => {
    assert.match(makeTransparentResultError("oauth", "no-alpha-channel").message, /no alpha channel/);
  });

  it("names the fully-opaque case distinctly", () => {
    assert.match(makeTransparentResultError("atlascloud", "fully-opaque").message, /every pixel is fully opaque/);
  });
});
