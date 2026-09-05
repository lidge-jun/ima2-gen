import assert from "node:assert/strict";
import childProcess, { type SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { getEventListeners } from "node:events";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import test, { type TestContext } from "node:test";
import type { ImageExecutionRequest, ExecutionSurface } from "../lib/providers/execution/types.ts";
import { openAgyProcessFixture, type AgyProcessFixture } from "./_agyProcessFixture.ts";
import { AgyFaults } from "./_agyFaultFixtures.ts";

// Independently constructed 1x1 RGBA red/green/blue PNGs; never derived from DUT output.
const P = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==";
const A = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==";
const B = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg==";
const OUTPUT = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const TINY_POLICY = Object.freeze({ maxBytes: 80, chunkBytes: 16 });
const refs = (...images: string[]) => images.map((b64) => ({ b64, declaredMime: "image/png", detectedMime: "image/png" }));
const hash = (b64: string) => createHash("sha256").update(Buffer.from(b64, "base64")).digest("hex");

function request(surface: ExecutionSurface): ImageExecutionRequest {
  const base = { provider: "agy" as const, requestId: "native-fixture-request",
    signal: new AbortController().signal, prompt: "effective native prompt", rawPrompt: "raw native prompt",
    references: refs(A, B), options: { model: "ignored-model", quality: "high", size: "2048x1536",
      moderation: "low", mode: "direct" as const, reasoningEffort: undefined, webSearchEnabled: false } };
  switch (surface) {
    case "classic": return { ...base, surface, providerUrl: null, background: null,
      backgroundConstraint: undefined, nai: {}, comfy: {} };
    case "node": return { ...base, surface, sourceImage: P, contextMode: "parent-plus-refs",
      searchMode: "off", partialImages: 0, nai: {} };
    case "edit": return { ...base, surface, sourceImage: P, mask: null };
    case "multimode": return { ...base, surface, maxImages: 3, providerUrl: null, nai: {} };
  }
}

function nativeResult(prompt: string) {
  return { b64: OUTPUT, revisedPrompt: prompt, usage: { agy_artifact_bytes: Buffer.from(OUTPUT, "base64").length },
    webSearchCalls: 0, mime: "image/png" };
}

function code(expected: string, status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(Reflect.get(error, "code"), expected, error.stack);
    assert.equal(Reflect.get(error, "status"), status);
    return true;
  };
}

async function assertInput(fixture: AgyProcessFixture, images: string[], prompt: string): Promise<void> {
  try {
    const input = await fixture.waitFor("input");
    assert.deepEqual(input.hashes, images.map(hash));
    assert.equal(input.prompt, prompt);
    assert.match(String(input.fullPrompt), /The output resolution is fixed at 1024x1024\./);
    const closed = await fixture.waitFor("close");
    assert.deepEqual(closed.refsExist, images.map(() => true), "refs exist at native close before operation cleanup");
    for (const path of input.paths as string[]) assert.equal(existsSync(path), false, "operation removed staged reference");
  } catch (error) { throw error; }
}

async function familyCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    for (const surface of ["classic", "node", "edit", "multimode"] as const) {
      await t.test(`real Google family Agy ${surface}: one native call and native projection`, async () => {
        await fixture.configure("success");
        const before = fixture.spawnCount();
        const callbacks: string[] = [];
        const prepared = await fixture.prepare(fixture.ctx, request(surface), {
          onPartialImage: () => callbacks.push("partial"), onQueue: () => callbacks.push("queue"),
          onFinalImage: () => { callbacks.push("final"); },
        });
        assert.equal(fixture.spawnCount(), before, "prepare is inert");
        const result = await prepared.execute();
        const prompt = `${surface === "node" || surface === "edit" ? "Edit this image: " : ""}effective native prompt`;
        const expected = nativeResult(prompt);
        if (surface === "multimode") assert.deepEqual(result, { kind: "sequence", value: {
          images: [{ b64: OUTPUT, revisedPrompt: prompt }], usage: expected.usage, webSearchCalls: 0 } });
        else assert.deepEqual(result, { kind: "single", value: expected });
        assert.equal(fixture.spawnCount(), before + 1);
        assert.deepEqual(callbacks, []);
        await assertInput(fixture, surface === "node" ? [P, A, B] : surface === "edit" ? [P] : [A, B], prompt);
      });
    }
  } catch (error) { throw error; }
}

