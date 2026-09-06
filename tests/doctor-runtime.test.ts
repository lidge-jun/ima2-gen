import assert from "node:assert/strict";
import test from "node:test";
import { buildInstallationDoctorLines, checkNodeEngine, parseMinimumNodeMajor, probeDoctorRuntime } from "../bin/lib/doctor-runtime.ts";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("doctor Node floor follows the package requirement, not a hardcoded major", () => {
  assert.equal(parseMinimumNodeMajor(">=22"), 22);
  for (const [version, engine, code] of [["v20.19.0", ">=22", "NODE_RUNTIME_UNSUPPORTED"],
    ["v22.0.0", ">=22", "NODE_RUNTIME_OK"], ["v24.17.0", ">=22", "NODE_RUNTIME_OK"],
    ["v22.0.0", ">=24", "NODE_RUNTIME_UNSUPPORTED"], ["not-node", ">=22", "NODE_RUNTIME_UNSUPPORTED"]]) {
    assert.equal(checkNodeEngine(version!, engine).code, code);
  }
  for (const engine of [null, undefined, ">=20 <25", ">=0", "22", ">=NaN", {}]) {
    assert.throws(() => parseMinimumNodeMajor(engine), /ENGINE_REQUIREMENT_INVALID/);
    assert.equal(checkNodeEngine("v24.17.0", engine).code, "ENGINE_REQUIREMENT_INVALID");
  }
});

test("an owned incomplete installation reports native, package and UI failures without auth", async () => {
  const root = await mkdtemp(join(tmpdir(), "wp10-incomplete-package-"));
  try {
    let rows = buildInstallationDoctorLines(root);
    for (const code of ["INSTALL_PACKAGE_MISSING", "INSTALL_DEPENDENCY_MISSING", "INSTALL_NATIVE_FAILED", "INSTALL_SKILL_MISSING", "INSTALL_UI_MISSING"]) {
      assert.ok(rows.some((row) => row.code === code && row.kind === "fail"), code);
    }
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "1.2.3", engines: { node: ">=22" } }));
    await mkdir(join(root, "ui/dist"), { recursive: true }); await writeFile(join(root, "ui/dist/index.html"), "<main>owned fixture</main>");
    rows = buildInstallationDoctorLines(root);
    assert.ok(rows.some((row) => row.code === "INSTALL_PACKAGE_OK"));
    assert.ok(rows.some((row) => row.code === "INSTALL_UI_OK"));
    assert.equal(rows.some((row) => row.code.startsWith("AUTH_") || row.code.startsWith("CREDENTIAL_") || row.code.startsWith("OAUTH_")), false);
  } finally { await rm(root, { recursive: true, force: false }); }
});

test("runtime diagnostics reject unowned origins before fetch without echoing them", async () => {
  let calls = 0;
  for (const url of ["https://outside.invalid", "http://user:opaque@127.0.0.1:4000", "http://127.0.0.1:4000/a",
    "http://localhost:4000?secret=opaque", "http://[::1]:4000#opaque", "file:///secret", "invalid"]) {
    const rows = await probeDoctorRuntime({ url, expectedVersion: "1.2.3", timeoutMs: 100,
      fetchImpl: (async () => { calls++; throw Error("should not fetch"); }) as typeof fetch });
    assert.equal(rows[0]!.code, "RUNTIME_ORIGIN_INVALID"); assert.equal(JSON.stringify(rows).includes("opaque"), false);
  }
  assert.equal(calls, 0);
});

test("runtime health distinguishes authenticated access, shape, version and good response", async () => {
  for (const fixture of [
    { status: 401, body: {}, code: "RUNTIME_AUTH_REQUIRED" }, { status: 403, body: {}, code: "RUNTIME_AUTH_REQUIRED" },
    { status: 503, body: {}, code: "RUNTIME_INVALID_HEALTH" }, { status: 200, body: { ok: false }, code: "RUNTIME_INVALID_HEALTH" },
    { status: 200, body: { ok: true, version: "1.2.3", pid: "secret" }, code: "RUNTIME_INVALID_HEALTH" },
    { status: 200, body: { ok: true, version: "9.9.9", pid: 42 }, code: "RUNTIME_VERSION_MISMATCH" },
    { status: 200, body: { ok: true, version: "1.2.3", pid: 42 }, code: "RUNTIME_READY" },
  ]) {
    let cancelled = 0;
    const response = fixture.status === 200 ? new Response(JSON.stringify(fixture.body), { status: fixture.status })
      : new Response(new ReadableStream({ cancel() { cancelled++; } }), { status: fixture.status });
    const rows = await probeDoctorRuntime({ url: "http://127.0.0.1:44000", expectedVersion: "1.2.3", timeoutMs: 100,
      fetchImpl: (async (url, options) => {
        assert.equal(String(url), "http://127.0.0.1:44000/api/health"); assert.equal(options?.redirect, "error");
        assert.deepEqual(options?.headers, { Connection: "close" }); return response;
      }) as typeof fetch });
    assert.equal(rows[0]!.code, fixture.code);
    assert.equal(cancelled, fixture.status === 200 ? 0 : 1);
  }
});

test("runtime whole-response timeout and network failures remain distinct", async () => {
  let signal: AbortSignal | undefined;
  const hanging = await probeDoctorRuntime({ url: "http://[::1]:44000", expectedVersion: "1.2.3", timeoutMs: 10,
    fetchImpl: (async (_url, options) => {
      signal = options?.signal ?? undefined;
      return new Response(new ReadableStream({ start(controller) {
        signal?.addEventListener("abort", () => controller.error(Error("owned abort")), { once: true });
      } }));
    }) as typeof fetch });
  assert.equal(hanging[0]!.code, "RUNTIME_TIMEOUT"); assert.equal(signal?.aborted, true);
  const failed = await probeDoctorRuntime({ url: "http://localhost:44000", expectedVersion: "1.2.3", timeoutMs: 100,
    fetchImpl: (async () => { throw Error("opaque network body"); }) as typeof fetch });
  assert.equal(failed[0]!.code, "RUNTIME_UNREACHABLE"); assert.equal(JSON.stringify(failed).includes("opaque"), false);
});
