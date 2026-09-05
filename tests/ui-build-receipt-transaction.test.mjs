import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { beginUiBuild, finishUiBuild, abortUiBuild, verifyUiBuildReceipt } from "../scripts/lib/uiBuildReceipt.mjs";
import { receiptFixture } from "./_uiBuildReceiptFixture.mjs";

const verify = (f) => verifyUiBuildReceipt({ repoRoot: f.root, distDir: f.dist, requireGitHead: false });

test("same-process transaction publishes complete outputs and consumers wait for lock release", async () => {
  const f = await receiptFixture(); let tx;
  try {
    tx = await beginUiBuild(f.root);
    await assert.rejects(verify(f), { code: "UI_RECEIPT_BUSY" });
    await assert.rejects(beginUiBuild(f.root), { code: "UI_RECEIPT_BUSY" });
    const result = await finishUiBuild(f.root, tx);
    assert.equal(result.outputs.length, 4);
    await assert.rejects(finishUiBuild(f.root, tx), { code: "UI_RECEIPT_TRANSACTION" });
    await abortUiBuild(f.root, tx);
    assert.equal((await verify(f)).binding, "source-digest");
    await abortUiBuild(f.root, tx);
    const next = await beginUiBuild(f.root);
    await abortUiBuild(f.root, tx);
    await assert.rejects(verify(f), { code: "UI_RECEIPT_BUSY" });
    await abortUiBuild(f.root, next);
  } finally { if (tx) await abortUiBuild(f.root, tx); await f.close(); }
});

test("copied transactions and wrong nonce cannot borrow or delete a held build", async () => {
  const f = await receiptFixture(); let tx;
  try {
    tx = await beginUiBuild(f.root);
    await assert.rejects(finishUiBuild(f.root, { ...tx }), { code: "UI_RECEIPT_TRANSACTION" });
    await assert.rejects(abortUiBuild(f.root, { ...tx }), { code: "UI_RECEIPT_TRANSACTION" });
    const path = join(f.root, "ui/node_modules/.cache/ima2-ui-build/active/input.json");
    const original = await readFile(path, "utf8");
    await writeFile(path, JSON.stringify({ ...JSON.parse(original), nonce: "foreign" }));
    await assert.rejects(finishUiBuild(f.root, tx), { code: "UI_RECEIPT_TRANSACTION" });
    await assert.rejects(abortUiBuild(f.root, tx), { code: "UI_RECEIPT_CLEANUP" });
    await writeFile(path, original);
    await abortUiBuild(f.root, tx);
  } finally { if (tx) await abortUiBuild(f.root, tx); await f.close(); }
});

test("source edits invalidate a build and do not leave an admissible receipt", async () => {
  const f = await receiptFixture(); let tx;
  try {
    tx = await beginUiBuild(f.root);
    await f.put("ui/src/entry.ts", "changed source");
    await assert.rejects(finishUiBuild(f.root, tx), { code: "UI_RECEIPT_BUILD_CHANGED" });
    await abortUiBuild(f.root, tx);
    await assert.rejects(verify(f), { code: "UI_RECEIPT_MISSING" });
  } finally { if (tx) await abortUiBuild(f.root, tx); await f.close(); }
});

test("actual watcher callback observes edit/revert before finish without sleeping", { timeout: 10000 }, async (t) => {
  const f = await receiptFixture(); let tx, notify;
  const seen = new Promise((resolve) => { notify = resolve; });
  const originalWatch = fs.watch;
  t.mock.method(fs, "watch", function (path, options, callback) {
    return originalWatch(path, options, (event, filename) => {
      callback(event, filename);
      if (String(filename).endsWith("entry.ts")) notify();
    });
  });
  syncBuiltinESMExports();
  try {
    tx = await beginUiBuild(f.root);
    const path = join(f.root, "ui/src/entry.ts"), original = await readFile(path);
    await writeFile(path, "temporary edit"); await seen; await writeFile(path, original);
    await assert.rejects(finishUiBuild(f.root, tx), { code: "UI_RECEIPT_BUILD_CHANGED" });
  } finally {
    if (tx) await abortUiBuild(f.root, tx);
    t.mock.restoreAll(); syncBuiltinESMExports(); await f.close();
  }
});

test("same-size public asset tamper and added outputs reject an otherwise valid receipt", async () => {
  const f = await receiptFixture(); let tx;
  try {
    tx = await beginUiBuild(f.root); await finishUiBuild(f.root, tx); await abortUiBuild(f.root, tx);
    await f.put("ui/dist/fonts/fixture.woff2", "FONTBYTES");
    await assert.rejects(verify(f), { code: "UI_RECEIPT_OUTPUT" });
    await f.put("ui/dist/fonts/fixture.woff2", "fontbytes");
    await f.put("ui/dist/new.bin", "unlisted");
    await assert.rejects(verify(f), { code: "UI_RECEIPT_OUTPUT" });
    await unlink(join(f.dist, "new.bin"));
    assert.equal((await verify(f)).binding, "source-digest");
  } finally { if (tx) await abortUiBuild(f.root, tx); await f.close(); }
});

test("abandoned lock refuses reuse and never invalidates another owner's receipt", async () => {
  const f = await receiptFixture();
  try {
    await mkdir(join(f.root, "ui/node_modules/.cache/ima2-ui-build/active"), { recursive: true });
    await f.put("ui/dist/.ima2-ui-build-receipt.json", "prior owned marker");
    await assert.rejects(beginUiBuild(f.root), { code: "UI_RECEIPT_BUSY" });
    assert.equal(await readFile(join(f.dist, ".ima2-ui-build-receipt.json"), "utf8"), "prior owned marker");
  } finally { await f.close(); }
});
