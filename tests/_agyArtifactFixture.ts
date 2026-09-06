import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { test, mock } from "node:test";
import { executionChildEnv } from "./_executionTestProcess.ts";
import { assertOwned, isolateExecution } from "./_executionRouteIsolation.ts";

export const native = { ...fs };
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
export const TINY_POLICY = Object.freeze({ maxBytes: 256, chunkBytes: 16 });
const nativeSpawn = spawn;
const nativeCloses = new WeakMap<FileHandle, () => Promise<void>>();
type Reader = typeof import("../lib/agyArtifactRead.ts");
type Receipt = Awaited<ReturnType<Reader["readAgyArtifact"]>>;
type Loader = (url: string) => Promise<Record<string, unknown>>;
type ReadCall = { buffer: Buffer; offset: number; length: number; position: number; bytesRead?: number };
export interface ArtifactHooks {
  beforeOpen?: (path: string) => Promise<void>;
  afterOpen?: (handle: FileHandle, path: string) => Promise<void>;
  stat?: (value: BigIntStats) => Promise<BigIntStats>;
  beforeRead?: (call: ReadCall) => Promise<void>;
  afterRead?: (call: ReadCall) => Promise<void>;
  beforeClose?: () => Promise<void>;
  afterClose?: () => Promise<void>;
  beforeLstat?: (path: string) => Promise<void>;
  lstat?: (path: string, value: BigIntStats) => Promise<BigIntStats>;
  afterLstat?: (path: string) => Promise<void>;
  beforeRealpath?: (path: string) => Promise<void>;
  beforeUnlink?: (path: string) => Promise<void>;
  beforeRmdir?: (path: string) => Promise<void>;
}

export function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

