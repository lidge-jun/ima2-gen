import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { mock } from "node:test";
import { openAgyProcessFixture } from "./_agyProcessFixture.ts";

type NativeFixture = Awaited<ReturnType<typeof openAgyProcessFixture>>;
type IoMethod = "mkdir" | "writeFile" | "readFile" | "rm";
type HoldPoint = "read" | "ref-rm";
export interface AgyFaultPlan {
  fail?: "mkdir" | "second-ref" | "read";
  hold?: HoldPoint;
}
interface IoReceipt {
  method: IoMethod;
  path: string;
  state: "entered" | "completed" | "injected";
}

const BARRIER_DEADLINE_MS = 5_000;

function ownedBarrier() {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const released = new Promise<void>((resolve) => { release = resolve; });
  return { entered, released, enter, release };
}

/** Only native filesystem seams are hooked; the actual Agy operation stays intact. */
export class AgyFaults {
  readonly artifactPath: string;
  readonly error = Object.assign(new Error("owned Agy filesystem EIO"), { code: "EIO" });
  readonly receipts: IoReceipt[] = [];
  readonly stageDirectories = new Set<string>();
  readonly controller = new AbortController();
  private readonly barrier = ownedBarrier();
  private readonly pending: Promise<unknown>[] = [];
  private readonly restores: Array<() => void> = [];
  private activeIo = 0;
  private readBytes: Buffer | undefined;
  private readonly originals = {
    mkdir: fs.mkdir, writeFile: fs.writeFile, readFile: fs.readFile, rm: fs.rm,
    readdir: fs.readdir, stat: fs.stat,
  };

  constructor(readonly fixture: NativeFixture, readonly plan: AgyFaultPlan) {
    this.artifactPath = join(fixture.root, ".gemini", "antigravity-cli", "brain",
      "artifact", "ima2_generated.png");
  }

  install(): void {
    try {
      for (const method of ["mkdir", "writeFile", "readFile", "rm"] as const) {
        const owner = this;
        const original = this.originals[method];
        const hooked = mock.method(fs, method, async function (this: unknown, ...args: unknown[]) {
          try {
            return await owner.intercept(method, args, () => Reflect.apply(original, this, args));
          } catch (error) { throw error; }
        });
        this.restores.push(() => hooked.mock.restore());
      }
      syncBuiltinESMExports();
    } catch (error) { this.restore(); throw error; }
  }

  private target(method: IoMethod, argument: unknown): string | undefined {
    // Non-string paths/URLs/FileHandles are forwarded untouched, never String-coerced.
    if (typeof argument !== "string") return undefined;
    if (method === "mkdir" && dirname(argument) === this.fixture.root
      && /^ima2-agy-refs-[a-f0-9]{12}$/.test(basename(argument))) {
      this.stageDirectories.add(argument);
      return argument;
    }
    if (method === "writeFile" && this.stageDirectories.has(dirname(argument))
      && /^ref_[0-2]\.(png|jpg|webp)$/.test(basename(argument))) return argument;
    if (method === "rm" && this.stageDirectories.has(argument)) return argument;
    if ((method === "readFile" || method === "rm") && argument === this.artifactPath) return argument;
    return undefined;
  }

  private injects(method: IoMethod, path: string): boolean {
    return (this.plan.fail === "mkdir" && method === "mkdir")
      || (this.plan.fail === "second-ref" && method === "writeFile" && basename(path) === "ref_1.png")
      || (this.plan.fail === "read" && method === "readFile");
  }

  private holds(method: IoMethod, path: string): boolean {
    return (this.plan.hold === "read" && method === "readFile" && path === this.artifactPath)
      || (this.plan.hold === "ref-rm" && method === "rm" && this.stageDirectories.has(path));
  }

