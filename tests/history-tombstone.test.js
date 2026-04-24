import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PORT = String(3900 + Math.floor(Math.random() * 100));
const FAKE_HOME = mkdtempSync(join(tmpdir(), "ima2-b9-home-"));
const GEN_DIR = join(process.cwd(), "generated");
const TEST_PREFIX = `b9test_${Date.now()}_`;

async function waitForHealth(base, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) });
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

describe("History: delete tombstone + pagination", () => {
  let child;
  const base = `http://localhost:${PORT}`;
  const createdFiles = [];
  let titledSessionId = null;

  before(async () => {
    mkdirSync(GEN_DIR, { recursive: true });
    // Seed 3 tiny fake png files (valid PNG signature enough for listImages)
    const pngStub = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    for (let i = 0; i < 3; i++) {
      const ts = Date.now() + i;
      const fn = `${TEST_PREFIX}${ts}_${i}.png`;
      writeFileSync(join(GEN_DIR, fn), pngStub);
      createdFiles.push(fn);
    }

    child = spawn("node", ["server.js"], {
      env: {
        ...process.env,
        PORT,
        HOME: FAKE_HOME,
        USERPROFILE: FAKE_HOME,
        IMA2_NO_OAUTH_PROXY: "1",
      },
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForHealth(base);

    const sessionRes = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Exam Graph" }),
    });
    assert.strictEqual(sessionRes.status, 201);
    titledSessionId = (await sessionRes.json()).session.id;
    writeFileSync(join(GEN_DIR, createdFiles[1] + ".json"), JSON.stringify({
      createdAt: Date.now() + 100,
      prompt: "session titled image",
      provider: "oauth",
      format: "png",
      sessionId: titledSessionId,
    }));
  });

  after(async () => {
    if (child && !child.killed) {
      child.kill(process.platform === "win32" ? "SIGINT" : "SIGTERM");
      await new Promise((r) => child.on("exit", r));
    }
    rmSync(FAKE_HOME, { recursive: true, force: true });
    for (const fn of createdFiles) {
      try { rmSync(join(GEN_DIR, fn), { force: true }); } catch {}
      try { rmSync(join(GEN_DIR, fn + ".json"), { force: true }); } catch {}
    }
    const trash = join(GEN_DIR, ".trash");
    if (existsSync(trash)) {
      for (const e of readdirSync(trash)) {
        if (e.includes(TEST_PREFIX)) {
          try { rmSync(join(trash, e), { force: true }); } catch {}
        }
      }
    }
  });

  it("delete moves file to .trash and restore brings it back", async () => {
    const target = createdFiles[0];
    const srcPath = join(GEN_DIR, target);
    assert.ok(existsSync(srcPath), "seed file exists");

    const delRes = await fetch(`${base}/api/history/${encodeURIComponent(target)}`, {
      method: "DELETE",
    });
    assert.strictEqual(delRes.status, 200, "delete returns 200");
    const delBody = await delRes.json();
    assert.ok(delBody.ok);
    assert.ok(delBody.trashId, "trashId returned");
    assert.ok(!existsSync(srcPath), "source file removed from generated/");

    const trashDir = join(GEN_DIR, ".trash");
    assert.ok(existsSync(trashDir), ".trash/ created");

    const restoreRes = await fetch(
      `${base}/api/history/${encodeURIComponent(target)}/restore`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashId: delBody.trashId }),
      },
    );
    assert.strictEqual(restoreRes.status, 200, "restore returns 200");
    assert.ok(existsSync(srcPath), "file restored to generated/");
  });

  it("history pagination is deduped by composite cursor", async () => {
    const res1 = await fetch(`${base}/api/history?limit=2`);
    assert.strictEqual(res1.status, 200);
    const page1 = await res1.json();
    assert.ok(Array.isArray(page1.items), "items array present");
    if (!page1.nextCursor) return; // not enough history for pagination

    const { before, beforeFilename } = page1.nextCursor;
    const res2 = await fetch(
      `${base}/api/history?limit=2&before=${before}&beforeFilename=${encodeURIComponent(
        beforeFilename,
      )}`,
    );
    assert.strictEqual(res2.status, 200);
    const page2 = await res2.json();
    const overlap = page2.items.filter((b) =>
      page1.items.some((a) => a.filename === b.filename),
    );
    assert.strictEqual(overlap.length, 0, "no duplicates across pages");
  });

  it("groupBy=session returns sessions + loose arrays", async () => {
    const res = await fetch(`${base}/api/history?groupBy=session&limit=100`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.sessions), "sessions array");
    assert.ok(Array.isArray(body.loose), "loose array");
    const titled = body.sessions.find((s) => s.sessionId === titledSessionId);
    assert.ok(titled, "seeded session group present");
    assert.strictEqual(titled.title, "Exam Graph");
    assert.strictEqual(titled.label, "Exam Graph");
  });
});