async function contextCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    for (const parent of [false, true]) for (const contextMode of ["parent-only", "parent-plus-refs"] as const) {
      await t.test(`Agy node ${parent ? "child" : "root"} ${contextMode}: exact byte order`, async () => {
        await fixture.configure("success");
        const input = request("node");
        assert.equal(input.surface, "node");
        if (input.surface !== "node") throw new Error("Invalid test request");
        input.sourceImage = parent ? P : null;
        input.contextMode = contextMode;
        const count = fixture.spawnCount();
        const result = await (await fixture.prepare(fixture.ctx, input)).execute();
        assert.equal(result.kind, "single");
        assert.equal(fixture.spawnCount(), count + 1);
        await assertInput(fixture, [...(parent ? [P] : []), ...(contextMode === "parent-only" ? [] : [A, B])],
          `${parent ? "Edit this image: " : ""}effective native prompt`);
      });
    }
  } catch (error) { throw error; }
}

async function captureCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    await t.test("classic captures prompt but reads references and signal at execution", async () => {
      await fixture.configure("success");
      const input = request("classic");
      const prepared = await fixture.prepare(fixture.ctx, input);
      input.prompt = "late prompt must not win";
      input.references = refs(B);
      input.signal = new AbortController().signal;
      const result = await prepared.execute();
      assert.deepEqual(result, { kind: "single", value: nativeResult("effective native prompt") });
      await assertInput(fixture, [B], "effective native prompt");
      const count = fixture.spawnCount();
      input.signal = AbortSignal.abort("foreign cancellation reason");
      await assert.rejects(prepared.execute(), code("GENERATION_CANCELED", 499));
      assert.equal(fixture.spawnCount(), count);
    });
    for (const surface of ["node", "edit", "multimode"] as const) {
      await t.test(`${surface} reads effective prompt at execution`, async () => {
        await fixture.configure("success");
        const input = request(surface);
        const prepared = await fixture.prepare(fixture.ctx, input);
        input.prompt = "late effective native prompt";
        await prepared.execute();
        assert.equal((await fixture.waitFor("input")).prompt,
          `${surface === "multimode" ? "" : "Edit this image: "}late effective native prompt`);
      });
    }
  } catch (error) { throw error; }
}

async function outputCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    for (const scenario of ["success", "stderr-result", "saved-path", "unparseable-with-recent-artifact"]) {
      await t.test(`native protocol ${scenario}: original result semantics`, async () => {
        await fixture.configure(scenario);
        assert.deepEqual(await fixture.generate("direct prompt"), nativeResult("direct prompt"));
        const input = await fixture.waitFor("input");
        assert.equal(existsSync(String(input.artifactPath)), false);
        assert.equal((await fixture.waitFor("close")).code, 0);
      });
    }
    const failures = [
      ["malformed-result", "AGY_MALFORMED_RESULT", 502], ["no-artifact", "AGY_ARTIFACT_NOT_FOUND", 502],
      ["unparseable", "AGY_PARSE_FAILED", 502], ["error", "AGY_GENERATION_FAILED", 502],
      ["quota", "AGY_QUOTA_EXHAUSTED", 429], ["raw-quota", "AGY_QUOTA_EXHAUSTED", 429],
      ["outside-path", "AGY_PATH_REJECTED", 502], ["nonzero", "AGY_PROCESS_ERROR", 502],
    ] as const;
    for (const [scenario, expected, status] of failures) {
      await t.test(`native ${scenario} preserves ${expected}/${status}`, async () => {
        await fixture.configure(scenario);
        await assert.rejects(fixture.generate("error prompt", { references: refs(A) }), code(expected, status));
        await assertInput(fixture, [A], "error prompt");
        if (["malformed-result", "error", "quota"].includes(scenario)) {
          assert.ok(existsSync(String((await fixture.waitFor("input")).artifactPath)), "non-parse errors must not use recent fallback");
        }
      });
    }
  } catch (error) { throw error; }
}

async function preAbort(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    await t.test("pre-aborted direct and family operations never stage or spawn", async () => {
      await fixture.configure("success");
      const count = fixture.spawnCount();
      const signal = AbortSignal.abort("not an Agy error");
      await assert.rejects(fixture.generate("pre-abort", { references: refs(P), signal }), code("GENERATION_CANCELED", 499));
      const input = request("classic"); input.signal = signal;
      await assert.rejects((await fixture.prepare(fixture.ctx, input)).execute(), code("GENERATION_CANCELED", 499));
      assert.equal(fixture.spawnCount(), count);
      assert.deepEqual((await readdir(fixture.root)).filter((name) => name.startsWith("ima2-agy-refs-")), []);
    });
  } catch (error) { throw error; }
}