  private async intercept(method: IoMethod, args: unknown[], forward: () => Promise<unknown>) {
    const path = this.target(method, args[0]);
    if (!path) return forward();
    this.activeIo += 1;
    try {
      this.receipts.push({ method, path, state: "entered" });
      if (this.holds(method, path)) {
        this.barrier.enter();
        await this.barrier.released;
      }
      if (this.injects(method, path)) {
        this.receipts.push({ method, path, state: "injected" });
        throw this.error;
      }
      const result = await forward();
      if (method === "readFile" && Buffer.isBuffer(result)) this.readBytes = result;
      this.receipts.push({ method, path, state: "completed" });
      return result;
    } catch (error) { throw error; }
    finally { this.activeIo -= 1; }
  }

  run(references: Array<{ b64: string; declaredMime: string }>) {
    const work = this.fixture.track(this.fixture.generate("cleanup fixture prompt", {
      references, signal: this.controller.signal, requestId: "wp06-cleanup",
    }));
    this.pending.push(work);
    // Register a rejection observer immediately; assertions still await the original promise.
    void work.catch(() => {});
    return work;
  }

  async waitAt(point: HoldPoint, work: Promise<unknown>): Promise<void> {
    assert.equal(this.plan.hold, point);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Owned ${point} barrier was not reached`)), BARRIER_DEADLINE_MS);
      });
      await Promise.race([this.barrier.entered, deadline, work.then(
        () => { throw new Error(`Agy fulfilled before owned ${point} barrier`); },
        (error) => { throw new Error(`Agy rejected before owned ${point} barrier`, { cause: error }); },
      )]);
    } catch (error) { throw error; }
    finally { if (timer) clearTimeout(timer); }
  }

  release(): void { this.barrier.release(); }

  count(method: IoMethod, state: IoReceipt["state"]): number {
    return this.receipts.filter((entry) => entry.method === method && entry.state === state).length;
  }

  directory(): string {
    assert.equal(this.stageDirectories.size, 1, "exactly one owned staging directory was registered");
    return [...this.stageDirectories][0]!;
  }

  async stagedFiles(): Promise<string[]> {
    try { return await this.originals.readdir(this.directory()); }
    catch (error) { throw error; }
  }

  async assertAbsent(path: string): Promise<void> {
    this.assertKnown(path);
    try { await assert.rejects(this.originals.stat(path), { code: "ENOENT" }); }
    catch (error) { throw error; }
  }

  async readKnown(path: string): Promise<Buffer> {
    this.assertKnown(path);
    try { return await this.originals.readFile(path); }
    catch (error) { throw error; }
  }

  private assertKnown(path: string): void {
    assert.ok(path === this.artifactPath || this.stageDirectories.has(path)
      || (this.stageDirectories.has(dirname(path)) && /^ref_[0-2]\.png$/.test(basename(path))),
    `Not an enrolled fault-fixture path: ${path}`);
    assert.ok(resolve(path).startsWith(`${resolve(this.fixture.root)}/`)
      || resolve(path).startsWith(`${resolve(this.fixture.root)}\\`));
  }

  successfulRead(): Buffer {
    assert.ok(this.readBytes, "the real filesystem read completed through the hook");
    return this.readBytes;
  }

  async drain(): Promise<void> {
    this.controller.abort();
    this.release();
    try {
      await Promise.allSettled(this.pending);
      assert.equal(this.activeIo, 0, "owned filesystem hooks cannot restore with active I/O");
    } catch (error) { throw error; }
  }

  restore(): void {
    for (const restore of this.restores.splice(0).reverse()) restore();
    syncBuiltinESMExports();
  }
}

export async function withAgyFaults(
  plan: AgyFaultPlan,
  run: (faults: AgyFaults, fixture: NativeFixture) => Promise<void>,
): Promise<void> {
  const fixture = await openAgyProcessFixture();
  const faults = new AgyFaults(fixture, plan);
  try {
    await fixture.configure("success");
    faults.install();
    await run(faults, fixture);
  } catch (error) { throw error; }
  finally {
    // Release/abort/allSettled must finish before hooks or native guards are restored.
    await faults.drain();
    faults.restore();
    await fixture.close();
  }
}
