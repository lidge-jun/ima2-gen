import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Integration-ish: boot the real server on a random port, hit /api/health,
// verify advertisement file lifecycle, kill, verify cleanup.

const PORT = String(3500 + Math.floor(Math.random() * 400));
const OAUTH_PORT = String(10532 + Math.floor(Math.random() * 400));
const FAKE_HOME = mkdtempSync(join(tmpdir(), "ima2-test-home-"));
const FAKE_GENERATED_DIR = mkdtempSync(join(tmpdir(), "ima2-test-generated-"));

const HEALTH_TIMEOUT = process.platform === "win32" ? 30000 : 8000;

async function waitForHealth(base, timeoutMs = HEALTH_TIMEOUT) {
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
  let childStderr = "";
  let oauthServer;
  let lastOAuthPayload = null;

  before(async () => {
    oauthServer = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/v1/responses") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          lastOAuthPayload = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            output: [{ type: "image_generation_call", result: "aGVsbG8=" }],
            usage: { total_tokens: 1 },
          }));
        });
        return;
      }
      if (req.method === "GET" && req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "gpt-5.4" }] }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise((resolve) => oauthServer.listen(Number(OAUTH_PORT), "127.0.0.1", resolve));

    child = spawn("node", ["server.js"], {
      env: {
        ...process.env,
        PORT,
        OAUTH_PORT,
        HOME: FAKE_HOME,
        USERPROFILE: FAKE_HOME,
        IMA2_GENERATED_DIR: FAKE_GENERATED_DIR,
        IMA2_NO_OAUTH_PROXY: "1",
      },
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    // drain stderr to surface boot errors if test hangs
    child.stderr.on("data", (d) => {
      childStderr += d.toString();
      if (process.env.DEBUG_TEST) process.stderr.write(d);
    });
    try {
      await waitForHealth(`http://localhost:${PORT}`);
    } catch (err) {
      process.stderr.write(`\n[server stderr on health-timeout]\n${childStderr}\n`);
      throw err;
    }
  });

  after(async () => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
      await new Promise((r) => child.on("exit", r));
    }
    if (oauthServer) {
      await new Promise((resolve) => oauthServer.close(resolve));
    }
    try { rmSync(FAKE_HOME, { recursive: true, force: true }); } catch {}
    try { rmSync(FAKE_GENERATED_DIR, { recursive: true, force: true }); } catch {}
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

  it("GET /api/storage/status returns summarized storage status", async () => {
    const r = await fetch(`http://localhost:${PORT}/api/storage/status`);
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.ok, true);
    assert.ok(body.data);
    assert.ok(typeof body.data.generatedDirLabel === "string");
    assert.ok(Number.isFinite(body.data.generatedCount));
    assert.ok(Number.isFinite(body.data.legacyCandidatesScanned));
    assert.ok(["ok", "recoverable", "not_found", "unknown"].includes(body.data.state));
    assert.strictEqual(body.data.recoveryDocsPath, "docs/RECOVER_OLD_IMAGES.md");
  });

  it("serves app shell without stale index caching", async () => {
    const r = await fetch(`http://localhost:${PORT}/`);
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get("content-type") || "", /text\/html/);
    assert.strictEqual(r.headers.get("cache-control"), "no-store, max-age=0");
  });

  it("does not answer missing hashed assets with html", async () => {
    const r = await fetch(`http://localhost:${PORT}/assets/missing-stale-bundle.css`);
    assert.strictEqual(r.status, 404);
    assert.match(r.headers.get("content-type") || "", /text\/plain/);
    assert.doesNotMatch(await r.text(), /<!doctype html/i);
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

  it("/api/generate forwards moderation to the image tool", async () => {
    lastOAuthPayload = null;
    const r = await fetch(`http://localhost:${PORT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "test moderation forwarding",
        quality: "medium",
        size: "1024x1024",
        moderation: "auto",
      }),
    });
    assert.strictEqual(r.status, 200);
    const body = await r.json();
    assert.strictEqual(body.moderation, "auto");
    assert.strictEqual(body.quality, "medium");
    assert.deepStrictEqual(body.warnings, []);
    assert.ok(lastOAuthPayload, "proxy request should be captured");
    assert.strictEqual(lastOAuthPayload.tools[1].type, "image_generation");
    assert.strictEqual(lastOAuthPayload.tools[1].quality, "medium");
    assert.strictEqual(lastOAuthPayload.tools[1].moderation, "auto");
  });

  it("/api/inflight keeps terminal jobs opt-in and active jobs clean", async () => {
    const requestId = `req_test_${Date.now()}`;
    const r = await fetch(`http://localhost:${PORT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        prompt: "terminal inflight check",
        quality: "medium",
        size: "1024x1024",
        moderation: "low",
      }),
    });
    assert.strictEqual(r.status, 200);

    const activeRes = await fetch(`http://localhost:${PORT}/api/inflight`);
    assert.strictEqual(activeRes.status, 200);
    const activeBody = await activeRes.json();
    assert.ok(Array.isArray(activeBody.jobs));
    assert.equal(activeBody.terminalJobs, undefined);
    assert.equal(activeBody.jobs.some((j) => j.requestId === requestId), false);

    const terminalRes = await fetch(`http://localhost:${PORT}/api/inflight?includeTerminal=1`);
    assert.strictEqual(terminalRes.status, 200);
    const terminalBody = await terminalRes.json();
    assert.ok(Array.isArray(terminalBody.terminalJobs));
    const terminal = terminalBody.terminalJobs.find((j) => j.requestId === requestId);
    assert.ok(terminal, "terminal job should be visible when requested");
    assert.equal(terminal.status, "completed");
    assert.equal(terminal.httpStatus, 200);
    assert.equal(terminal.prompt, undefined);
  });

  // Windows: child.kill(anything) = forceful termination per Node docs
  // (https://nodejs.org/api/child_process.html#subprocesskillsignal) — no
  // handler fires, so __unadvertise cannot run from an externally-signalled
  // kill. Production path (user Ctrl+C in their own terminal) does fire
  // SIGINT and runs cleanup; that's covered manually.
  const testShutdown = process.platform === "win32" ? it.skip : it;
  testShutdown("cleans up advertisement file on shutdown signal", async () => {
    const advertisePath = join(FAKE_HOME, ".ima2", "server.json");
    assert.ok(existsSync(advertisePath), "precondition: file exists");
    child.kill("SIGTERM");
    await new Promise((r) => child.on("exit", r));
    // small grace for unlink
    await new Promise((r) => setTimeout(r, 100));
    assert.ok(!existsSync(advertisePath), "file should be removed after SIGTERM");
  });
});
