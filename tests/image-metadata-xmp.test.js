import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  embedImageMetadata,
  readEmbeddedImageMetadata,
} from "../lib/imageMetadataStore.ts";

const baseMeta = {
  kind: "classic",
  prompt: "fallback prompt",
  userPrompt: "고양이와 네온 사인",
  revisedPrompt: "A cat beside a neon sign",
  promptMode: "direct",
  quality: "high",
  size: "1536x1024",
  format: "png",
  moderation: "low",
  model: "gpt-5.4",
  provider: "oauth",
  sessionId: "sess_meta",
  requestId: "req_meta",
  refsCount: 2,
  webSearchCalls: 1,
};

async function makeImage(format) {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 24, g: 80, b: 140, alpha: 1 },
    },
  }).toFormat(format).toBuffer();
}

describe("image metadata XMP", () => {
  for (const format of ["png", "jpeg", "webp"]) {
    it(`round-trips ima2 metadata in ${format.toUpperCase()}`, async () => {
      const source = await makeImage(format);
      const embedded = await embedImageMetadata(source, format, {
        ...baseMeta,
        format,
      }, { version: "test-version" });
      assert.equal(embedded.embedded, true);

      const read = await readEmbeddedImageMetadata(embedded.buffer);
      assert.equal(read.source, "xmp");
      assert.equal(read.metadata.schema, "ima2.generation.v1");
      assert.equal(read.metadata.app, "ima2-gen");
      assert.equal(read.metadata.userPrompt, "고양이와 네온 사인");
      assert.equal(read.metadata.promptMode, "direct");
      assert.equal(read.metadata.quality, "high");
      assert.equal(read.metadata.format, format);
      assert.equal(read.metadata.version, "test-version");
    });
  }

  it("reports missing metadata without throwing", async () => {
    const source = await makeImage("png");
    const read = await readEmbeddedImageMetadata(source);
    assert.equal(read.metadata, null);
    assert.equal(read.source, null);
    assert.match(read.warnings.join("\n"), /No ima2 metadata/);
  });

  it("rejects unsupported embed formats with a stable code", async () => {
    await assert.rejects(
      () => embedImageMetadata(Buffer.from("not an image"), "gif", baseMeta),
      (error) => error.code === "IMAGE_METADATA_UNSUPPORTED_FORMAT",
    );
  });
});
