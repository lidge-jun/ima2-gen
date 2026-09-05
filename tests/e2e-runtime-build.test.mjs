import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as util from "node:util";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const guards = ["appPolicy.mjs", "appFilePaths.mjs", "appFileDescriptors.mjs", "appFilesystemGuard.mjs", "appProcessGuard.mjs", "appNetworkGuard.mjs"];
const tracked = ["server.ts", "config.ts", "bin/ima2.ts", "package.json", "package-lock.json",
  "tsconfig.json", "tsconfig.build.json", "tsconfig.bin.json", ...guards.map((name) => "ui/e2e/fixtures/" + name)];
const compiled = await build({ entryPoints: [fileURLToPath(new URL("../ui/e2e/fixtures/appRuntimeBuild.ts", import.meta.url))],
  bundle: true, write: false, platform: "node", format: "cjs", external: ["node:*"], logLevel: "silent" });

async function fixture() {
  const container = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), "wp09-runtime-unit-")));
  const root = path.join(container, "repo"), temporary = path.join(container, "tmp");
  const compilerRoot = path.join(root, "node_modules/typescript");
  const state = { head: "a".repeat(40), failStage: "", compiles: [], gitCalls: 0 };
  const put = async (name, text) => { const target = path.join(root, name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, text); };
  await fs.mkdir(temporary, { recursive: true });
  for (const name of tracked) await put(name, name.endsWith(".json") ? "{}" : "export {};\n");
  for (const name of ["server.js", "config.js", "bin/ima2.js"]) await put(name, "export {};\n");
  await put("node_modules/typescript/package.json", JSON.stringify({ version: "synthetic-1" }));
  await put("node_modules/typescript/bin/tsc", "synthetic compiler");
  await put("node_modules/typescript/lib/tsc.js", "synthetic implementation");
  async function execute(file, args, options) {
    if (file === "git") {
      state.gitCalls++;
      assert.equal(options.cwd, root);
      assert.equal(options.env.GIT_DIR, undefined);
      if (args.join(" ") === "rev-parse HEAD") return state.head + "\n";
      if (args.join(" ") === "rev-parse --show-toplevel") return root + "\n";
      assert.deepEqual(Array.from(args), ["ls-files", "-z", "--cached"]);
      return tracked.join("\0") + "\0";
    }
    assert.equal(file, "/synthetic/node");
    assert.equal(args[0], path.join(compilerRoot, "bin/tsc"));
    assert.equal(options.timeout, 120000); assert.equal(options.maxBuffer, 8 * 1024 * 1024);
    const config = args[2], output = args[4]; state.compiles.push(config);
    assert.ok(output.startsWith(temporary + path.sep));
    if (state.failStage === config) throw Object.assign(new Error("synthetic compiler failure"), { code: "SYNTHETIC_COMPILER" });
    const outputs = config === "tsconfig.build.json" ? ["server.js", "config.js"] : ["bin/ima2.js"];
    for (const name of outputs) {
      const target = path.join(output, name); await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, "export {};\n");
    }
    return outputs.map((name) => "TSFILE: " + path.join(output, name)).join("\n");
  }
  const execFile = (file, args, options, callback) => {
    execute(file, args, options).then((stdout) => callback(null, { stdout, stderr: "" }), (error) => callback(error));
  };
  // Every subprocess is synthetic; no compiler, Git executable, app or runtime
  // guard is executed. Real IO is confined to this test's freshly-owned tree.
  const modules = { "node:fs/promises": fs, "node:path": path, "node:crypto": crypto, "node:util": util,
    "node:os": { tmpdir: () => temporary }, "node:child_process": { execFile },
    "node:module": { createRequire: () => ({ resolve: (name) => {
      assert.equal(name, "typescript/package.json"); return path.join(compilerRoot, "package.json");
    } }) } };
  const context = { Buffer, module: { exports: {} }, process: { execPath: "/synthetic/node", version: "v22.synthetic",
    env: { GIT_DIR: "/unowned/git", PATH: "/synthetic/bin" } }, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), "unexpected real dependency: " + name); return modules[name];
  } };
  vm.runInNewContext(compiled.outputFiles[0].text, context, { timeout: 2000 });
  const api = context.module.exports;
  return { root, temporary, state, put, api, async close() {
    try { await api.disposeRuntimeBuildCache(); }
    finally { await fs.rm(container, { recursive: true, force: false }); }
  } };
}

test("concurrent runtime consumers share one verified synthetic compiler pair", async () => {
  const f = await fixture();
  try {
    const [one, two] = await Promise.all([f.api.getVerifiedRuntimeBuild(f.root), f.api.getVerifiedRuntimeBuild(f.root)]);
    assert.equal(one, two); assert.deepEqual(f.state.compiles, ["tsconfig.build.json", "tsconfig.bin.json"]);
    assert.equal(one.compilerVersion, "synthetic-1"); assert.equal(one.files.length, 10);
    assert.equal(Object.isFrozen(one), true); assert.equal(Object.isFrozen(one.files), true);
    assert.equal(await fs.readFile(path.join(one.root, "bin/ima2.js"), "utf8"), "#!/usr/bin/env node\nexport {};\n");
    assert.equal(await f.api.getVerifiedRuntimeBuild(f.root), one);
    assert.equal(f.state.compiles.length, 2);
  } finally { await f.close(); }
});

for (const stage of ["tsconfig.build.json", "tsconfig.bin.json"]) test("compiler failure cleans owned cache and permits retry: " + stage, async () => {
  const f = await fixture();
  try {
    f.state.failStage = stage;
    await assert.rejects(f.api.getVerifiedRuntimeBuild(f.root), { code: "SYNTHETIC_COMPILER" });
    assert.deepEqual(await fs.readdir(f.temporary), []);
    f.state.failStage = "";
    assert.ok((await f.api.getVerifiedRuntimeBuild(f.root)).root.startsWith(f.temporary + path.sep));
  } finally { await f.close(); }
});

for (const mutation of ["source", "head", "compiler", "emitted", "cache", "missing-guard"]) test("cached runtime refuses changed " + mutation, async () => {
  const f = await fixture();
  try {
    const snapshot = await f.api.getVerifiedRuntimeBuild(f.root);
    if (mutation === "source") await f.put("config.ts", "changed source");
    if (mutation === "head") f.state.head = "b".repeat(40);
    if (mutation === "compiler") await f.put("node_modules/typescript/lib/tsc.js", "changed compiler");
    if (mutation === "emitted") await f.put("server.js", "changed preceding build");
    if (mutation === "cache") await fs.writeFile(path.join(snapshot.root, "server.js"), "tamper");
    if (mutation === "missing-guard") await fs.unlink(path.join(snapshot.root, "appPolicy.mjs"));
    const expected = mutation === "cache" ? /E2E_CACHE_TAMPER/ : mutation === "emitted" ? /E2E_EMITTED_STALE/
      : mutation === "missing-guard" ? /ENOENT/ : /E2E_CACHE_STALE/;
    await assert.rejects(f.api.getVerifiedRuntimeBuild(f.root), expected);
    assert.equal(f.state.compiles.length, 2);
  } finally { await f.close(); }
});