async function termination(t: TestContext, fixture: AgyProcessFixture, stubborn: boolean): Promise<void> {
  try {
    await t.test(`native ${stubborn ? "TERM-ignoring" : "cooperative"} cancellation observes close before rejection`, async (testCase) => {
      await fixture.configure(stubborn ? "term-ignored-wait" : "cooperative-wait");
      testCase.mock.timers.enable({ apis: ["setTimeout"] });
      const controller = new AbortController();
      let rejectionCount = 0;
      const work = fixture.generate("cancel prompt", { references: refs(P, A), signal: controller.signal });
      const rejected = assert.rejects(work, (error) => {
        rejectionCount++;
        assert.ok(fixture.observations().some((entry) => entry.event === "close"), "native close precedes rejection");
        return code("GENERATION_CANCELED", 499)(error);
      });
      try {
        await fixture.waitFor("ready"); controller.abort("foreign reason");
        await fixture.waitFor("term");
        if (stubborn) {
          assert.equal(rejectionCount, 0);
          assert.equal(fixture.observations().some((entry) => entry.event === "close"), false);
          testCase.mock.timers.tick(1000);
        }
        await rejected;
        await assertInput(fixture, [P, A], "cancel prompt");
        assert.deepEqual(fixture.observations().filter((entry) => entry.event === "kill").map((entry) => entry.signal),
          stubborn ? ["SIGTERM", "SIGKILL"] : ["SIGTERM"]);
        assert.equal(rejectionCount, 1);
        testCase.mock.timers.tick(360_000);
        assert.equal(rejectionCount, 1);
      } finally { controller.abort(); testCase.mock.timers.reset(); await Promise.allSettled([work, rejected]); }
    });
  } catch (error) { throw error; }
}

async function timeoutCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    await t.test("timeout wins first reason over later external abort and waits native KILL/close", async (testCase) => {
      await fixture.configure("term-ignored-wait");
      testCase.mock.timers.enable({ apis: ["setTimeout"] });
      const controller = new AbortController();
      const work = fixture.generate("timeout prompt", { signal: controller.signal, references: refs(B) });
      const rejected = assert.rejects(work, (error) => {
        assert.ok(fixture.observations().some((entry) => entry.event === "close"));
        return code("AGY_TIMEOUT", 504)(error);
      });
      try {
        await fixture.waitFor("ready");
        testCase.mock.timers.tick(360_000);
        await fixture.waitFor("term");
        controller.abort("late external cancellation");
        testCase.mock.timers.tick(1000);
        await rejected;
        await assertInput(fixture, [B], "timeout prompt");
        assert.deepEqual(fixture.observations().filter((entry) => entry.event === "kill").map((entry) => entry.signal), ["SIGTERM", "SIGKILL"]);
      } finally { controller.abort(); testCase.mock.timers.reset(); await Promise.allSettled([work, rejected]); }
    });
  } catch (error) { throw error; }
}

async function windowsTermination(t: TestContext, fixture: AgyProcessFixture, timeout = false): Promise<void> {
  await t.test(timeout ? "Windows Agy timeout keeps first reason through abrupt close"
    : "Windows Agy cancellation closes before one rejection", async (parent) => {
    for (const scenario of ["cooperative-wait", "term-ignored-wait"]) await parent.test(scenario, async (tc) => {
      await fixture.configure(scenario);
      const controller = new AbortController();
      let child: childProcess.ChildProcess | undefined;
      const restore = inspectSpawn(tc, (value) => { child = value; });
      tc.mock.timers.enable({ apis: ["setTimeout"] });
      let rejections = 0;
      const work = fixture.generate("Windows lifecycle", { signal: controller.signal, references: refs(A) });
      const rejected = assert.rejects(work, (error) => {
        rejections++;
        assert.ok(fixture.observations().some((entry) => entry.event === "close"));
        return code(timeout ? "AGY_TIMEOUT" : "GENERATION_CANCELED", timeout ? 504 : 499)(error);
      });
      try {
        await fixture.waitFor("ready");
        if (timeout) tc.mock.timers.tick(360_000);
        controller.abort("late abort preserves the first reason");
        await rejected;
        await assertInput(fixture, [A], "Windows lifecycle");
        assert.equal(rejections, 1);
        assert.deepEqual(fixture.observations().filter((entry) => entry.event === "kill").map((entry) => entry.signal), ["SIGTERM"]);
        const before = fixture.observations();
        tc.mock.timers.tick(361_000);
        assert.deepEqual(fixture.observations(), before, "no late timer work");
        assert.equal(rejections, 1);
        assert.equal(child?.listenerCount("close"), 0);
        assert.equal(child?.stdout?.listenerCount("data"), 0);
        assert.equal(child?.stderr?.listenerCount("data"), 0);
        assert.equal(getEventListeners(controller.signal, "abort").length, 0);
      } finally {
        controller.abort(); tc.mock.timers.reset();
        await Promise.allSettled([work, rejected]); restore();
      }
    });
  });
}

