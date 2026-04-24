import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setFavoriteFlag, InvalidFilenameError, SidecarMissingError } from "../lib/favorite.js";

let tmp;

beforeEach(async () => {
  tmp = join(tmpdir(), `ima2-fav-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(tmp, { recursive: true });
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe("setFavoriteFlag", () => {
  it("sets favorite=true in an existing sidecar", async () => {
    await writeFile(join(tmp, "a.png"), "img");
    await writeFile(join(tmp, "a.png.json"), JSON.stringify({ prompt: "x" }));
    const result = await setFavoriteFlag(tmp, "a.png", true);
    assert.equal(result.favorite, true);
    const raw = JSON.parse(await readFile(join(tmp, "a.png.json"), "utf-8"));
    assert.equal(raw.favorite, true);
    assert.equal(raw.prompt, "x");
  });
  it("clears favorite when value is false", async () => {
    await writeFile(join(tmp, "a.png"), "img");
    await writeFile(join(tmp, "a.png.json"), JSON.stringify({ favorite: true }));
    await setFavoriteFlag(tmp, "a.png", false);
    const raw = JSON.parse(await readFile(join(tmp, "a.png.json"), "utf-8"));
    assert.equal(raw.favorite, false);
  });
  it("rejects path traversal", async () => {
    await assert.rejects(
      () => setFavoriteFlag(tmp, "../escape.png", true),
      (err) => err instanceof InvalidFilenameError,
    );
  });
  it("rejects absolute paths", async () => {
    await assert.rejects(
      () => setFavoriteFlag(tmp, "/etc/passwd", true),
      (err) => err instanceof InvalidFilenameError,
    );
  });
  it("rejects non-existent sidecar", async () => {
    await assert.rejects(
      () => setFavoriteFlag(tmp, "missing.png", true),
      (err) => err instanceof SidecarMissingError,
    );
  });
});
