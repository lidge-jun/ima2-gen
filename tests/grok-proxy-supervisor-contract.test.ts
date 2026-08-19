import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startGrokProxy } from "../lib/grokProxyLauncher.ts";

const loginMessage = "Not logged in. Run `progrok login` first.";

/** progrok's real contract: print the auth message and exit 1 immediately. */
async function makeAuthFailingProgrok(dir: string): Promise<string> {
  const bin = join(dir, process.platform === "win32" ? "progrok.cmd" : "progrok");
  if (process.platform === "win32") {
    await writeFile(bin, `@echo off\r\necho ${loginMessage} 1>&2\r\nexit /b 1\r\n`);
  } else {
    await writeFile(bin, `#!/bin/sh\nprintf '${loginMessage}\\n' >&2\nexit 1\n`);
    await chmod(bin, 0o755);
  }
  return bin;
}

const settle = (ms = 700) => new Promise((r) => setTimeout(r, ms));

test("login re-arms a proxy that gave up on missing credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-grok-supervisor-"));
  const bin = await makeAuthFailingProgrok(dir);
  let spawns = 0;
  const handle = await startGrokProxy({
    port: 0,
    progrokBinPath: bin,
    restartDelayMs: 20,
    onPortSelected: () => { spawns += 1; },
  });
  try {
    await settle();
    assert.equal(handle.state, "waiting-for-login", "auth failure parks in waiting-for-login");
    assert.equal(spawns, 1);

    // The whole point of the fix: a login makes the give-up recoverable.
    handle.notifyCredentialsChanged();
    await settle();
    assert.equal(spawns, 2, "login must trigger exactly one re-spawn");
  } finally {
    handle.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("waiting-for-login is not spawnable without a credential event", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-grok-supervisor-"));
  const bin = await makeAuthFailingProgrok(dir);
  let spawns = 0;
  const handle = await startGrokProxy({
    port: 0,
    progrokBinPath: bin,
    restartDelayMs: 20,
    onPortSelected: () => { spawns += 1; },
  });
  try {
    await settle();
    assert.equal(handle.state, "waiting-for-login");
    const baseline = spawns;

    // The status route polls every 10s. If ensure() spawned here, a logged-out
    // user would get one child per poll, forever.
    for (let i = 0; i < 5; i += 1) await handle.ensure();
    await settle(300);
    assert.equal(spawns, baseline, "ensure() must be a no-op while waiting for login");
  } finally {
    handle.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("ensure() after stop() never spawns a zombie child", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-grok-supervisor-"));
  const bin = await makeAuthFailingProgrok(dir);
  let spawns = 0;
  const handle = await startGrokProxy({
    port: 0,
    progrokBinPath: bin,
    restartDelayMs: 20,
    onPortSelected: () => { spawns += 1; },
  });
  await settle();
  handle.stop();
  const afterStop = spawns;
  try {
    handle.notifyCredentialsChanged();
    await handle.ensure();
    await settle(300);
    assert.equal(spawns, afterStop, "shutdown must win over every revival path");
    assert.equal(handle.state, "stopped");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a stale probe token cannot resurrect a dead proxy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-grok-supervisor-"));
  const bin = await makeAuthFailingProgrok(dir);
  const handle = await startGrokProxy({ port: 0, progrokBinPath: bin, restartDelayMs: 20 });
  try {
    const token = handle.probeToken();
    await settle();
    assert.equal(handle.state, "waiting-for-login");

    // A /v1/models response that outlived its child must not report ready.
    const promoted = handle.markProbedReady(token, "http://127.0.0.1:18699");
    assert.equal(promoted, false);
    assert.equal(handle.state, "waiting-for-login");
  } finally {
    handle.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("credential events during an in-flight spawn are not lost", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ima2-grok-supervisor-"));
  const bin = await makeAuthFailingProgrok(dir);
  let spawns = 0;
  const handle = await startGrokProxy({
    port: 0,
    progrokBinPath: bin,
    restartDelayMs: 20,
    onPortSelected: () => { spawns += 1; },
  });
  try {
    await settle();
    const baseline = spawns;
    handle.notifyCredentialsChanged();
    // Second login while the replacement is still starting: must not stack children.
    handle.notifyCredentialsChanged();
    await settle();
    assert.ok(spawns - baseline <= 2, `bounded re-spawn, got ${spawns - baseline}`);
    assert.ok(spawns > baseline, "at least one replacement must start");
  } finally {
    handle.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

