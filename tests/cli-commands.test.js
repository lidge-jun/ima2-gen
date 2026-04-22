import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PORT = String(3900 + Math.floor(Math.random() * 80));
const FAKE_HOME = mkdtempSync(join(tmpdir(), "ima2-cmd-home-"));

function runCLI(args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn("node", ["bin/ima2.js", ...args], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: FAKE_HOME, USERPROFILE: FAKE_HOME, ...extraEnv },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function waitForHealth(base, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server not healthy");
}

describe("ima2 CLI commands (live server)", () => {
  let server;

  before(async () => {
    server = spawn("node", ["server.js"], {
      env: { ...process.env, PORT, HOME: FAKE_HOME, USERPROFILE: FAKE_HOME },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stderr.on("data", (d) => { if (process.env.DEBUG_TEST) process.stderr.write(d); });
    await waitForHealth(`http://localhost:${PORT}`);
  });

  after(async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise((r) => server.on("exit", r));
    }
    try { rmSync(FAKE_HOME, { recursive: true, force: true }); } catch {}
  });

  it("ima2 ping reaches advertised server", async () => {
    const { stdout, code } = await runCLI(["ping"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /localhost/);
    assert.match(stdout, /v\d/);
  });

  it("ima2 ping --json returns parseable shape", async () => {
    const { stdout, code } = await runCLI(["ping", "--json"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout.trim());
    assert.strictEqual(obj.ok, true);
    assert.strictEqual(obj.provider, "oauth");
    assert.ok(Number.isFinite(obj.activeJobs));
  });

  it("ima2 ps --json returns empty jobs", async () => {
    const { stdout, code } = await runCLI(["ps", "--json"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(obj.jobs));
  });

  it("ima2 gen without prompt exits 2", async () => {
    const { code, stderr } = await runCLI(["gen"]);
    assert.strictEqual(code, 2);
    assert.match(stderr, /prompt/i);
  });

  it("ima2 gen --help prints usage", async () => {
    const { stdout, code } = await runCLI(["gen", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /ima2 gen/);
    assert.match(stdout, /--quality/);
  });

  it("ima2 ls --json works when history empty", async () => {
    const { stdout, code } = await runCLI(["ls", "--json"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout.trim());
    assert.ok(Array.isArray(obj.items));
  });

  it("ima2 gen with unreachable --server exits 3", async () => {
    const { code } = await runCLI(["gen", "hi", "--server", "http://127.0.0.1:1"], {
      IMA2_SERVER: "", // clear env
    });
    assert.strictEqual(code, 3);
  });

  it("ima2 --help lists new commands", async () => {
    const { stdout, code } = await runCLI(["--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /gen <prompt>/);
    assert.match(stdout, /ping/);
  });
});
