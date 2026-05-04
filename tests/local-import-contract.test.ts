import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerImageImportRoutes } from "../routes/imageImport.ts";

const PNG_FIXTURE = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63600000000200015c2d05cf0000000049454e44ae426082",
  "hex",
);

async function startApp(generatedDir) {
  const app = express();
  registerImageImportRoutes(app, {
    config: { storage: { generatedDir }, server: { bodyLimit: "20mb" } },
    packageVersion: "test",
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return { server, port };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function postRaw(port, headers, body) {
  const res = await fetch(`http://127.0.0.1:${port}/api/history/import-local`, {
    method: "POST",
    headers,
    body,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

test("POST /api/history/import-local rejects non-image bodies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-import-"));
  const { server, port } = await startApp(dir);
  try {
    const res = await postRaw(
      port,
      { "Content-Type": "image/png" },
      Buffer.from("not an image"),
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "IMPORT_BAD_FORMAT");
  } finally {
    await closeServer(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("POST /api/history/import-local accepts PNG and writes to generated/", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-import-"));
  const { server, port } = await startApp(dir);
  try {
    const res = await postRaw(
      port,
      {
        "Content-Type": "image/png",
        "X-Ima2-Original-Filename": encodeURIComponent("photo.png"),
      },
      PNG_FIXTURE,
    );
    assert.equal(res.status, 201);
    assert.match(res.body.item.filename, /^imported-\d{14}-[0-9a-f]{6}\.png$/);
    const files = await readdir(dir);
    const pngFile = files.find((f) => f.endsWith(".png"));
    assert.ok(pngFile, "PNG was written");
    const written = await readFile(join(dir, pngFile));
    assert.ok(written.length > 0);
  } finally {
    await closeServer(server);
    await rm(dir, { recursive: true, force: true });
  }
});

test("POST /api/history/import-local rejects empty body", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-import-"));
  const { server, port } = await startApp(dir);
  try {
    const res = await postRaw(
      port,
      { "Content-Type": "image/png" },
      Buffer.alloc(0),
    );
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "EMPTY_IMPORT");
  } finally {
    await closeServer(server);
    await rm(dir, { recursive: true, force: true });
  }
});