function inspectSpawn(t: TestContext, inspect: (child: childProcess.ChildProcess) => void) {
  const spawn = childProcess.spawn;
  const interception = t.mock.method(childProcess, "spawn", (command: string, args: string[], options: SpawnOptions) => {
    const child = spawn(command, args, options);
    inspect(child);
    return child;
  });
  syncBuiltinESMExports();
  return () => { interception.mock.restore(); syncBuiltinESMExports(); };
}

async function eventCases(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    const { spawnAgy } = await import("../lib/agyProcess.ts");
    const prompt = '  Prompt: "direct process lifecycle"\n  ImagePaths: []';
    await t.test("spawnAgy pre-abort is independently inert", async () => {
      await fixture.configure("success");
      const before = fixture.spawnCount();
      await assert.rejects(fixture.track(spawnAgy(prompt, AbortSignal.abort())), code("GENERATION_CANCELED", 499));
      assert.equal(fixture.spawnCount(), before);
    });
    await t.test("injected startup ENOENT/abort then native close pins process error and drains listeners", async (testCase) => {
      await fixture.configure("success");
      const controller = new AbortController();
      let child: childProcess.ChildProcess | undefined;
      const restore = inspectSpawn(testCase, (spawned) => {
        child = spawned;
        queueMicrotask(() => {
          spawned.emit("error", Object.assign(new Error("synthetic fixture startup ENOENT"), { code: "ENOENT" }));
          controller.abort();
        });
      });
      try {
        await assert.rejects(fixture.track(spawnAgy(prompt, controller.signal)), (error) => {
          assert.ok(fixture.observations().some((entry) => entry.event === "close"));
          code("AGY_PROCESS_ERROR", 502)(error);
          assert.match(String(error), /was not found/); return true;
        });
        assert.equal(child?.listenerCount("close"), 0);
        assert.equal(getEventListeners(controller.signal, "abort").length, 0);
      } finally { restore(); }
    });
  } catch (error) { throw error; }
}

async function alreadyClosed(t: TestContext, fixture: AgyProcessFixture): Promise<void> {
  try {
    await t.test("already-closed native child ignores later abort/deadline with timers and listeners drained", async (testCase) => {
      await fixture.configure("success");
      const { spawnAgy } = await import("../lib/agyProcess.ts");
      const controller = new AbortController();
      let child: childProcess.ChildProcess | undefined;
      const restore = inspectSpawn(testCase, (spawned) => { child = spawned; });
      testCase.mock.timers.enable({ apis: ["setTimeout"] });
      try {
        const result = await fixture.track(spawnAgy('  Prompt: "closed child"\n  ImagePaths: []', controller.signal));
        assert.match(result.stdout, /^RESULT\|.+\|png\n$/);
        assert.equal(result.stderr, "");
        assert.equal((await fixture.waitFor("close")).code, 0);
        assert.equal(getEventListeners(controller.signal, "abort").length, 0);
        assert.equal(child?.listenerCount("close"), 0);
        assert.equal(child?.stdout?.listenerCount("data"), 0);
        assert.equal(child?.stderr?.listenerCount("data"), 0);
        controller.abort(); testCase.mock.timers.tick(361_000);
        assert.deepEqual(fixture.observations().filter((entry) => entry.event === "kill"), []);
      } finally { testCase.mock.timers.reset(); restore(); }
    });
  } catch (error) { throw error; }
}

test("Agy native fixture Google-family and process contracts", { timeout: 120_000 }, async (t) => {
  const fixture = await openAgyProcessFixture(TINY_POLICY);
  try {
    await familyCases(t, fixture);
    await contextCases(t, fixture);
    await captureCases(t, fixture);
    await outputCases(t, fixture);
    await preAbort(t, fixture);
    if (process.platform === "win32") {
      await windowsTermination(t, fixture);
      await windowsTermination(t, fixture, true);
    } else {
      await termination(t, fixture, false);
      await termination(t, fixture, true);
      await timeoutCases(t, fixture);
    }
    await eventCases(t, fixture);
    await alreadyClosed(t, fixture);
  } finally { await fixture.close(); }
});

