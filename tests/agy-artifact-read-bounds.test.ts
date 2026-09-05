import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { executionTestProcess } from "./_executionTestProcess.ts";
import { artifactTest, native, PNG, rejected, preserved, missing, runChild, type ArtifactFixture } from "./_agyArtifactFixture.ts";

const url = import.meta.url;
const CANCELED = { code: "GENERATION_CANCELED", status: 499 };
const TOO_LARGE = { code: "AGY_ARTIFACT_TOO_LARGE", status: 502 };
const HOSTED_MAX = 52_428_800;

interface AllocationProof {
  sizes: number[]; blocks: Buffer[]; concats: number[];
  concatSizes: Array<number | undefined>; concatAllocations: Buffer[]; concatResults: Buffer[];
}

async function allocations(body: (proof: AllocationProof) => Promise<void>) {
  const proof: AllocationProof = { sizes: [], blocks: [], concats: [], concatSizes: [], concatAllocations: [], concatResults: [] };
  const alloc = Buffer.allocUnsafe, concat = Buffer.concat;
  let insideConcat = false;
  const allocMock = mock.method(Buffer, "allocUnsafe", (size: number) => {
    const buffer = alloc(size);
    // Node22 concat invokes exported allocUnsafe; Node24 allocates internally.
    // Keep that allowed final allocation separate from descriptor-read blocks.
    if (insideConcat) proof.concatAllocations.push(buffer);
    else { proof.sizes.push(size); proof.blocks.push(buffer); }
    return buffer;
  });
  const concatMock = mock.method(Buffer, "concat", (chunks: readonly Uint8Array[], size?: number) => {
    proof.concats.push(chunks.length); proof.concatSizes.push(size);
    insideConcat = true;
    try { const result = concat(chunks, size); proof.concatResults.push(result); return result; }
    finally { insideConcat = false; }
  });
  try { await body(proof); } finally { allocMock.mock.restore(); concatMock.mock.restore(); }
}

function blockAllocations(f: ArtifactFixture, proof: AllocationProof, sizes: number[]) {
  const used = [...new Set(f.reads.map((call) => call.buffer))];
  assert.deepEqual(proof.sizes, sizes); assert.deepEqual(used.map((block) => block.length), sizes);
  assert.equal(proof.blocks.length, used.length, "every retained allocation must be an actual read block");
  for (const [index, block] of used.entries()) assert.equal(proof.blocks[index], block, "native read-block identity");
}

function finalAllocation(proof: AllocationProof, result: Buffer, expectedBytes: number, maxBytes: number) {
  assert.deepEqual(proof.concatSizes, [expectedBytes], "concat receives the exact bounded byte count");
  assert.equal(proof.concatResults.length, 1); assert.equal(proof.concatResults[0], result);
  assert.equal(result.length, expectedBytes); assert.ok(result.length <= maxBytes);
  assert.ok(proof.concatAllocations.length <= 1, "at most one observed final-result allocation");
  for (const allocation of proof.concatAllocations) {
    assert.equal(allocation, result, "concat-internal allocation must be the returned buffer");
    assert.equal(allocation.length, expectedBytes);
  }
}

function readProof(f: ArtifactFixture, bytes: number, chunk: number) {
  assert.ok(f.reads.length > 0, "descriptor read branch must execute");
  let offset = 0;
  for (const read of f.reads) {
    assert.equal(read.position, offset); assert.ok(read.length > 0 && read.length <= chunk);
    offset += read.bytesRead!;
  }
  assert.equal(offset, bytes); f.closed();
}

