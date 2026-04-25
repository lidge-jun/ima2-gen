import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
    env: {
      ...process.env,
      npm_config_loglevel: "silent",
      ...(options.env || {}),
    },
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("Could not allocate a free port"));
      });
    });
  });
}

async function waitForJson(url, child, logs, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `server exited before ${url} was ready (code ${child.exitCode})\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`,
      );
    }
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message || "unknown"}\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`,
  );
}

function killServer(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 1500).unref();
  });
}

test("packaged tarball installs and serves core status routes", async () => {
  const root = mkdtempSync(join(tmpdir(), "ima2-package-install-"));
  const packDir = join(root, "pack");
  const projectDir = join(root, "project");
  const configDir = join(root, "config");
  const generatedDir = join(root, "generated");
  const homeDir = join(root, "home");
  mkdirSync(packDir, { recursive: true });
  mkdirSync(projectDir, { recursive: true });

  let child = null;
  try {
    const pack = run(npmCommand(), ["pack", "--json", "--pack-destination", packDir], {
      cwd: process.cwd(),
    });
    const packManifest = JSON.parse(pack.stdout);
    const tarball = join(packDir, packManifest[0].filename);

    run(npmCommand(), ["init", "-y"], { cwd: projectDir });
    run(npmCommand(), ["install", tarball], { cwd: projectDir });

    const packageRoot = join(projectDir, "node_modules", "ima2-gen");
    const cliPath = join(packageRoot, "bin", "ima2.js");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), JSON.stringify({ provider: "oauth" }));
    const env = {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      IMA2_CONFIG_DIR: configDir,
      IMA2_GENERATED_DIR: generatedDir,
      IMA2_DB_PATH: join(configDir, "sessions.db"),
      IMA2_ADVERTISE_FILE: join(configDir, "server.json"),
      IMA2_NO_OAUTH_PROXY: "1",
    };

    const doctor = run(process.execPath, [cliPath, "doctor"], { cwd: projectDir, env });
    assert.match(doctor.stdout, /Doctor/);
    assert.match(doctor.stdout, /runtime dependencies resolvable/);
    assert.match(doctor.stdout, /Storage/);

    const port = await freePort();
    const logs = { stdout: "", stderr: "" };
    child = spawn(process.execPath, [cliPath, "serve"], {
      cwd: packageRoot,
      env: {
        ...env,
        IMA2_PORT: String(port),
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
      logs.stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      logs.stderr += chunk.toString();
    });

    const health = await waitForJson(`http://127.0.0.1:${port}/api/health`, child, logs);
    assert.equal(health.ok, true);
    assert.equal(health.provider, "oauth");

    const storage = await waitForJson(
      `http://127.0.0.1:${port}/api/storage/status`,
      child,
      logs,
    );
    assert.equal(storage.ok, true);
    assert.equal(typeof storage.data.generatedDirLabel, "string");

    const advertised = JSON.parse(readFileSync(join(configDir, "server.json"), "utf8"));
    assert.equal(advertised.port, port);
  } finally {
    if (child) await killServer(child);
    rmSync(root, { recursive: true, force: true });
  }
});