function suppressDutKill() {
  const guardedSpawn = childProcess.spawn;
  const suppressed: Array<NodeJS.Signals | number | undefined> = [];
  let spawned: childProcess.ChildProcess | undefined;
  // Explicit restoration: a test-context auto-restore after fixture.close would
  // resurrect that closed fixture's guarded spawn for the next test.
  childProcess.spawn = ((command: string, args: string[], options: SpawnOptions) => {
    // Windows TERM is abrupt too. The fixture already captured its native watchdog kill.
    const child = guardedSpawn(command, args, options);
    spawned = child;
    const kill = child.kill.bind(child);
    child.kill = (signal) => {
      if (signal === "SIGKILL" || (process.platform === "win32" && signal === "SIGTERM")) {
        suppressed.push(signal); return false;
      }
      return kill(signal);
    };
    return child;
  }) as typeof childProcess.spawn;
  syncBuiltinESMExports();
  return { suppressed, child: () => spawned,
    restore() { childProcess.spawn = guardedSpawn; syncBuiltinESMExports(); } };
}

test(process.platform === "win32" ? "Windows Agy watchdog reaps suppressed DUT termination"
  : "native watchdog reaps a missing-DUT-KILL child and close fails its violation ledger", { timeout: 20_000 }, async (t) => {
  const fixture = await openAgyProcessFixture(TINY_POLICY);
  const interception = suppressDutKill();
  const controller = new AbortController();
  let work: Promise<unknown> | undefined;
  try {
    await fixture.configure("term-ignored-wait");
    t.mock.timers.enable({ apis: ["setTimeout"] });
    work = fixture.generate("watchdog proof", { signal: controller.signal, references: refs(A) });
    const rejected = assert.rejects(work, code("GENERATION_CANCELED", 499));
    await fixture.waitFor("ready"); controller.abort();
    if (process.platform !== "win32") await fixture.waitFor("term");
    t.mock.timers.tick(1000);
    await rejected; // Only the fixture's captured native watchdog can make this child close.
    const watchdog = await fixture.waitFor("watchdog");
    const closed = await fixture.waitFor("close");
    assert.equal(closed.pid, watchdog.pid);
    if (process.platform !== "win32") assert.equal(closed.signal, "SIGKILL");
    assert.ok(Number(watchdog.sequence) < Number(closed.sequence));
    await assertInput(fixture, [A], "watchdog proof");
    assert.deepEqual(interception.suppressed, process.platform === "win32" ? ["SIGTERM", "SIGKILL"] : ["SIGKILL"]);
    assert.equal(interception.child()?.listenerCount("close"), 0);
    const before = fixture.observations();
    t.mock.timers.tick(361_000);
    assert.deepEqual(fixture.observations(), before);
  } finally {
    controller.abort(); t.mock.timers.reset();
    await Promise.allSettled(work ? [work] : []);
    interception.restore();
    await assert.rejects(fixture.close(), /watchdog/i);
  }
});

test("Agy tiny overflow preserves direct code and actual normalized node error without persistence", async () => {
  const fixture = await openAgyProcessFixture(TINY_POLICY);
  const faults = new AgyFaults(fixture, {});
  try {
    faults.install();
    await fixture.configure("tiny-overflow");
    await assert.rejects(fixture.generate("overflow", { references: refs(A) }), code("AGY_ARTIFACT_TOO_LARGE", 502));
    await assertInput(fixture, [A], "overflow");
    const path = String((await fixture.waitFor("input")).artifactPath);
    assert.deepEqual(await readFile(path), Buffer.alloc(81, 0x61), "policy rejection grants no cleanup");
    await fixture.configure("tiny-overflow");
    const before = fixture.spawnCount();
    const result = await fixture.node();
    assert.equal(result.status, 502);
    assert.equal(fixture.spawnCount(), before + 1);
    const error = result.body.error as Record<string, unknown>;
    assert.equal(error.code, "UNKNOWN");
    assert.equal(error.rawCode, "AGY_ARTIFACT_TOO_LARGE");
    assert.equal(error.errorClass, "INTERNAL_STATE_ERROR");
    assert.ok(!JSON.stringify(result.body).includes(fixture.root));
    assert.deepEqual(await readdir(fixture.ctx.config.storage.generatedDir), []);
    assert.deepEqual(await readFile(path), Buffer.alloc(81, 0x61));
    await assertInput(fixture, [OUTPUT], "owned node prompt");
    assert.equal(faults.count("read", "entered"), 0, "native fstat rejects before any artifact bytes");
    assert.equal(faults.count("close", "completed"), 2, "both real artifact descriptors closed");
    assert.equal(faults.count("unlink", "entered"), 0);
    assert.equal(faults.count("rmdir", "entered"), 0);
    assert.equal(faults.count("rm", "completed"), 2, "both staging directories removed");
  } finally { await faults.drain(); faults.restore(); await fixture.close(); }
});
