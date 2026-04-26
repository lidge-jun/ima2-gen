import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { compressReferenceB64ForOAuth } from "../lib/referenceImageCompress.js";

test("compressReferenceB64ForOAuth re-encodes oversized generated PNG references", async () => {
  const width = 1024;
  const height = 1024;
  const noisyRgb = randomBytes(width * height * 3);
  const png = await sharp(noisyRgb, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
  const inputB64 = png.toString("base64");

  const result = await compressReferenceB64ForOAuth(inputB64, {
    maxB64Bytes: 120_000,
    maxEdge: 1024,
    fallbackMaxEdge: 512,
    qualityLadder: [70, 55],
    fallbackQualityLadder: [55, 45],
  });

  assert.equal(result.compressed, true);
  assert.equal(result.inputBytes, inputB64.length);
  assert.ok(result.outputBytes <= 120_000, `${result.outputBytes} should fit budget`);

  const out = Buffer.from(result.b64, "base64");
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, "jpeg");
  assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= 1024);
});

test("compressReferenceB64ForOAuth can force JPEG normalization for small inputs", async () => {
  const png = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: "#336699",
    },
  }).png().toBuffer();

  const result = await compressReferenceB64ForOAuth(png.toString("base64"), {
    maxB64Bytes: 1_000_000,
    force: true,
  });

  assert.equal(result.compressed, true);
  const meta = await sharp(Buffer.from(result.b64, "base64")).metadata();
  assert.equal(meta.format, "jpeg");
});
