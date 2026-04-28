import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function occupy(port) {
  return new Promise((resolve) => {
    const server = createServer().listen(port, "127.0.0.1", () => resolve(server));
  });
}

async function waitForAdvertise(path, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8"));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("server advertisement did not appear");
}

test("server falls back when advertised localhost port is occupied", async () => {
  const preferred = 4700 + Math.floor(Math.random() * 300);
  const blocker = await occupy(preferred);
  const home = mkdtempSync(join(tmpdir(), "ima2-server-fallback-"));
  const generated = mkdtempSync(join(tmpdir(), "ima2-server-fallback-generated-"));
  let child;
  try {
    child = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        IMA2_PORT: String(preferred),
        IMA2_HOST: "127.0.0.1",
        IMA2_CONFIG_DIR: home,
        IMA2_GENERATED_DIR: generated,
        IMA2_NO_OAUTH_PROXY: "1",
      },
    });
    const advertisePath = join(home, "server.json");
    const info = await waitForAdvertise(advertisePath);
    assert.equal(info.backend.configuredPort, preferred);
    assert.equal(info.backend.actualPort, preferred + 1);
    assert.equal(info.backend.url, `http://127.0.0.1:${preferred + 1}`);
  } finally {
    child?.kill("SIGTERM");
    await new Promise((resolve) => child?.once("exit", resolve) || resolve());
    await new Promise((resolve) => blocker.close(resolve));
    rmSync(home, { recursive: true, force: true });
    rmSync(generated, { recursive: true, force: true });
  }
});
