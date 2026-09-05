import assert from "node:assert/strict";
import test from "node:test";
import * as path from "node:path";
import { build } from "esbuild";
import { EventEmitter } from "node:events";

// Execute the actual preflight in a synthetic host, never start the fixture.
// No HOME mutation, real filesystem probe, browser, socket, or child process.
const runnerHome = "/home/runner";
const checkout = runnerHome + "/work/ima2-gen/ima2-gen";
const azure = "/opt/az/azcliextensions";
const result = await build({ entryPoints: ["ui/e2e/fixtures/appServer.ts"], bundle: true,
  write: false, platform: "node", format: "cjs", external: ["node:*"], logLevel: "silent" });

function host(overrides = {}) {
  return {
    env: { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", GITHUB_RUN_ID: "fixture-run",
      HOME: runnerHome, GITHUB_WORKSPACE: checkout, XDG_CONFIG_HOME: runnerHome + "/.config",
      AZURE_EXTENSION_DIR: azure },
    present: new Set([runnerHome + "/.config", azure]), symlinks: new Set(),
    uid: 0, mode: 0o755, mounts: "", entries: [], ...overrides,
  };
}

function load(state, overrides = {}) {
  const fs = {
    existsSync: (p) => state.present.has(p), realpathSync: (p) => p,
    lstatSync: (p) => {
      if (p !== checkout && !state.present.has(p) && !state.symlinks.has(p)) {
        throw Object.assign(Error("fixture absent path"), { code: "ENOENT" });
      }
      return { isSymbolicLink: () => state.symlinks.has(p), uid: state.uid,
        mode: state.mode, isDirectory: () => true };
    },
    readdirSync: () => state.entries,
    readFileSync: (p) => { assert.equal(p, "/proc/self/mountinfo"); return state.mounts; },
    mkdtempSync: () => { throw Error("preflight must not create fixture directories"); },
    writeFileSync: () => { throw Error("preflight must not write files"); },
  };
  const modules = { "node:fs": { ...fs, ...overrides.fs }, "node:path": path,
    "node:os": { homedir: () => runnerHome, userInfo: () => ({ homedir: runnerHome }), tmpdir: () => "/tmp" },
    "node:child_process": overrides.childProcess ?? { spawn: () => { throw Error("preflight must not spawn"); } },
    "node:http": overrides.http ?? { createServer: () => { throw Error("preflight must not open sockets"); } },
  };
  const module = { exports: {} };
  const require = (name) => {
    if (!Object.hasOwn(modules, name)) throw Error("Unexpected preflight dependency: " + name);
    return modules[name];
  };
  new Function("require", "module", "exports", "process", result.outputFiles[0].text
    + "\n//# sourceURL=wp02-preflight-bundle.js")(require, module, module.exports,
    { env: state.env, platform: "linux", cwd: () => checkout + "/ui", execPath: "/fixture/node" });
  return module.exports;
}

test("J6 permits only verified hosted path metadata and reports it", () => {
  const proof = load(host()).assertJ6Isolation();
  assert.deepEqual(proof.runnerPaths, { xdgConfigHome: runnerHome + "/.config", azureExtensions: azure });
  assert.equal(proof.providerEnvironmentAbsent, true);
  assert.equal(proof.authStoresAbsent, true);
});

test("J6 does not treat path exceptions as credential or arbitrary-root exceptions", () => {
  for (const [key, value] of [["AZURE_CLIENT_SECRET", "fixture-secret"], ["OPENAI_API_KEY", "fixture-secret"],
    ["XDG_CONFIG_HOME", "/other/config"], ["AZURE_EXTENSION_DIR", "/other/extensions"]]) {
    const state = host(); state.env[key] = value;
    assert.throws(() => load(state).assertJ6Isolation(), /unsafe environment names/);
  }
});

test("J6 rejects linked paths, nonroot ownership and unobserved writable modes", () => {
  for (const state of [host({ symlinks: new Set([azure]) }), host({ symlinks: new Set([runnerHome + "/.config"]) }),
    host({ uid: 1001 }), host({ mode: 0o775 })]) {
    assert.throws(() => load(state).assertJ6Isolation(), /unsafe environment names/);
  }
});

