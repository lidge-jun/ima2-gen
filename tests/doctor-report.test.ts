import assert from "node:assert/strict";
import test from "node:test";
import { buildDoctorReport, renderDoctorReport } from "../bin/lib/doctor-report.ts";
import { buildDoctorBundle } from "../bin/lib/doctor-bundle.ts";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("machine doctor uses code-derived messages and computes exit from emitted checks", () => {
  const report = buildDoctorReport({ version: "1.2.3", mode: "standard", lines: [
    { code: "NODE_RUNTIME_OK", kind: "pass", text: "opaque-node-secret" },
    { code: "AUTH_RATE_LIMITED", kind: "fail", lane: "api", evidence: "remote-auth", text: "https://user:opaque-secret@invalid.test" },
    { code: "CREDENTIAL_MISSING", kind: "warn", lane: "opaque-lane", text: "-----BEGIN PRIVATE KEY-----" },
  ] });
  assert.deepEqual(report.summary, { passed: 1, failed: 1, warned: 1, exitCode: 1 });
  assert.equal(report.checks[1]!.code, "AUTH_RATE_LIMITED"); assert.equal(report.checks[1]!.evidence, "remote-auth");
  assert.equal(report.checks[1]!.lane, "api"); assert.equal(report.checks[2]!.lane, undefined);
  assert.equal(report.checks[1]!.action, "Retry later; do not reset the credential for this result.");
  const serialized = JSON.stringify(report) + renderDoctorReport(report);
  for (const marker of ["opaque", "PRIVATE KEY", "user:"]) assert.equal(serialized.includes(marker), false);
});

test("unknown failures stay failures while unknown success cannot become a pass", () => {
  for (const kind of ["pass", "fail", "info", "warn"] as const) {
    const report = buildDoctorReport({ version: "1.2.3", mode: "standard", lines: [{ code: "opaque_unknown", kind, text: "opaque upstream" }] });
    assert.equal(report.checks[0]!.code, "DIAGNOSTIC_UNKNOWN");
    assert.equal(report.checks[0]!.kind, kind === "fail" ? "fail" : "warn");
    assert.equal(report.summary.exitCode, kind === "fail" ? 1 : 0);
    assert.equal(JSON.stringify(report).includes("opaque"), false);
  }
});

test("installation report excludes auth and compatibility bundle retains safe fields", () => {
  const report = buildDoctorReport({ version: "1.2.3", mode: "installation", lines: [
    { code: "INSTALL_NATIVE_OK", kind: "pass", text: "local native" },
    { code: "INSTALL_UI_STALE", kind: "warn", text: "opaque path" },
  ] });
  assert.equal(report.mode, "installation"); assert.equal(report.summary.exitCode, 0);
  const bundle = buildDoctorBundle({ version: "1.2.3", report, providerLines: [
    { code: "AUTH_NETWORK_FAILED", lane: "api", kind: "fail", text: "opaque_body https://user:opaque@invalid.test" },
  ] });
  assert.deepEqual(Object.keys(bundle).sort(), ["checks", "hostnameHash", "lanes", "node", "platform", "schemaVersion", "summary", "version"]);
  assert.equal(bundle.lanes[0]!.lane, "api"); assert.equal(bundle.lanes[0]!.kind, "fail");
  assert.equal(JSON.stringify(bundle).includes("opaque"), false); assert.deepEqual(bundle.summary, report.summary);
});

const CLI_OBSERVATION = `
import fs from "node:fs"; import fp from "node:fs/promises"; import os from "node:os";
import cp from "node:child_process"; import {syncBuiltinESMExports} from "node:module";
const home=process.env.WP10_TEST_HOME,installation=process.argv.includes("--installation");
const counts={configReads:0,authLookups:0,subprocessAttempts:0,network:0};
os.homedir=()=>home;
for(const [target,names] of [[fs,["readFileSync","readFile","existsSync"]],[fp,["readFile"]]])for(const name of names){
 const original=target[name];target[name]=function(path,...args){const text=String(path);
 if(/(?:auth\\.json|\\.codex)(?:$|[\\/])/.test(text)){counts.authLookups++;if(name==="existsSync")return false;throw Error("WP10_AUTH_READ");}
 if(/(?:^|[\\/])config\\.json$/.test(text)){counts.configReads++;if(installation)throw Error("WP10_CONFIG_READ");}
 return original.call(this,path,...args);};
}
for(const name of ["spawn","exec","execFile","fork","spawnSync","execSync","execFileSync"]){
 cp[name]=function(command,...args){counts.subprocessAttempts++;
 if(!installation&&name==="execFileSync"&&command==="npm")return "11.18.0\\n";
 const error=Object.assign(Error("WP10_BLOCKED_EXECUTION"),{code:"ENOENT"});
 const callback=args.at(-1);if(typeof callback==="function"){process.nextTick(callback,error);return;}throw error;};
}
globalThis.fetch=async()=>{counts.network++;throw Error("WP10_BLOCKED_NETWORK");};
syncBuiltinESMExports();
process.on("exit",()=>process.stderr.write("WP10_COUNTS "+JSON.stringify(counts)+"\\n"));
`;

