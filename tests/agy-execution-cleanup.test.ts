import assert from "node:assert/strict";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import test from "node:test";
import { withAgyFaults } from "./_agyFaultFixtures.ts";

// Independent tiny valid PNGs, not bytes derived from the operation under test.
const WHITE_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const BLACK_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const REFERENCES = [WHITE_PNG, BLACK_PNG].map((b64) => ({ b64, declaredMime: "image/png" }));

function isCanceled(error: unknown): boolean {
  assert.ok(error instanceof Error);
  assert.equal(Reflect.get(error, "status"), 499);
  assert.equal(Reflect.get(error, "code"), "GENERATION_CANCELED");
  return true;
}

test("Agy ordinary success activates exact staging/read/removal hooks", async () => {
  await withAgyFaults({ hold: "read" }, async (faults, fixture) => {
    const work = faults.run(REFERENCES);
    await faults.waitAt("read", work);
    assert.equal(fixture.spawnCount(), 1);
    await fixture.waitFor("close");
    assert.equal(faults.count("mkdir", "completed"), 1);
    assert.equal(faults.count("writeFile", "completed"), 2);
    assert.equal(faults.count("read", "entered"), 1);
    assert.deepEqual((await faults.stagedFiles()).sort(), ["ref_0.png", "ref_1.png"]);
    for (const [index, reference] of REFERENCES.entries()) {
      assert.deepEqual(await faults.readKnown(join(faults.directory(), `ref_${index}.png`)),
        Buffer.from(reference.b64, "base64"));
    }
    const expectedArtifact = await faults.readKnown(faults.artifactPath);
    faults.release();
    const result = await work;
    assert.equal(result.b64, expectedArtifact.toString("base64"));
    assert.deepEqual(faults.successfulRead(), expectedArtifact);
    assert.equal(result.mime, "image/png");
    assert.equal(result.revisedPrompt, "cleanup fixture prompt");
    assert.deepEqual(result.usage, { agy_artifact_bytes: expectedArtifact.length });
    assert.equal(result.webSearchCalls, 0);
    assert.equal(faults.count("read", "completed"), 2, "data read plus bounded EOF read");
    assert.equal(faults.count("close", "completed"), 1);
    assert.equal(faults.count("unlink", "completed"), 1);
    assert.equal(faults.count("rmdir", "completed"), 1);
    assert.equal(faults.count("rm", "completed"), 1, "reference staging only");
    await faults.assertAbsent(faults.directory());
    await faults.assertAbsent(faults.artifactPath);
  });
});

test("Agy second-reference EIO removes partial staging and preserves error identity without spawning", async () => {
  await withAgyFaults({ fail: "second-ref" }, async (faults, fixture) => {
    await assert.rejects(faults.run(REFERENCES), (error) => error === faults.error);
    assert.equal(faults.count("mkdir", "completed"), 1);
    assert.equal(faults.count("writeFile", "completed"), 1);
    assert.equal(faults.count("writeFile", "injected"), 1);
    assert.deepEqual(faults.receipts.filter((entry) => entry.method === "writeFile").map(
      (entry) => [entry.path, entry.state]), [
      [join(faults.directory(), "ref_0.png"), "entered"],
      [join(faults.directory(), "ref_0.png"), "completed"],
      [join(faults.directory(), "ref_1.png"), "entered"],
      [join(faults.directory(), "ref_1.png"), "injected"],
    ]);
    assert.equal(fixture.spawnCount(), 0);
    assert.equal(faults.count("read", "entered"), 0);
    assert.equal(faults.count("rm", "completed"), 1);
    await faults.assertAbsent(faults.directory());
  });
});

test("Agy owned mkdir failure preserves EIO with no staged files or process", async () => {
  await withAgyFaults({ fail: "mkdir" }, async (faults, fixture) => {
    await assert.rejects(faults.run(REFERENCES), (error) => error === faults.error);
    assert.equal(faults.count("mkdir", "injected"), 1);
    assert.equal(faults.count("mkdir", "completed"), 0);
    assert.equal(faults.count("writeFile", "entered"), 0);
    assert.equal(faults.count("read", "entered"), 0);
    assert.equal(fixture.spawnCount(), 0);
    await faults.assertAbsent(faults.directory());
  });
});

