import assert from "node:assert/strict";
import test from "node:test";
import * as path from "node:path";
import { build } from "esbuild";

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

function load(state) {
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
  const modules = { "node:fs": fs, "node:path": path,
    "node:os": { homedir: () => runnerHome, userInfo: () => ({ homedir: runnerHome }), tmpdir: () => "/tmp" },
    "node:child_process": { spawn: () => { throw Error("preflight must not spawn"); } },
    "node:http": { createServer: () => { throw Error("preflight must not open sockets"); } },
  };
  const module = { exports: {} };
  const require = (name) => {
    if (!Object.hasOwn(modules, name)) throw Error("Unexpected preflight dependency: " + name);
    return modules[name];
  };
  new Function("require", "module", "exports", "process", result.outputFiles[0].text
    + "\n//# sourceURL=wp02-preflight-bundle.js")(require, module, module.exports,
    { env: state.env, platform: "linux", cwd: () => checkout + "/ui" });
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

test("J6 rejects linked paths and untrusted Azure extension directory ownership/mode", () => {
  for (const state of [host({ symlinks: new Set([azure]) }), host({ symlinks: new Set([runnerHome + "/.config"]) }),
    host({ uid: 1001 }), host({ mode: 0o777 })]) {
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
