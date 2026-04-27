import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import sharp from "sharp";
import { registerMetadataRoutes } from "../routes/metadata.js";
import { embedImageMetadata } from "../lib/imageMetadataStore.js";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function makeCtx(overrides = {}) {
  return {
    config: {
      limits: {
        maxMetadataReadB64Bytes: 1024 * 1024,
        ...overrides,
      },
    },
  };
}

async function makePng() {
  return sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 200, g: 80, b: 20 },
    },
  }).png().toBuffer();
}

async function withApp(ctx, fn) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  registerMetadataRoutes(app, ctx);
  const server = createServer(app);
  const baseUrl = await listen(server);
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("/api/metadata/read returns embedded XMP metadata", async () => {
  await withApp(makeCtx(), async (baseUrl) => {
    const embedded = await embedImageMetadata(await makePng(), "png", {
      schema: "ima2.generation.v1",
      app: "ima2-gen",
      userPrompt: "메타데이터 복원 테스트",
      size: "1024x1024",
      format: "png",
      quality: "medium",
      model: "gpt-5.4",
    });
    const dataUrl = `data:image/png;base64,${embedded.buffer.toString("base64")}`;
    const res = await fetch(`${baseUrl}/api/metadata/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "test.png", dataUrl }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.source, "xmp");
    assert.equal(body.metadata.userPrompt, "메타데이터 복원 테스트");
    assert.equal(body.metadata.size, "1024x1024");
  });
});

test("/api/metadata/read returns 200 when ima2 metadata is absent", async () => {
  await withApp(makeCtx(), async (baseUrl) => {
    const dataUrl = `data:image/png;base64,${(await makePng()).toString("base64")}`;
    const res = await fetch(`${baseUrl}/api/metadata/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "plain.png", dataUrl }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.metadata, null);
    assert.equal(body.code, "IMAGE_METADATA_NOT_FOUND");
  });
});

test("/api/metadata/read validates format and size", async () => {
  await withApp(makeCtx({ maxMetadataReadB64Bytes: 4 }), async (baseUrl) => {
    const unsupported = await fetch(`${baseUrl}/api/metadata/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "x.gif", dataUrl: "data:image/gif;base64,AAAA" }),
    });
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json()).code, "IMAGE_METADATA_UNSUPPORTED_FORMAT");

    const tooLarge = await fetch(`${baseUrl}/api/metadata/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "x.png", dataUrl: "data:image/png;base64,AAAAAAAA" }),
    });
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).code, "IMAGE_METADATA_TOO_LARGE");
  });
});
