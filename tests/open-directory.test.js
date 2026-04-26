import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openDirectory } from "../lib/openDirectory.js";

function fakeChild() {
  const child = new EventEmitter();
  child.unref = () => {};
  return child;
}

test("openDirectory chooses platform-specific commands", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-open-"));
  const calls = [];
  const spawnImpl = (command, args) => {
    calls.push({ command, args });
    const child = fakeChild();
    queueMicrotask(() => child.emit("exit", 0));
    return child;
  };

  try {
    assert.deepEqual(await openDirectory(dir, { platform: "darwin", spawnImpl, settleMs: 10 }), { ok: true });
    assert.deepEqual(await openDirectory(dir, { platform: "win32", spawnImpl, settleMs: 10 }), { ok: true });
    assert.deepEqual(await openDirectory(dir, { platform: "linux", spawnImpl, settleMs: 10 }), { ok: true });
    assert.deepEqual(calls.map((call) => call.command), ["open", "explorer", "xdg-open"]);
    assert.ok(calls.every((call) => call.args[0] === dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("openDirectory reports spawn errors and early nonzero exits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-open-"));
  try {
    const spawnError = await openDirectory(dir, {
      platform: "linux",
      settleMs: 10,
      spawnImpl: () => {
        const child = fakeChild();
        queueMicrotask(() => child.emit("error", new Error("missing xdg-open")));
        return child;
      },
    });
    assert.equal(spawnError.ok, false);
    assert.match(spawnError.error, /missing xdg-open/);

    const exitError = await openDirectory(dir, {
      platform: "linux",
      settleMs: 10,
      spawnImpl: () => {
        const child = fakeChild();
        queueMicrotask(() => child.emit("exit", 3));
        return child;
      },
    });
    assert.equal(exitError.ok, false);
    assert.match(exitError.error, /xdg-open exited with code 3/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
