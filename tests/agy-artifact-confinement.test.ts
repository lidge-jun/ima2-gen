import assert from "node:assert/strict";
import { constants } from "node:fs";
import { join } from "node:path";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { artifactTest, native, PNG, rejected, preserved, missing, ownedFifo, type ArtifactFixture } from "./_agyArtifactFixture.ts";

const url = import.meta.url;
const directoryLink = process.platform === "win32" ? "junction" : "dir";
async function replace(path: string) {
  await native.rename(path, `${path}.original`);
  await native.writeFile(path, "replacement");
}
async function replacementSurvives(path: string) {
  await preserved(path, Buffer.from("replacement")); await preserved(`${path}.original`);
}

if (executionTestProcess(url)) {
artifactTest(url, "Agy artifact accepts owned regular bytes and guarded cleanup", async (f) => {
  for (const root of f.roots) {
    const path = await f.file(root), info = await native.lstat(path, { bigint: true });
    const receipt = await f.read(path);
    assert.deepEqual(receipt.buffer, PNG); assert.equal(receipt.canonicalPath, await native.realpath(path));
    assert.deepEqual(receipt.identity, { dev: info.dev, ino: info.ino });
    assert.deepEqual(receipt.approvedRoots, f.roots); f.closed();
    await f.cleanup(receipt); await missing(path);
    assert.equal((await native.lstat(root)).isDirectory(), true, "approved root must survive");
  }
  for (const flags of f.flags) {
    assert.equal(flags & constants.O_WRONLY, 0); assert.equal(flags & constants.O_RDWR, 0);
    if (process.platform !== "win32") {
      assert.equal(flags & constants.O_NOFOLLOW, constants.O_NOFOLLOW);
      assert.equal(flags & constants.O_NONBLOCK, constants.O_NONBLOCK);
    }
  }
});

artifactTest(url, "Agy artifact accepts intentionally relocated canonical roots", async (f) => {
  const relocated = join(f.outside, "relocated-root");
  await native.rename(f.roots[0], relocated); await native.symlink(relocated, f.roots[0], directoryLink);
  const path = await f.file(f.roots[0]), receipt = await f.read(path);
  assert.deepEqual(receipt.buffer, PNG);
  assert.equal(receipt.canonicalPath, join(relocated, "ima2_generated_owned.png"));
  assert.deepEqual(receipt.approvedRoots, [relocated, f.roots[1], f.temp]);
  await f.cleanup(receipt); await missing(path); assert.equal((await native.lstat(relocated)).isDirectory(), true);
  const canonical = await f.file(relocated), direct = await f.read(canonical);
  assert.deepEqual(direct.buffer, PNG); assert.equal(direct.canonicalPath, canonical);
  await f.cleanup(direct); await missing(canonical);
});

artifactTest(url, "Agy artifact omits missing roots without broadening authority", async (f) => {
  await native.rmdir(f.roots[0]); await native.rmdir(f.roots[1]);
  const outside = await f.file(f.home);
  await rejected(f, outside); await preserved(outside); assert.deepEqual(f.opened, []);
  const path = await f.file(f.temp), receipt = await f.read(path);
  assert.deepEqual(receipt.approvedRoots, [f.temp]); assert.deepEqual(receipt.buffer, PNG);
  await f.cleanup(receipt); await missing(path);
});

artifactTest(url, "Agy artifact rejects root lookup errors without broadening authority", async (f) => {
  const path = await f.file(f.temp); let activated = false;
  f.hooks.beforeRealpath = async (candidate) => {
    if (candidate === f.roots[0]) { activated = true; throw Object.assign(new Error("fixture denied"), { code: "EACCES" }); }
  };
  await rejected(f, path); assert.equal(activated, true); assert.deepEqual(f.opened, []); await preserved(path);
});

artifactTest(url, "Agy artifact rejects leaf symlinks without reading or deleting targets", async (f) => {
  const outside = await f.file(f.outside), leaf = join(f.roots[0], "ima2_generated_link.png");
  await native.symlink(outside, leaf, "file");
  await rejected(f, leaf); await preserved(outside);
  assert.equal((await native.lstat(leaf)).isSymbolicLink(), true);
  assert.deepEqual(f.opened, []); assert.deepEqual(f.reads, []); assert.deepEqual(f.events, []);
});

artifactTest(url, "Agy artifact rejects directory links sibling prefixes and traversal", async (f) => {
  const outside = await f.file(f.outside), link = join(f.roots[0], "escape");
  await native.symlink(f.outside, link, directoryLink);
  const sibling = await f.file(`${f.roots[0]}-sibling`);
  const traversal = `${f.roots[0]}/../../outside/ima2_generated_owned.png`;
  for (const path of [join(link, "ima2_generated_owned.png"), sibling, traversal]) await rejected(f, path);
  await preserved(outside); await preserved(sibling); assert.deepEqual(f.opened, []); assert.deepEqual(f.events, []);
});

artifactTest(url, "Agy artifact rejects relative NUL nonregular and nonexistent candidates", async (f) => {
  for (const path of ["relative.png", `${f.roots[0]}/bad\0.png`, f.roots[0]]) await rejected(f, path);
  if (process.platform === "win32") await rejected(f, `${f.roots[0]}\\owned.png:stream`);
  await rejected(f, join(f.roots[0], "missing.png"), "AGY_ARTIFACT_NOT_FOUND");
  await rejected(f, join(f.outside, "missing.png"));
  const parentFile = await f.file();
  await rejected(f, join(parentFile, "not-a-directory.png"), "AGY_ARTIFACT_NOT_FOUND");
  assert.deepEqual(f.opened, []); assert.deepEqual(f.events, []); await preserved(parentFile);
});

artifactTest(url, "Agy artifact rejects platform-native nonregular entries before open", async (f) => {
  // Every platform tests directories; POSIX additionally exercises an actual FIFO.
  const directory = join(f.roots[0], "ima2_generated_directory.png"); await native.mkdir(directory);
  await rejected(f, directory); assert.equal((await native.lstat(directory)).isDirectory(), true);
  if (process.platform !== "win32") {
    const fifo = await ownedFifo(f); await rejected(f, fifo);
    assert.equal((await native.lstat(fifo)).isFIFO(), true);
  }
  assert.deepEqual(f.opened, []); assert.deepEqual(f.reads, []); assert.deepEqual(f.events, []);
});

artifactTest(url, "Agy artifact applies confinement to RESULT SAVED_PATH and regex candidates", async (f) => {
  // Use the parser owner directly: no operation, provider, or native Agy child is imported.
  const { parseAgyOutput } = await import("../lib/agyArtifact.ts");
  const root = join(f.outside, "artifacts"), outside = await f.file(root);
  for (const stdout of [`RESULT|${outside}|png`, `SAVED_PATH=${outside}`, `Saved image to ${outside}`]) {
    const parsed = parseAgyOutput(stdout); assert.equal(parsed.artifactPath, outside);
    await rejected(f, parsed.artifactPath); await preserved(outside);
  }
  assert.deepEqual(f.opened, []); assert.deepEqual(f.events, []);
});

artifactTest(url, "Agy artifact rejects unusable root and leaf identities before open", async (f) => {
  const path = await f.file();
  for (const candidate of [f.roots[0], path]) {
    let activated = false;
    f.hooks.lstat = async (current, value) => {
      if (current === candidate) { activated = true; return Object.assign(value, { ino: 0n }); }
      return value;
    };
    await rejected(f, path); assert.equal(activated, true); await preserved(path);
  }
  assert.deepEqual(f.opened, []); assert.deepEqual(f.events, []);
});

artifactTest(url, "Agy artifact preserves candidate lstat EIO before open", async (f) => {
  const path = await f.file(), primary = Object.assign(new Error("owned candidate metadata EIO"), { code: "EIO" });
  let activated = false;
  f.hooks.beforeLstat = async (candidate) => {
    if (candidate === path) { activated = true; throw primary; }
  };
  await assert.rejects(f.read(path), (error) => error === primary);
  assert.equal(activated, true); assert.deepEqual(f.opened, []); assert.deepEqual(f.reads, []);
  f.closed(); await preserved(path); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact preserves candidate lstat EIO before return", async (f) => {
  const path = await f.file(), primary = Object.assign(new Error("owned final metadata EIO"), { code: "EIO" });
  let eof = false, activated = false;
  f.hooks.afterRead = async (call) => { if (call.bytesRead === 0) eof = true; };
  f.hooks.beforeLstat = async (candidate) => {
    if (candidate === path && eof) { activated = true; throw primary; }
  };
  await assert.rejects(f.read(path), (error) => error === primary);
  assert.equal(eof, true); assert.equal(activated, true); assert.equal(f.handles.length, 1);
  f.closed(); assert.ok(f.events.includes("closed")); await preserved(path);
  assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact rejects pre-open identity replacement", async (f) => {
  const path = await f.file(); let activated = false;
  f.hooks.beforeOpen = async () => { activated = true; await replace(path); };
  await rejected(f, path); assert.equal(activated, true); assert.equal(f.handles.length, 1);
  assert.deepEqual(f.reads, []); await replacementSurvives(path);
});

artifactTest(url, "Agy artifact rejects pre-open leaf link replacement", async (f) => {
  const path = await f.file(), outside = await f.file(f.outside); let activated = false;
  f.hooks.beforeOpen = async () => {
    activated = true; await native.rename(path, `${path}.original`); await native.symlink(outside, path, "file");
  };
  await rejected(f, path); assert.equal(activated, true); assert.deepEqual(f.reads, []);
  await preserved(outside); assert.equal((await native.lstat(path)).isSymbolicLink(), true);
});

artifactTest(url, "Agy artifact rejects post-open replacement before reading", async (f) => {
  const path = await f.file(); let activated = false;
  f.hooks.afterOpen = async () => { activated = true; await replace(path); };
  await rejected(f, path); assert.equal(activated, true); assert.equal(f.handles.length, 1);
  assert.deepEqual(f.reads, []); await replacementSurvives(path);
});

artifactTest(url, "Agy artifact rejects changed identity before return", async (f) => {
  const path = await f.file(); let activated = false;
  f.hooks.afterRead = async (call) => {
    if (call.bytesRead === 0) { activated = true; await replace(path); }
  };
  await rejected(f, path); assert.equal(activated, true); assert.ok(f.reads.some((read) => read.bytesRead === 0));
  await replacementSurvives(path); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact revalidates identity after descriptor close", async (f) => {
  const path = await f.file(); let activated = false;
  f.hooks.afterClose = async () => { activated = true; await replace(path); };
  await rejected(f, path); assert.equal(activated, true); await replacementSurvives(path);
});

async function redirected(f: ArtifactFixture, stage: "read" | "cleanup") {
  const parent = join(f.roots[0], "parent"), moved = join(f.outside, "moved");
  const path = await f.file(parent); let activated = false;
  const redirect = async () => {
    activated = true; await native.rename(parent, moved); await native.symlink(moved, parent, directoryLink);
  };
  if (stage === "read") {
    f.hooks.afterRead = async (call) => { if (call.bytesRead === 0) await redirect(); };
    await rejected(f, path);
  } else {
    const receipt = await f.read(path); await redirect(); await f.cleanup(receipt);
  }
  assert.equal(activated, true); await preserved(join(moved, "ima2_generated_owned.png"));
  assert.equal(f.events.includes("unlink"), false);
}

artifactTest(url, "Agy artifact rejects original candidate parent mapping changes", async (f) => { await redirected(f, "read"); });
artifactTest(url, "Agy artifact cleanup rejects redirected parents with unchanged file identity", async (f) => { await redirected(f, "cleanup"); });

artifactTest(url, "Agy artifact rejects root relocation during reading", async (f) => {
  const path = await f.file(), moved = join(f.outside, "moved-root"); let activated = false;
  f.hooks.afterRead = async (call) => {
    if (call.bytesRead === 0) {
      activated = true; await native.rename(f.roots[0], moved); await native.symlink(moved, f.roots[0], directoryLink);
    }
  };
  await rejected(f, path); assert.equal(activated, true); await preserved(join(moved, "ima2_generated_owned.png"));
});

artifactTest(url, "Agy artifact cleanup preserves replacement and concurrent siblings", async (f) => {
  const path = await f.file(join(f.roots[0], "replacement")), receipt = await f.read(path);
  await replace(path); await f.cleanup(receipt); await replacementSurvives(path);
  const parent = join(f.roots[0], "siblings"), accepted = await f.file(parent);
  const clean = await f.read(accepted); let activated = false;
  f.hooks.beforeRmdir = async (dir) => {
    assert.equal(dir, parent); activated = true; await native.writeFile(join(dir, "unrelated.txt"), "keep sibling");
  };
  await f.cleanup(clean); await missing(accepted); assert.equal(activated, true);
  await preserved(join(parent, "unrelated.txt"), Buffer.from("keep sibling"));
});

artifactTest(url, "Agy artifact cleanup preserves a replaced parent with unchanged artifact identity", async (f) => {
  const parent = join(f.roots[0], "parent"), path = await f.file(parent), receipt = await f.read(path);
  const moved = `${parent}.original`; await native.rename(parent, moved); await native.mkdir(parent);
  await native.rename(join(moved, "ima2_generated_owned.png"), path);
  const info = await native.lstat(path, { bigint: true });
  assert.deepEqual({ dev: info.dev, ino: info.ino }, receipt.identity, "file identity stayed constant");
  await f.cleanup(receipt); await preserved(path); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact cleanup revalidates parent identity after unlink", async (f) => {
  const parent = join(f.roots[0], "parent"), path = await f.file(parent), receipt = await f.read(path);
  let activated = false;
  f.hooks.beforeRealpath = async (candidate) => {
    if (candidate === parent && f.events.includes("unlink")) {
      activated = true; await native.rename(parent, `${parent}.original`); await native.mkdir(parent);
      await native.writeFile(join(parent, "replacement.txt"), "replacement parent");
    }
  };
  await f.cleanup(receipt); await missing(path); assert.equal(activated, true);
  await preserved(join(parent, "replacement.txt"), Buffer.from("replacement parent"));
  assert.equal(f.events.includes("rmdir"), false);
});

artifactTest(url, "Agy artifact cleanup rejects leaf link replacements", async (f) => {
  const path = await f.file(), receipt = await f.read(path), outside = await f.file(f.outside);
  await native.rename(path, `${path}.original`); await native.symlink(outside, path, "file");
  await f.cleanup(receipt); await preserved(outside); await preserved(`${path}.original`);
  assert.equal((await native.lstat(path)).isSymbolicLink(), true); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact cleanup rejects relocated root authority", async (f) => {
  const path = await f.file(), receipt = await f.read(path), moved = join(f.outside, "moved-root");
  await native.rename(f.roots[0], moved); await native.symlink(moved, f.roots[0], directoryLink);
  await f.cleanup(receipt); await preserved(join(moved, "ima2_generated_owned.png"));
  assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact cleanup rejects forged receipts and freezes authority", async (f) => {
  const path = await f.file(), receipt = await f.read(path), outside = await f.file(f.outside);
  const info = await native.lstat(outside, { bigint: true });
  await f.cleanup({ ...receipt, canonicalPath: outside, identity: { dev: info.dev, ino: info.ino } });
  await preserved(outside); await preserved(path); assert.equal(f.events.includes("unlink"), false);
  assert.ok(Object.isFrozen(receipt)); assert.ok(Object.isFrozen(receipt.identity)); assert.ok(Object.isFrozen(receipt.approvedRoots));
  assert.throws(() => Object.assign(receipt, { canonicalPath: outside }), TypeError);
  assert.throws(() => Object.assign(receipt.identity, { ino: info.ino }), TypeError);
  await f.cleanup(receipt); await missing(path); await preserved(outside);
  await f.file(undefined, PNG); await f.cleanup(receipt); await preserved(path);
});

artifactTest(url, "Agy artifact cleanup removes only an empty contained parent", async (f) => {
  const parent = join(f.roots[0], "empty"), path = await f.file(parent), receipt = await f.read(path);
  await f.cleanup(receipt); await missing(path); await missing(parent);
  assert.equal((await native.lstat(f.roots[0])).isDirectory(), true);
});

artifactTest(url, "Agy artifact rejects unusable descriptor identity and nonregular fstat", async (f) => {
  for (const kind of ["identity", "directory"] as const) {
    const path = await f.file(undefined, PNG, `${kind}.png`); let activated = false;
    f.hooks.stat = async (value) => {
      activated = true;
      if (kind === "identity") return Object.assign(value, { ino: 0n });
      return await native.lstat(f.roots[0], { bigint: true });
    };
    await rejected(f, path); assert.equal(activated, true); await preserved(path);
  }
  assert.deepEqual(f.reads, []); assert.equal(f.events.includes("unlink"), false);
});
}
