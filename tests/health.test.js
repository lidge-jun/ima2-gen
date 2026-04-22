import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Integration-ish: boot the real server on a random port, hit /api/health,
// verify advertisement file lifecycle, kill, verify cleanup.

const PORT = String(3500 + Math.floor(Math.random() * 400));
const FAKE_HOME = mkdtempSync(join(tmpdir(), "ima2-test-home-"));

async function waitForHealth(base, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not become healthy");
}

describe("Server: /api/health + advertisement", () => {
  let child;

  before(async () => {
    child = spawn("node", ["server.js"], {
      env: { ...process.env, PORT, HOME: FAKE_HOME, USERPROFILE: FAKE_HOME },
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    // drain stderr to surface boot errors if test hangs
    child.stderr.on("data", (d) => {
      if (process.env.DEBUG_TEST) process.stderr.write(d);
    });
    await waitForHealth(`http://localhost:${PORT}`);
  });

  after(async () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
      await new Promise((r) => child.on("exit", r));
    }
    try { rmSync(FAKE_HOME, { recursive: true, force: true }); } catch {}
  });

  it("GET /api/health returns expected shape", async () => {
    const r = await fetch(`http://localhost:${PORT}/api/health`);
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.ok, true);
    assert.ok(typeof body.version === "string");
    assert.strictEqual(body.provider, "oauth");
    assert.ok(Number.isFinite(body.uptimeSec));
    assert.ok(Number.isFinite(body.activeJobs));
    assert.ok(Number.isFinite(body.pid));
    assert.ok(Number.isFinite(body.startedAt));
  });

  it("writes ~/.ima2/server.json with pid + port", () => {
    const advertisePath = join(FAKE_HOME, ".ima2", "server.json");
    assert.ok(existsSync(advertisePath), "advertise file should exist");
    const info = JSON.parse(readFileSync(advertisePath, "utf-8"));
    assert.strictEqual(info.port, Number(PORT));
    assert.strictEqual(info.pid, child.pid);
    assert.ok(typeof info.version === "string");
  });

  it("/api/generate logs X-ima2-client tag when provided", async () => {
    // just verify the request is accepted (200 path requires OAuth;
    // 400 without prompt is sufficient to confirm header parsing doesn't break anything)
    const r = await fetch(`http://localhost:${PORT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-ima2-client": "cli/test" },
      body: JSON.stringify({}),
    });
    // no prompt → 400 (header should NOT cause different rejection)
    assert.strictEqual(r.status, 400);
  });

  it("cleans up advertisement file on shutdown signal", async () => {
    const advertisePath = join(FAKE_HOME, ".ima2", "server.json");
    assert.ok(existsSync(advertisePath), "precondition: file exists");
    // Windows never observes SIGTERM handlers for externally-delivered signals,
    // so use SIGINT there (both platforms wire it up).
    const signal = process.platform === "win32" ? "SIGINT" : "SIGTERM";
    child.kill(signal);
    await new Promise((r) => child.on("exit", r));
    // small grace for unlink
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(!existsSync(advertisePath), `file should be removed after ${signal}`);
  });
});