// Explicit hosted command after tsc emit. Not automatically invoked by local
// unit tests; it must never inspect an operator's installed/account state.
export async function verifyEmittedDoctorCli(): Promise<void> {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted") throw Error("WP10_HOSTED_CLI_REQUIRED");
  const root = resolve("."), home = await mkdtemp(join(tmpdir(), "wp10-doctor-cli-"));
  const preloader = join(home, "observe.mjs");
  try {
    await writeFile(preloader, CLI_OBSERVATION); await mkdir(join(home, ".codex"));
    await writeFile(join(home, ".codex/auth.json"), '{"token":"WP10_SYNTHETIC_POISON"}');
    const version = JSON.parse(await readFile(join(root, "package.json"), "utf8")).version;
    const cases = [
      { args: ["--installation", "--json"], config: "null", exit: 0, mode: "installation" },
      { args: ["--installation", "--verify-keys", "--json"], config: "{}", exit: 2, mode: "invalid" },
      { args: ["--json"], config: "null", exit: 1, mode: "standard-invalid" },
      { args: ["--bundle", "--json"], config: "{}", exit: 1, mode: "bundle" },
    ];
    for (const fixture of cases) {
      await writeFile(join(home, "config.json"), fixture.config);
      const output = await runEmittedCli(root, home, preloader, fixture.args);
      assert.equal(output.code, fixture.exit, fixture.mode);
      assert.equal((output.stdout + output.stderr).includes("WP10_SYNTHETIC_POISON"), false);
      const match = /WP10_COUNTS (\{[^\n]+\})/.exec(output.stderr); assert.ok(match);
      const counts = JSON.parse(match[1]!); assert.equal(counts.network, 0);
      if (fixture.args.includes("--installation")) assert.deepEqual(counts, { configReads: 0, authLookups: 0, subprocessAttempts: 0, network: 0 });
      if (fixture.exit === 2) { assert.equal(output.stdout, ""); continue; }
      const report = JSON.parse(output.stdout); assert.equal(report.version, version); assert.equal(report.schemaVersion, 1);
      assert.equal(report.summary.exitCode, fixture.exit);
      if (fixture.mode === "installation") assert.equal(report.mode, "installation");
      if (fixture.mode === "standard-invalid") assert.ok(report.checks.some((line: { code: string }) => line.code === "CONFIG_INVALID"));
      if (fixture.mode === "bundle") assert.ok(Array.isArray(report.lanes));
      console.log(JSON.stringify({ fixture: fixture.mode, exitCode: output.code, counts, report }));
    }
  } finally { await rm(home, { recursive: true, force: false }); }
}

async function runEmittedCli(root: string, home: string, preloader: string, args: string[]) {
  try {
    const result = await promisify(execFile)(process.execPath, ["--import", preloader, join(root, "bin/ima2.js"), "doctor", ...args], {
      cwd: root, timeout: 15000, maxBuffer: 1024 * 1024, env: {
        PATH: process.env.PATH, WP10_TEST_HOME: home, IMA2_CONFIG_DIR: home, IMA2_PORT: "0", IMA2_HOST: "127.0.0.1",
        IMA2_DB_PATH: join(home, "sessions.db"), IMA2_GENERATED_DIR: join(home, "generated"),
      },
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { code?: number | string; stdout?: string; stderr?: string };
    if (typeof failure.code !== "number") throw error;
    return { code: failure.code, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}
