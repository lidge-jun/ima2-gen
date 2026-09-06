import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { test, mock } from "node:test";
import type { RuntimeContext } from "../lib/runtimeContext.ts";

test("canvas filename suffix normalization preserves output and directory forms", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "ima2-canvas-normalize-"));
  const generated = join(root, "generated");
  // These replace every runtime edge to global configuration and image processing.
  const handles = [
    mock.module(new URL("../lib/historyIndex.ts", import.meta.url).href, {
      namedExports: { invalidateHistoryIndex() {} },
    }),
    mock.module(new URL("../lib/imageMetadataStore.ts", import.meta.url).href, {
      namedExports: { embedImageMetadataBestEffort: async (buffer: Buffer) => ({ buffer, embedded: true }) },
    }),
    mock.module("sharp", { defaultExport() { throw new Error("unexpected image processing"); } }),
  ];
  try {
    const { createCanvasVersion } = await import("../lib/canvasVersionStore.ts");
    const buffer = Buffer.from("89504e470d0a1a0a", "hex");
    const cases = [
      ["--hello__world--.png", "hello__world"],
      ["!!!hello world!!!.png", "hello-world"],
      ["----.png", "image"],
      ["a".repeat(100) + "---.png", "a".repeat(80)],
      ["a" + "-".repeat(64000) + "z.png", "a" + "-".repeat(79)],
      ["a" + "-".repeat(64000) + ".png", "a"],
    ];
    for (const generatedDir of [generated, generated + sep, relative(process.cwd(), generated)]) {
      // Only the three fields this store consumes; no runtimeContext/config import.
      const ctx = { config: { storage: { generatedDir } }, packageVersion: "fixture" } as RuntimeContext;
      for (const [sourceFilename, expected] of cases) {
        const item = await createCanvasVersion(ctx, { buffer, sourceFilename, prompt: "fixture prompt" });
        assert.equal(item.filename.slice(0, -26), `canvas-${expected}`);
        assert.match(item.filename.slice(-26), /^-\d{14}-[a-f0-9]{6}\.png$/);
        assert.deepEqual(await fs.readFile(join(generated, item.filename)), buffer);
        const meta = JSON.parse(await fs.readFile(join(generated, item.filename + ".json"), "utf8"));
        assert.equal(meta.canvasSourceFilename, sourceFilename);
        assert.equal(meta.prompt, "fixture prompt");
      }
    }
  } finally {
    for (const handle of handles.reverse()) handle.restore();
    await fs.rm(root, { recursive: true, force: true });
  }
});