test("Agy abort during held artifact read rejects 499 and cleans the successfully read known artifact", async () => {
  await withAgyFaults({ hold: "read" }, async (faults, fixture) => {
    const work = faults.run(REFERENCES);
    await faults.waitAt("read", work);
    await fixture.waitFor("close");
    assert.equal(faults.count("read", "completed"), 0);
    const expectedArtifact = await faults.readKnown(faults.artifactPath);
    faults.controller.abort();
    faults.release();
    await assert.rejects(work, isCanceled);
    assert.equal(fixture.spawnCount(), 1);
    assert.equal(faults.count("read", "completed"), 1);
    assert.deepEqual(faults.successfulRead(), expectedArtifact);
    assert.equal(faults.count("close", "completed"), 1);
    assert.equal(faults.count("unlink", "completed"), 1);
    assert.equal(faults.count("rmdir", "completed"), 1);
    assert.equal(faults.count("rm", "completed"), 1);
    await faults.assertAbsent(faults.artifactPath);
    await faults.assertAbsent(faults.directory());
  });
});

test("Agy abort during successful held reference removal is caught after cleanup", async () => {
  await withAgyFaults({ hold: "ref-rm" }, async (faults, fixture) => {
    const work = faults.run(REFERENCES);
    await faults.waitAt("ref-rm", work);
    await fixture.waitFor("close");
    assert.equal(faults.count("read", "completed"), 2);
    assert.equal(faults.count("close", "completed"), 1);
    await faults.assertAbsent(faults.artifactPath);
    assert.deepEqual((await faults.stagedFiles()).sort(), ["ref_0.png", "ref_1.png"]);
    faults.controller.abort();
    faults.release();
    await assert.rejects(work, isCanceled);
    assert.equal(fixture.spawnCount(), 1);
    assert.equal(faults.count("unlink", "completed"), 1);
    assert.equal(faults.count("rmdir", "completed"), 1);
    assert.equal(faults.count("rm", "completed"), 1);
    await faults.assertAbsent(faults.directory());
  });
});

test("Agy primary read EIO survives abort during held reference cleanup", async () => {
  await withAgyFaults({ fail: "read", hold: "ref-rm" }, async (faults, fixture) => {
    const work = faults.run(REFERENCES);
    await faults.waitAt("ref-rm", work);
    await fixture.waitFor("close");
    assert.equal(faults.count("read", "injected"), 1);
    assert.equal(faults.count("read", "completed"), 0);
    assert.equal(faults.count("close", "completed"), 1);
    assert.equal(faults.count("unlink", "entered"), 0);
    assert.equal(faults.count("rmdir", "entered"), 0);
    const unreadArtifact = await faults.readKnown(faults.artifactPath);
    faults.controller.abort();
    faults.release();
    await assert.rejects(work, (error) => error === faults.error);
    assert.equal(fixture.spawnCount(), 1);
    assert.equal(faults.count("rm", "completed"), 1);
    await faults.assertAbsent(faults.directory());
    // A failed read is not a successful artifact receipt: leave it to fixture teardown.
    assert.deepEqual(await faults.readKnown(faults.artifactPath), unreadArtifact);
  });
});

for (const hold of ["eof", "close"] as const) {
  test(`Agy abort during held ${hold} drains native close and prevents a successful result`, async () => {
    await withAgyFaults({ hold }, async (faults, fixture) => {
      const work = faults.run(REFERENCES);
      await faults.waitAt(hold, work);
      await fixture.waitFor("close");
      faults.controller.abort();
      faults.release();
      await assert.rejects(work, isCanceled);
      assert.equal(faults.count("close", "completed"), 1);
      assert.equal(faults.count("unlink", "completed"), 1);
      assert.equal(faults.count("rmdir", "completed"), 1);
      assert.equal(faults.count("rm", "completed"), 1);
      await faults.assertAbsent(faults.artifactPath);
      await faults.assertAbsent(faults.directory());
    });
  });
}

for (const hold of ["read", "ref-rm"] as const) {
  test(`Agy actual node cancellation during ${hold} returns 499 without persistence`, async () => {
    await withAgyFaults({ hold }, async (faults, fixture) => {
      const work = faults.runNode();
      await faults.waitAt(hold, work);
      const closed = await fixture.waitFor("close");
      assert.deepEqual(closed.refsExist, [true]);
      faults.controller.abort(); faults.release();
      const result = await work;
      assert.equal(result.status, 499);
      // Existing node normalization projects unlisted 4xx codes to INVALID_REQUEST.
      // Direct operation cases above still require GENERATION_CANCELED/499.
      assert.deepEqual(result.body.error, { code: "INVALID_REQUEST", message: "Generation canceled" });
      assert.equal(fixture.spawnCount(), 1);
      assert.equal(faults.count("close", "completed"), 1);
      assert.equal(faults.count("unlink", "completed"), 1);
      assert.equal(faults.count("rmdir", "completed"), 1);
      assert.equal(faults.count("rm", "completed"), 1);
      await faults.assertAbsent(faults.artifactPath);
      await faults.assertAbsent(faults.directory());
      assert.deepEqual(await readdir(fixture.ctx.config.storage.generatedDir), []);
      assert.ok(!JSON.stringify(result.body).includes(fixture.root));
    });
  });
}