if (executionTestProcess(url)) {
artifactTest(url, "Agy artifact reader uses bounded chunks and no readFile", async (f) => {
  const path = await f.file();
  await allocations(async (proof) => {
    const receipt = await f.read(path); assert.deepEqual(receipt.buffer, PNG);
    readProof(f, PNG.length, 16);
    assert.ok(proof.sizes.every((size) => size <= 16)); assert.equal(proof.concats.length, 1);
    assert.ok(proof.concats[0] <= Math.ceil(PNG.length / 16));
    blockAllocations(f, proof, Array(Math.ceil(PNG.length / 16)).fill(16));
    finalAllocation(proof, receipt.buffer, PNG.length, 256);
    await f.cleanup(receipt); await missing(path);
  });
});

artifactTest(url, "Agy artifact reader rejects overflow before concatenation", async (f) => {
  const bytes = Buffer.from("abcdefghijklmnopq"), path = await f.file(undefined, bytes); let statActivated = false;
  f.hooks.stat = async (value) => { statActivated = true; return Object.assign(value, { size: 0n }); };
  await allocations(async (proof) => {
    await rejected(f, path, "AGY_ARTIFACT_TOO_LARGE"); assert.equal(statActivated, true);
    readProof(f, 17, 4); assert.deepEqual(proof.concats, []);
    assert.ok(proof.sizes.every((size) => size <= 4)); assert.equal(f.reads.at(-1)!.length, 1);
  });
  await preserved(path, bytes); assert.equal(f.events.includes("unlink"), false);
}, { maxBytes: 16, chunkBytes: 4 });

artifactTest(url, "Agy artifact reader rejects declared tiny overflow without allocation", async (f) => {
  const bytes = Buffer.from("abcdefghi"), path = await f.file(undefined, bytes);
  await allocations(async (proof) => {
    await rejected(f, path, "AGY_ARTIFACT_TOO_LARGE");
    assert.deepEqual(f.reads, []); assert.deepEqual(proof.sizes, []); assert.deepEqual(proof.concats, []);
  });
  await preserved(path, bytes);
}, { maxBytes: 8, chunkBytes: 3 });

artifactTest(url, "Agy artifact reader coalesces one-byte short reads within fixed blocks", async (f) => {
  const bytes = Buffer.from("abcdefghijklmnopqrstuvwxy"), path = await f.file(undefined, bytes);
  f.hooks.beforeRead = async (call) => { call.length = Math.min(1, call.length); };
  await allocations(async (proof) => {
    const receipt = await f.read(path); assert.deepEqual(receipt.buffer, bytes); readProof(f, 25, 8);
    assert.equal(f.reads.filter((call) => call.bytesRead === 1).length, 25);
    assert.equal(new Set(f.reads.map((call) => call.buffer)).size, 4, "short reads must fill four blocks, not retain 25");
    assert.deepEqual(proof.sizes, [8, 8, 8, 8]); assert.deepEqual(proof.concats, [4]);
    blockAllocations(f, proof, [8, 8, 8, 8]); finalAllocation(proof, receipt.buffer, 25, 32);
    await f.cleanup(receipt); await missing(path);
  });
}, { maxBytes: 32, chunkBytes: 8 });

artifactTest(url, "Agy artifact reader handles empty partial and exact tiny caps", async (f) => {
  for (const bytes of [Buffer.alloc(0), Buffer.from("abcde"), Buffer.from("abcdefgh")]) {
    f.reads.length = 0;
    const path = await f.file(undefined, bytes), receipt = await f.read(path);
    assert.deepEqual(receipt.buffer, bytes); readProof(f, bytes.length, 3);
    if (bytes.length === 8) assert.deepEqual(
      f.reads.map((call) => [call.position, call.length, call.bytesRead]), [[0, 3, 3], [3, 3, 3], [6, 2, 2], [8, 1, 0]]);
    await f.cleanup(receipt); await missing(path);
  }
}, { maxBytes: 8, chunkBytes: 3 });

artifactTest(url, "Agy artifact reader rejects tiny growth after fstat", async (f) => {
  const path = await f.file(undefined, Buffer.from("abcdefgh")); let activated = false;
  f.hooks.stat = async (value) => { activated = true; await native.appendFile(path, "i"); return value; };
  await assert.rejects(f.read(path), TOO_LARGE); assert.equal(activated, true); readProof(f, 9, 3);
  await preserved(path, Buffer.from("abcdefghi")); assert.equal(f.events.includes("unlink"), false);
}, { maxBytes: 8, chunkBytes: 3 });

artifactTest(url, "Agy artifact reader closes on read error and cancellation", async (f) => {
  const path = await f.file(), primary = Object.assign(new Error("owned fixture EIO"), { code: "EIO" });
  f.hooks.beforeRead = async () => { throw primary; };
  await assert.rejects(f.read(path), (error) => error === primary); f.closed(); await preserved(path);
  const entered = f.hold(), held = f.hold(), controller = new AbortController();
  f.hooks.beforeRead = async () => { entered.release(); await held.promise; };
  const work = f.read(path, controller.signal); let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  try {
    await entered.promise; controller.abort(); assert.equal(settled, false);
    assert.notEqual(f.handles.at(-1)!.fd, -1); held.release();
    await assert.rejects(work, CANCELED); f.closed(); await missing(path);
    assert.ok(f.events.lastIndexOf("closed") < f.events.lastIndexOf("unlink"));
  } finally { controller.abort(); held.release(); await Promise.allSettled([work]); }
});

artifactTest(url, "Agy artifact reader pre-abort performs no filesystem work", async (f) => {
  const path = await f.file(), controller = new AbortController(); controller.abort();
  f.hooks.beforeLstat = async () => { assert.fail("pre-aborted reader touched filesystem"); };
  f.hooks.beforeRealpath = async () => { assert.fail("pre-aborted reader resolved roots"); };
  await assert.rejects(f.read(path, controller.signal), CANCELED);
  assert.deepEqual(f.opened, []); await preserved(path);
});

for (const stage of ["EOF", "close"] as const) {
  artifactTest(url, `Agy artifact reader abort during ${stage} closes before guarded cleanup`, async (f) => {
    const path = await f.file(), controller = new AbortController(); let activated = false;
    if (stage === "EOF") f.hooks.afterRead = async (call) => {
      if (call.bytesRead === 0) { activated = true; controller.abort(); }
    };
    else f.hooks.beforeClose = async () => { activated = true; controller.abort(); };
    await assert.rejects(f.read(path, controller.signal), CANCELED); assert.equal(activated, true);
    f.closed(); await missing(path); assert.ok(f.events.indexOf("closed") < f.events.indexOf("unlink"));
  });
}

artifactTest(url, "Agy artifact reader late abort preserves concurrent replacement", async (f) => {
  const path = await f.file(), controller = new AbortController(); let activated = false;
  f.hooks.afterClose = async () => {
    activated = true; await native.rename(path, `${path}.original`);
    await native.writeFile(path, "replacement"); controller.abort();
  };
  await assert.rejects(f.read(path, controller.signal), CANCELED); assert.equal(activated, true); f.closed();
  await preserved(path, Buffer.from("replacement")); await preserved(`${path}.original`);
  assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact reader close failure cannot become success or mask read EIO", async (f) => {
  const closeError = Object.assign(new Error("owned close failure"), { code: "EIO" });
  const primary = Object.assign(new Error("owned read failure"), { code: "EIO" });
  const path = await f.file(); let closeActivated = 0;
  // Native close completes first: error injection never leaves abandoned kernel I/O.
  f.hooks.afterClose = async () => { closeActivated++; throw closeError; };
  await assert.rejects(f.read(path), (error) => error === closeError); f.closed(); await preserved(path);
  f.hooks.beforeRead = async () => { throw primary; };
  await assert.rejects(f.read(path), (error) => error === primary); f.closed(); await preserved(path);
  assert.equal(closeActivated, 2); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact reader read EIO remains primary through close cancellation", async (f) => {
  const path = await f.file(), controller = new AbortController();
  const primary = Object.assign(new Error("owned read EIO"), { code: "EIO" }); let activated = false;
  f.hooks.beforeRead = async () => { throw primary; };
  f.hooks.beforeClose = async () => { activated = true; controller.abort(); };
  await assert.rejects(f.read(path, controller.signal), (error) => error === primary);
  assert.equal(activated, true); f.closed(); await preserved(path); assert.equal(f.events.includes("unlink"), false);
});

artifactTest(url, "Agy artifact reader awaits held close before cancellation settles", async (f) => {
  const path = await f.file(), entered = f.hold(), held = f.hold(), controller = new AbortController();
  f.hooks.beforeClose = async () => { entered.release(); await held.promise; };
  const work = f.read(path, controller.signal); let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  try {
    await entered.promise; controller.abort(); assert.equal(settled, false);
    assert.notEqual(f.handles[0].fd, -1); await preserved(path);
    held.release(); await assert.rejects(work, CANCELED); f.closed(); await missing(path);
    assert.deepEqual(f.events.slice(0, 3), ["close-start", "closed", "unlink"]);
  } finally { controller.abort(); held.release(); await Promise.allSettled([work]); }
});

artifactTest(url, "Agy artifact reader preserves open and fstat EIO without cleanup authority", async (f) => {
  const path = await f.file();
  const openError = Object.assign(new Error("owned open EIO"), { code: "EIO" });
  const statError = Object.assign(new Error("owned stat EIO"), { code: "EIO" });
  let openActivated = false, statActivated = false;
  f.hooks.beforeOpen = async () => { openActivated = true; throw openError; };
  await assert.rejects(f.read(path), (error) => error === openError); assert.equal(openActivated, true);
  assert.deepEqual(f.handles, []); delete f.hooks.beforeOpen;
  f.hooks.stat = async () => { statActivated = true; throw statError; };
  await assert.rejects(f.read(path), (error) => error === statError); assert.equal(statActivated, true);
  assert.equal(f.handles.length, 1); f.closed(); assert.deepEqual(f.reads, []);
  await preserved(path); assert.equal(f.events.includes("unlink"), false);
});

test("Agy emitted artifact reader enforces tiny policy and cleanup", async () => {
  const helper = new URL("./_agyArtifactFixture.ts", url).href;
  const output = await runChild(["--input-type=module", "--eval", `
    import { mock } from 'node:test';
    const h = await import(${JSON.stringify(helper)});
    await h.emittedTinyProbe(url => import(url), (url, options) => mock.module(url, options));
  `]);
  assert.match(output, /emitted config.js tiny cap, exact bytes, native close and guarded cleanup executed/);
});

for (const operation of ["realpath", "readFile", "rm"] as const) {
  test(`Agy artifact fixture persists caught ${operation} guard violations`, async () => {
    const helper = new URL("./_agyArtifactFixture.ts", url).href;
    await assert.rejects(runChild(["--input-type=module", "--eval", `
      import assert from 'node:assert/strict';
      import fs from 'node:fs/promises';
      const h = await import(${JSON.stringify(helper)});
      const originals = { realpath: fs.realpath, readFile: fs.readFile, rm: fs.rm };
      const f = await h.openArtifactFixture();
      let closeError;
      try {
        const path = await f.file();
        const receipt = await f.read(path); assert.deepEqual(receipt.buffer, h.PNG); f.closed();
        let reachedHook = false, caught = false;
        f.hooks.beforeRealpath = async () => { reachedHook = true; };
        try {
          const target = ${JSON.stringify(operation)} === 'realpath' ? f.root + '-denied-never-created' : path;
          await fs[${JSON.stringify(operation)}](target);
        } catch { caught = true; }
        assert.equal(caught, true, 'the forbidden operation must be denied');
        assert.equal(reachedHook, false, 'boundary denial must precede hooks and native I/O');
        await h.preserved(path);
      } finally {
        try { await f.close(); } catch (error) { closeError = error; }
      }
      for (const [name, method] of Object.entries(originals)) assert.equal(fs[name], method, 'hooks restored');
      f.closed(); await assert.rejects(fs.lstat(f.root), { code: 'ENOENT' });
      if (closeError) throw closeError;
    `]), /AGY_ARTIFACT_FIXTURE_FS_GUARD_LEDGER/);
  });
}

artifactTest(url, "[hosted CI] Agy artifact exact 50MiB succeeds", async (f) => {
  const path = await f.file(undefined, Buffer.alloc(0));
  const writer = await native.open(path, "w");
  try { const block = Buffer.alloc(65_536, 0x61); for (let i = 0; i < 800; i++) await writer.write(block); }
  finally { await writer.close(); }
  const receipt = await f.read(path); assert.equal(receipt.buffer.length, HOSTED_MAX);
  assert.ok(receipt.buffer.every((byte) => byte === 0x61)); readProof(f, HOSTED_MAX, 65_536);
  await f.cleanup(receipt); await missing(path);
}, null);

artifactTest(url, "[hosted CI] Agy artifact declared 50MiB plus one rejects", async (f) => {
  const path = await f.file(undefined, Buffer.from("x")); await native.truncate(path, HOSTED_MAX + 1);
  await allocations(async (proof) => {
    await rejected(f, path, "AGY_ARTIFACT_TOO_LARGE");
    assert.deepEqual(f.reads, []); assert.deepEqual(proof.sizes, []); assert.deepEqual(proof.concats, []);
  });
  assert.equal((await native.stat(path)).size, HOSTED_MAX + 1); assert.equal(f.events.includes("unlink"), false);
}, null);

artifactTest(url, "[hosted CI] Agy artifact growth beyond 50MiB rejects", async (f) => {
  const path = await f.file(undefined, Buffer.alloc(0)); await native.truncate(path, HOSTED_MAX);
  let activated = false;
  f.hooks.afterRead = async (call) => {
    if (!activated && call.bytesRead! > 0) { activated = true; await native.appendFile(path, "x"); }
  };
  await allocations(async (proof) => {
    await rejected(f, path, "AGY_ARTIFACT_TOO_LARGE"); assert.equal(activated, true);
    readProof(f, HOSTED_MAX + 1, 65_536); assert.deepEqual(proof.concats, []);
  });
  assert.equal((await native.stat(path)).size, HOSTED_MAX + 1); assert.equal(f.events.includes("unlink"), false);
}, null);

artifactTest(url, "[hosted CI] Agy artifact streamed cap rejects 50MiB plus one", async (f) => {
  const path = await f.file(undefined, Buffer.alloc(0)); await native.truncate(path, HOSTED_MAX + 1);
  let activated = false;
  f.hooks.stat = async (value) => { activated = true; return Object.assign(value, { size: 0n }); };
  await allocations(async (proof) => {
    await rejected(f, path, "AGY_ARTIFACT_TOO_LARGE"); assert.equal(activated, true);
    readProof(f, HOSTED_MAX + 1, 65_536); assert.deepEqual(proof.concats, []);
    assert.ok(proof.sizes.length <= 801); assert.ok(proof.sizes.every((size) => size <= 65_536));
  });
  assert.equal((await native.stat(path)).size, HOSTED_MAX + 1); assert.equal(f.events.includes("unlink"), false);
}, null);
}
