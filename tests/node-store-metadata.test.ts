import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { test, mock } from "node:test";

test("node metadata stays in the supplied canonical generated directory", async (t) => {
  const root = await fs.mkdtemp(join(tmpdir(), "ima2-node-meta-"));
  const generated = join(root, "generated");
  const sibling = join(root, "generated-sibling");
  const reads: string[] = [];
  const handles: Array<{ restore(): void }> = [];
  try {
    await fs.mkdir(generated);
    await fs.mkdir(sibling);
    // No real config/history graph may load, even when an explicit directory is used.
    handles.push(mock.module(new URL("../config.ts", import.meta.url).href, {
      namedExports: { config: { get storage() { throw new Error("global config accessed"); } } },
    }));
    handles.push(mock.module(new URL("../lib/historyIndex.ts", import.meta.url).href, {
      namedExports: { invalidateHistoryIndex() {} },
    }));
    handles.push(mock.module(new URL("../lib/imageMetadataStore.ts", import.meta.url).href, {
      namedExports: { embedImageMetadataBestEffort() { throw new Error("unexpected image write"); } },
    }));
    handles.push(mock.module("fs/promises", { namedExports: {
      ...fs,
      readFile: async (path: string, encoding: "utf-8") => {
        reads.push(path);
        return fs.readFile(path, encoding);
      },
    } }));
    const { loadNodeMeta } = await import("../lib/nodeStore.ts");
    const metadata = { prompt: "owned fixture", format: "jpeg" };
    await fs.writeFile(join(generated, "legacy id.v1.jpeg.json"), JSON.stringify(metadata));
    await fs.writeFile(join(sibling, "secret.png.json"), '{"outside":true}');

    await t.test("legacy IDs, custom extension, relative/trailing directory and missing JSON", async () => {
      assert.deepEqual(await loadNodeMeta("unused", "legacy id.v1", "jpeg", generated), metadata);
      assert.deepEqual(await loadNodeMeta("unused", "legacy id.v1", "jpeg", generated + sep), metadata);
      assert.deepEqual(await loadNodeMeta("unused", "legacy id.v1", "jpeg", relative(process.cwd(), generated)), metadata);
      assert.equal(await loadNodeMeta("unused", "missing", "png", generated), null);
      assert.equal(await loadNodeMeta("unused", "legacy id.v1", "jpeg", join(root, "absent")), null);
      await fs.writeFile(join(generated, "bad.png.json"), "{invalid");
      assert.equal(await loadNodeMeta("unused", "bad", "png", generated), null);
    });
    await t.test("traversal, sibling prefix and extension traversal are rejected before reading", async () => {
      reads.length = 0;
      for (const nodeId of ["../generated-sibling/secret", join(sibling, "secret"), "bad\0id"]) {
        assert.equal(await loadNodeMeta("unused", nodeId, "png", generated), null);
      }
      assert.equal(await loadNodeMeta("unused", "x", "/../../generated-sibling/secret.png", generated), null);
      assert.deepEqual(reads, []);
    });
    await t.test("directory symlink escape is rejected before reading", async () => {
      await fs.symlink(sibling, join(generated, "escape"), process.platform === "win32" ? "junction" : "dir");
      reads.length = 0;
      assert.equal(await loadNodeMeta("unused", "escape/secret", "png", generated), null);
      assert.deepEqual(reads, []);
    });
    await t.test("canonical root aliases and contained directory aliases remain readable", async () => {
      const alias = join(root, "alias");
      await fs.symlink(generated, alias, process.platform === "win32" ? "junction" : "dir");
      await fs.symlink(generated, join(generated, "inside"), process.platform === "win32" ? "junction" : "dir");
      assert.deepEqual(await loadNodeMeta("unused", "legacy id.v1", "jpeg", alias), metadata);
      assert.deepEqual(await loadNodeMeta("unused", "inside/legacy id.v1", "jpeg", generated), metadata);
    });
    if (process.platform !== "win32") {
      // Windows directory-junction coverage above does not require symlink privileges.
      await t.test("leaf symlink escape is rejected before reading", async () => {
        await fs.symlink(join(sibling, "secret.png.json"), join(generated, "leaf.png.json"));
        reads.length = 0;
        assert.equal(await loadNodeMeta("unused", "leaf", "png", generated), null);
        assert.deepEqual(reads, []);
      });
    }
  } finally {
    for (const handle of handles.reverse()) handle.restore();
    await fs.rm(root, { recursive: true, force: true });
  }
});
