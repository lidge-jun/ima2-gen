// Byte-level alpha verification, tested against REAL encoded images produced by
// sharp rather than hand-written fixtures — a transparency check that trusts a
// synthetic header would be exactly the kind of false confidence the adversarial
// review flagged (260821 round 3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { bufferCarriesAlpha, makeTransparentResultError } from "../lib/imageBackgroundParam.ts";

const solid = { width: 8, height: 8, channels: 3 as const, background: { r: 200, g: 30, b: 30 } };
const withAlpha = { width: 8, height: 8, channels: 4 as const, background: { r: 200, g: 30, b: 30, alpha: 0 } };

describe("bufferCarriesAlpha against real encoded bytes", () => {
  it("accepts an RGBA PNG", async () => {
    const buf = await sharp({ create: withAlpha }).png().toBuffer();
    assert.deepEqual(bufferCarriesAlpha(buf), { hasAlpha: true });
  });

  it("rejects an opaque PNG — requesting alpha does not guarantee alpha", async () => {
    const buf = await sharp({ create: solid }).png({ colours: 256 }).toBuffer();
    const verdict = bufferCarriesAlpha(buf);
    assert.equal(verdict.hasAlpha, false);
  });

  it("rejects JPEG, which cannot carry an alpha channel at all", async () => {
    const buf = await sharp({ create: solid }).jpeg().toBuffer();
    assert.deepEqual(bufferCarriesAlpha(buf), { hasAlpha: false, reason: "jpeg" });
  });

  it("accepts a WebP carrying alpha", async () => {
    const buf = await sharp({ create: withAlpha }).webp().toBuffer();
    assert.equal(bufferCarriesAlpha(buf).hasAlpha, true);
  });

  it("reports undetectable for non-image bytes instead of guessing", async () => {
    const verdict = bufferCarriesAlpha(Buffer.from("not an image at all", "utf8"));
    assert.deepEqual(verdict, { hasAlpha: false, reason: "undetectable" });
  });
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
});