/** Every policy/import graph gets a fresh child; parent selectors are never discarded. */
export function artifactTest(url: string, name: string, body: (f: ArtifactFixture) => Promise<void>,
  policy: Readonly<{ maxBytes: number; chunkBytes: number }> | null = TINY_POLICY) {
  test(name, { concurrency: false }, async () => {
    if (process.env.AGY_ARTIFACT_CASE !== name) {
      const pattern = `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
      await runChild(["--test", "--test-reporter=tap", "--test-concurrency=1", `--test-name-pattern=${pattern}`, fileURLToPath(url)],
        { EXECUTION_TEST_FILE: url, AGY_ARTIFACT_CASE: name });
      return;
    }
    const f = await openArtifactFixture(policy);
    try { await body(f); } finally { await f.close(); }
  });
}

export async function runChild(args: string[], env: NodeJS.ProcessEnv = {}): Promise<string> {
  const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", ...args], {
    env: { ...executionChildEnv(), ...env }, stdio: ["ignore", "pipe", "pipe"], shell: false,
  });
  let output = "";
  let launchError: Error | undefined;
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.once("error", (error) => { launchError = error; });
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const watchdog = setTimeout(() => child.kill("SIGKILL"), 45_000);
  try {
    await closed;
    assert.equal(launchError, undefined, output);
    assert.equal(child.signalCode, null, output);
    assert.equal(child.exitCode, 0, output);
    return output;
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await closed; }
    clearTimeout(watchdog);
  }
}

export interface ArtifactFixture {
  root: string; home: string; temp: string; outside: string; roots: string[];
  hooks: ArtifactHooks; reads: ReadCall[]; handles: FileHandle[]; opened: string[];
  events: string[]; flags: number[];
  reader: Reader;
  read(path: string, signal?: AbortSignal): Promise<Receipt>;
  cleanup(receipt: Receipt): Promise<void>;
  file(root?: string, bytes?: Buffer, name?: string): Promise<string>;
  hold(): ReturnType<typeof gate>;
  closed(): void;
  close(): Promise<void>;
}

function instrumentHandle(f: ArtifactFixture, handle: FileHandle, restore: Array<() => void>) {
  f.handles.push(handle);
  const read = handle.read.bind(handle), stat = handle.stat.bind(handle), close = handle.close.bind(handle);
  nativeCloses.set(handle, close);
  const readMock = mock.method(handle, "read", async (buffer: Buffer, offset: number, length: number, position: number) => {
    const call: ReadCall = { buffer, offset, length, position }; f.reads.push(call);
    try {
      await f.hooks.beforeRead?.(call);
      const result = await read(call.buffer, call.offset, call.length, call.position);
      call.bytesRead = result.bytesRead;
      await f.hooks.afterRead?.(call);
      return result;
    } catch (error) { throw error; }
  });
  const statMock = mock.method(handle, "stat", async (options: { bigint: true }) => {
    try {
      assert.equal(options?.bigint, true, "descriptor identity must use bigint");
      const value = await stat({ bigint: true });
      return f.hooks.stat ? await f.hooks.stat(value) : value;
    } catch (error) { throw error; }
  });
  const closeMock = mock.method(handle, "close", async () => {
    try {
      f.events.push("close-start"); await f.hooks.beforeClose?.();
      await close(); f.events.push("closed"); await f.hooks.afterClose?.();
    } catch (error) { throw error; }
  });
  restore.push(() => readMock.mock.restore(), () => statMock.mock.restore(), () => closeMock.mock.restore());
}

function filesystemBoundary(root: string) {
  const violations: string[] = [];
  const deny = (operation: string): never => {
    violations.push(operation);
    throw new Error(`Agy artifact fixture denied ${operation}`);
  };
  return {
    owned(operation: string, path: string) {
      // Catch only the boundary check: intentional hook/native EIO is not a violation.
      try { assertOwned(root, path); } catch { deny(`${operation}: outside owned root`); }
    },
    deny,
    verify() { assert.deepEqual(violations, [], "AGY_ARTIFACT_FIXTURE_FS_GUARD_LEDGER"); },
  };
}

function instrumentFs(f: ArtifactFixture, restore: Array<() => void>) {
  const boundary = filesystemBoundary(f.root);
  const open = mock.method(fs, "open", async (path: string, flags: number) => {
    try {
      boundary.owned("open", path); await f.hooks.beforeOpen?.(path);
      const handle = await native.open(path, flags); f.opened.push(path); f.flags.push(flags);
      instrumentHandle(f, handle, restore); await f.hooks.afterOpen?.(handle, path); return handle;
    } catch (error) { throw error; }
  });
  const lstat = mock.method(fs, "lstat", async (path: string, options: { bigint: true }) => {
    try {
      boundary.owned("lstat", path); await f.hooks.beforeLstat?.(path);
      const result = await native.lstat(path, options); await f.hooks.afterLstat?.(path);
      return f.hooks.lstat ? await f.hooks.lstat(path, result) : result;
    } catch (error) { throw error; }
  });
  const realpath = mock.method(fs, "realpath", async (path: string) => {
    try { boundary.owned("realpath", path); await f.hooks.beforeRealpath?.(path); return await native.realpath(path); }
    catch (error) { throw error; }
  });
  const unlink = mock.method(fs, "unlink", async (path: string) => {
    try { boundary.owned("unlink", path); f.events.push("unlink"); await f.hooks.beforeUnlink?.(path); await native.unlink(path); }
    catch (error) { throw error; }
  });
  const rmdir = mock.method(fs, "rmdir", async (path: string, options?: unknown) => {
    try {
      boundary.owned("rmdir", path);
      if (options !== undefined) boundary.deny("rmdir: cleanup must be nonrecursive");
      f.events.push("rmdir"); await f.hooks.beforeRmdir?.(path); await native.rmdir(path);
    } catch (error) { throw error; }
  });
  const readFile = mock.method(fs, "readFile", () => boundary.deny("readFile: forbidden"));
  const rm = mock.method(fs, "rm", () => boundary.deny("rm: forbidden"));
  for (const method of [open, lstat, realpath, unlink, rmdir, readFile, rm]) restore.push(() => method.mock.restore());
  syncBuiltinESMExports();
  return boundary.verify;
}

async function loadArtifactReader(policy: Readonly<{ maxBytes: number; chunkBytes: number }> | null,
  graph: "source" | "emitted", load: Loader, install: typeof mock.module, restore: Array<() => void>) {
  try {
    const extension = graph === "source" ? "ts" : "js";
    if (policy) {
      const config = install(new URL(`../config.${extension}`, import.meta.url).href, { namedExports: {
        AGY_ARTIFACT_POLICY: Object.freeze({ ...policy }),
        AGY_PROCESS_POLICY: Object.freeze({ timeoutMs: 360_000, terminateGraceMs: 1000, maxOutputBytes: 1_048_576 }),
      } });
      restore.push(() => config.restore());
    }
    const reader = await load(new URL(`../lib/agyArtifactRead.${extension}`, import.meta.url).href) as Reader;
    assert.deepEqual(Object.keys(reader).sort(), ["cleanupAgyArtifact", "readAgyArtifact"]); return reader;
  } catch (error) { throw error; }
}

export async function openArtifactFixture(policy: Readonly<{ maxBytes: number; chunkBytes: number }> | null = TINY_POLICY,
  graph: "source" | "emitted" = "source", load: Loader = (url) => import(url),
  install: typeof mock.module = (url, options) => mock.module(url, options)): Promise<ArtifactFixture> {
  const isolation = await isolateExecution();
  const root = await native.realpath(isolation.rootDir);
  const home = join(root, "home"), temp = join(root, "temp"), outside = join(root, "outside");
  const roots = [join(home, ".gemini"), join(home, ".cache"), temp];
  const restore: Array<() => void> = [], pending = new Set<Promise<unknown>>();
  const releases: Array<() => void> = [], controllers: AbortController[] = [];
  try {
    for (const dir of [...roots, outside]) await native.mkdir(dir, { recursive: true });
    const homeMock = mock.method(os, "homedir", () => home), tempMock = mock.method(os, "tmpdir", () => temp);
    restore.push(() => homeMock.mock.restore(), () => tempMock.mock.restore()); syncBuiltinESMExports();
    const reader = await loadArtifactReader(policy, graph, load, install, restore);
    const track = <T>(work: Promise<T>): Promise<T> => {
      pending.add(work); void work.then(() => pending.delete(work), () => pending.delete(work)); return work;
    };
    const f: ArtifactFixture = { root, home, temp, outside, roots, reader,
      hooks: {}, reads: [], handles: [], opened: [], events: [], flags: [],
      read(path, signal) {
        const controller = new AbortController(); controllers.push(controller);
        return track(reader.readAgyArtifact(path, signal ? AbortSignal.any([signal, controller.signal]) : controller.signal));
      },
      cleanup: (receipt) => track(reader.cleanupAgyArtifact(receipt)),
      async file(dir = roots[0], bytes = PNG, name = "ima2_generated_owned.png") {
        try { assertOwned(root, dir); await native.mkdir(dir, { recursive: true });
          const path = join(dir, name); await native.writeFile(path, bytes); return path;
        } catch (error) { throw error; }
      },
      hold() { const held = gate(); releases.push(held.release); return held; },
      closed() { for (const handle of f.handles) assert.equal(handle.fd, -1, "native descriptor leaked"); },
      async close() {
        for (const controller of controllers) controller.abort();
        for (const release of releases) release();
        await Promise.allSettled([...pending]);
        // No hook, module, transport, or directory restoration under live I/O.
        const leaked = f.handles.filter((handle) => handle.fd !== -1);
        for (const handle of leaked) await nativeCloses.get(handle)!();
        for (const undo of restore.reverse()) undo(); syncBuiltinESMExports();
        await isolation.close(); verifyFs();
        assert.equal(leaked.length, 0, "reader left a native descriptor open");
      },
    };
    const verifyFs = instrumentFs(f, restore); return f;
  } catch (error) {
    for (const undo of restore.reverse()) undo(); syncBuiltinESMExports();
    await isolation.close(); throw error;
  }
}

export async function rejected(f: ArtifactFixture, path: string, code = "AGY_PATH_REJECTED", status = 502) {
  await assert.rejects(f.read(path), (error: Error & { code: string; status: number }) => {
    assert.equal(error.code, code); assert.equal(error.status, status);
    assert.ok(!error.message.includes(f.root), "safe rejection leaked path");
    assert.ok(!error.message.includes(PNG.toString("base64")), "safe rejection leaked bytes");
    return true;
  });
  f.closed();
}

export async function preserved(path: string, bytes = PNG) { assert.deepEqual(await native.readFile(path), bytes); }
export async function missing(path: string) { await assert.rejects(native.lstat(path), { code: "ENOENT" }); }

/** Only this fixed native utility and one owned path bypass the provider-spawn deny guard. */
export async function ownedFifo(f: Pick<ArtifactFixture, "root" | "roots">): Promise<string> {
  assert.notEqual(process.platform, "win32", "Windows has no POSIX FIFO filesystem entry");
  const path = join(f.roots[0], "ima2_generated_fifo.png"); assertOwned(f.root, path);
  const child = nativeSpawn("/usr/bin/mkfifo", [path], { env: {}, stdio: "ignore", shell: false });
  let error: Error | undefined;
  child.once("error", (value) => { error = value; });
  const closed = new Promise<void>((resolve) => child.once("close", () => resolve()));
  const watchdog = setTimeout(() => child.kill("SIGKILL"), 3000);
  try {
    await closed; assert.equal(error, undefined); assert.equal(child.signalCode, null); assert.equal(child.exitCode, 0);
    assert.equal((await native.lstat(path)).isFIFO(), true); return path;
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await closed; }
    clearTimeout(watchdog);
  }
}

/** Plain-JS caller supplies BOTH import and native module-mock resolution. */
export async function emittedTinyProbe(load: Loader, install: typeof mock.module) {
  const f = await openArtifactFixture({ maxBytes: 8, chunkBytes: 3 }, "emitted", load, install);
  try {
    const bytes = Buffer.from("abcdefgh"), path = await f.file(undefined, bytes);
    const receipt = await f.read(path); assert.deepEqual(receipt.buffer, bytes); f.closed();
    assert.ok(f.reads.length >= 3); assert.ok(f.reads.every((read) => read.length <= 3));
    await f.cleanup(receipt); await missing(path);
    const large = await f.file(undefined, Buffer.from("abcdefghi"));
    await rejected(f, large, "AGY_ARTIFACT_TOO_LARGE"); await preserved(large, Buffer.from("abcdefghi"));
    console.log("emitted config.js tiny cap, exact bytes, native close and guarded cleanup executed");
  } finally { await f.close(); }
}