test("verified XDG root still rejects auth stores and dotenv overrides", () => {
  const state = host(); state.present.add(runnerHome + "/.config/gcloud");
  assert.throws(() => load(state).assertJ6Isolation(), /auth store exists/);
  assert.throws(() => load(host({ entries: [".env.local"] })).assertJ6Isolation(), /dotenv override/);
  assert.throws(() => load(host({ mounts: "mount /Users/fixture/.grok /data rw" })).assertJ6Isolation(), /credential-bearing mount/);
});

test("J6 distinguishes genuine absent XDG root from a dangling symlink", () => {
  const state = host(); state.present.delete(runnerHome + "/.config");
  assert.equal(load(state).assertJ6Isolation().authStoresAbsent, true);
  state.symlinks.add(runnerHome + "/.config");
  assert.throws(() => load(state).assertJ6Isolation(), /unsafe environment names/);
});

test("J6 remains blocked on local/self-hosted contexts before any resource allocation", () => {
  for (const field of ["GITHUB_ACTIONS", "RUNNER_ENVIRONMENT"]) {
    const state = host(); state.env[field] = "not-hosted";
    assert.throws(() => load(state).assertJ6Isolation(), /disposable GitHub-hosted/);
  }
});

test("J6 diagnostics expose fixed-path metadata without changing refusal or inspecting arbitrary values", () => {
  const state = host({ mode: 0o775 });
  const api = load(state);
  assert.equal(api.j6RunnerPathDiagnostics().AZURE_EXTENSION_DIR.mode, "775");
  assert.equal(api.j6RunnerPathDiagnostics().AZURE_EXTENSION_DIR.expectedPath, true);
  assert.throws(() => api.assertJ6Isolation(), /unsafe environment names/);
  state.env.AZURE_EXTENSION_DIR = "/untrusted/location";
  assert.deepEqual(load(state).j6RunnerPathDiagnostics().AZURE_EXTENSION_DIR, { expectedPath: false, inspected: false });
  state.env.GITHUB_ACTIONS = "false";
  assert.deepEqual(load(state).j6RunnerPathDiagnostics(), { inspected: false });
});

test("J6 recognizes observed canonical root-owned777 Azure path as unused metadata only", () => {
  const api = load(host({ mode: 0o777 }));
  assert.equal(api.assertJ6Isolation().azureExtensionHandling, "unused-public-tool-metadata");
  assert.equal(api.j6RunnerPathDiagnostics().AZURE_EXTENSION_DIR.mode, "777");
});

test("actual J6 startApp excludes both metadata variables from captured child options", async () => {
  const state = host({ mode: 0o777 }); state.env.PATH = "/fixture/bin";
  const captured = []; const writes = []; let stubClosed = false;
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, signalCode: null,
    kill(signal) { this.signalCode = signal; queueMicrotask(() => this.emit("exit", null, signal)); return true; },
  });
  const api = load(state, {
    fs: { mkdtempSync: () => "/tmp/wp02-synthetic", writeFileSync: (p, value) => writes.push([p, JSON.parse(value)]) },
    childProcess: { spawn: (...args) => {
      captured.push(args);
      queueMicrotask(() => child.stdout.emit("data", Buffer.from("Image Gen running at http://127.0.0.1:40124")));
      return child;
    } },
    http: { createServer: () => ({
      listen: (_port, _host, ready) => ready(), address: () => ({ port: 40123 }),
      close: (done) => { stubClosed = true; done(); },
    }) },
  });
  const app = await api.startApp("minimax", { j6: true, provider: "oauth" });
  try {
    assert.equal(captured.length, 1);
    const [command, args, options] = captured[0];
    assert.equal(command, "/fixture/node"); assert.deepEqual(args, ["--import", "tsx", "server.ts"]);
    assert.equal(Object.hasOwn(options.env, "AZURE_EXTENSION_DIR"), false);
    assert.equal(Object.hasOwn(options.env, "XDG_CONFIG_HOME"), false);
    assert.equal(options.env.HOME, runnerHome);
    assert.equal(options.env.IMA2_NO_OAUTH_PROXY, "1"); assert.equal(options.env.IMA2_NO_GROK_PROXY, "1");
    assert.equal(Object.hasOwn(options, "shell"), false);
    assert.equal(writes.length, 1); assert.deepEqual(writes[0][1].mcp.enabledProviders, []);
    assert.equal(app.isolation.azureExtensionHandling, "unused-public-tool-metadata");
  } finally { await app.close(); }
  assert.equal(child.signalCode, "SIGTERM"); assert.equal(stubClosed, true);
});
