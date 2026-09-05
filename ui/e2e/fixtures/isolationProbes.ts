import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile, lstat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertJ6Isolation } from "./appServer";
import { issueAppHome, registerOwnedApp } from "./appOwnership";
import { createAppProjection, verifyAppProjection } from "./appProjection";
import { createGuardReport, type GuardReport } from "./appGuardReport";
import { makeAppEnv } from "./appIsolation";
import { startStubUpstream, type StubHandle } from "./stubUpstream";

export type IsolationProbe = { result: unknown; guard: GuardReport; nativeCalls: string[];
  stubCalls: string[]; exited: boolean };
type ProbeOptions = {
  setup?: (paths: { root: string; home: string; stub: StubHandle }) => Promise<void>;
  beforeGuard?: string;
};

async function stop(child: ChildProcess | undefined, exited: () => boolean, completion: Promise<void>): Promise<void> {
  if (!child || exited()) return;
  let force: ReturnType<typeof setTimeout> | undefined, deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    if (child.pid && child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    force = setTimeout(() => { if (!exited()) child.kill("SIGKILL"); }, 1000);
    await Promise.race([completion, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("E2E_PROBE_EXIT_UNPROVEN")), 5000);
    })]);
  } finally { clearTimeout(force); clearTimeout(deadline); }
}
function driver(body: string): string {
  return `try {
    const result = await (async () => { ${body} })();
    process.send({type:"wp09-probe-result",result}, (error) => process.exit(error ? 1 : 0));
  } catch (error) {
    const raw = error && (error.code || error.message);
    const code = typeof raw === "string" && /^[A-Z0-9_]+$/.test(raw) ? raw : "E2E_PROBE_FAILED";
    process.send({type:"wp09-probe-error",code}, () => process.exit(1));
  }`;
}
export async function runIsolationProbe(body: string, options: ProbeOptions = {}): Promise<IsolationProbe> {
  assertJ6Isolation();
  const home = await issueAppHome(), stub = await startStubUpstream();
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  let projection: Awaited<ReturnType<typeof createAppProjection>> | undefined, child: ChildProcess | undefined;
  let closed = true, resolveClose!: () => void, reported = false;
  const completion = new Promise<void>((resolve) => { resolveClose = resolve; });
  const guard = createGuardReport(), nativeCalls: string[] = [];
  let result: unknown, errorCode = "", stderr = "";
  const closeResources = async () => {
    await stop(child, () => closed, completion);
    await stub.close();
    if (closed) await projection?.dispose();
  };
  try {
    await mkdir(join(home, "tmp")); await writeFile(join(home, "fixture.env"), "");
    await writeFile(join(home, "config.json"), JSON.stringify({ mcp: { enabledProviders: [] } }));
    projection = await createAppProjection({ repoRoot, home, buildDir: join(repoRoot, "ui/dist") });
    await options.setup?.({ root: projection.root, home, stub });
    await verifyAppProjection(projection);
    const args: string[] = [];
    if (options.beforeGuard) {
      const sentinel = join(projection.root, "native-sentinel.mjs");
      await writeFile(sentinel, options.beforeGuard, { flag: "wx" });
      args.push("--import", sentinel);
    }
    args.push("--import", projection.guardPath, "--input-type=module", "--eval", driver(body));
    await registerOwnedApp({ home, appOrigin: null, stubOrigin: new URL(stub.url).origin,
      closeResources, exited: () => closed, verificationReported: () => reported, verify: () => guard.assertClean() });
    const env = makeAppEnv(process.env, { home, stubUrl: stub.url, mode: "minimax", withoutMinimaxKey: true });
    child = spawn(process.execPath, args, { cwd: projection.root,
      env: { ...env, IMA2_E2E_POLICY: projection.policyPath }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
    closed = false;
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", (value: Buffer) => { stderr = (stderr + value.toString()).slice(-65536); });
    child.on("message", (value: unknown) => {
      if (value && typeof value === "object" && "type" in value) {
        const record = value as Record<string, unknown>;
        if (record.type === "wp09-probe-result" && Object.keys(record).length === 2) { result = record.result; return; }
        if (record.type === "wp09-probe-error" && Object.keys(record).length === 2
          && typeof record.code === "string" && /^[A-Z0-9_]{1,80}$/.test(record.code)) { errorCode = record.code; return; }
        if (record.type === "wp09-native-call" && Object.keys(record).length === 2
          && typeof record.api === "string" && /^[a-zA-Z.]{1,80}$/.test(record.api)) { nativeCalls.push(record.api); return; }
      }
      guard.accept(value);
    });
    child.once("close", () => { closed = true; resolveClose(); });
    child.once("error", () => { errorCode = "E2E_PROBE_SPAWN"; });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([completion, guard.failure, new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("E2E_PROBE_TIMEOUT")), 20000);
      })]);
    } finally { clearTimeout(deadline); }
    if (child.exitCode !== 0 || errorCode) {
      const codes = stderr.match(/\b(?:E2E|ERR|UI_RECEIPT)_[A-Z_]+\b/g) ?? [];
      throw new Error("E2E_PROBE_RESULT:" + (errorCode || codes.at(-1) || "unknown"));
    }
    if (!guard.ready || result === undefined) throw new Error("E2E_PROBE_NO_RESULT");
    return { result, guard, nativeCalls, stubCalls: [...stub.calls], exited: true };
  } finally { reported = true; await closeResources(); }
}

// Independent native-call sentinels run before the guard, never before an app on
// an operator machine. They make a broken denial test harmless in the cleanroom.
export const PROCESS_SENTINEL = `
import cp from "node:child_process"; import wt from "node:worker_threads";
import {syncBuiltinESMExports} from "node:module";
const deny=(api)=>{process.send({type:"wp09-native-call",api});throw Object.assign(Error("native sentinel"),{code:"E2E_NATIVE_SENTINEL"});};
for(const api of ["spawn","exec","execFile","fork","spawnSync","execSync","execFileSync"]) {
 cp[api]=(...args)=>deny(api);
 cp[api][Symbol.for("nodejs.util.promisify.custom")]=async()=>deny("custom."+api);
}
cp.ChildProcess.prototype.spawn=()=>deny("prototype.spawn"); wt.Worker=function(){return deny("Worker");};
syncBuiltinESMExports();
`;
export const NETWORK_SENTINEL = `
import net from "node:net";import dns from "node:dns";import dp from "node:dns/promises";
import tls from "node:tls";import http2 from "node:http2";import dgram from "node:dgram";
import {syncBuiltinESMExports} from "node:module";
const url=new URL(process.env.IMA2_E2E_ALLOWED_ORIGIN);
const deny=(api)=>{process.send({type:"wp09-native-call",api});throw Object.assign(Error("native sentinel"),{code:"E2E_NATIVE_SENTINEL"});};
for(const [target,key] of [[net,"connect"],[net,"createConnection"],[net.Socket.prototype,"connect"]]) {
 const original=target[key];target[key]=function(...args){const a=Array.isArray(args[0])?args[0][0]:args[0];
 if(a&&typeof a==="object"&&a.host==="127.0.0.1"&&Number(a.port)===Number(url.port)&&!a.path&&!a.fd&&!a.lookup)return original.apply(this,args);
 return deny("tcp");};
}
for(const target of [dns,dp]) {
 for(const key of Object.keys(target))if(/^(lookup|resolve|reverse)/.test(key))target[key]=()=>deny("dns."+key);
 for(let p=target.Resolver.prototype;p&&p!==Object.prototype;p=Object.getPrototypeOf(p))for(const key of Object.getOwnPropertyNames(p))
 if(/^(lookup|resolve|reverse)/.test(key))target.Resolver.prototype[key]=()=>deny("resolver."+key);
}
tls.connect=()=>deny("tls");http2.connect=()=>deny("http2");dgram.createSocket=()=>deny("udp");
if(globalThis.WebSocket)globalThis.WebSocket=function(){return deny("WebSocket");};
syncBuiltinESMExports();
`;
export function filesystemSentinel(roots: string[]): string {
  return `import fs from "node:fs";import fp from "node:fs/promises";
import {resolve,sep} from "node:path";import {fileURLToPath} from "node:url";import {syncBuiltinESMExports} from "node:module";
const roots=${JSON.stringify(roots)}.map(r=>resolve(r)),real=fs.realpathSync;
const denied=(value)=>{try{let p=value instanceof URL?fileURLToPath(value):Buffer.isBuffer(value)?value.toString():value;
 if(typeof p!=="string")return true;p=resolve(p);try{p=real(p);}catch{}
 return roots.some(r=>p===r||p.startsWith(r+sep));}catch{return true;}};
for(const [target,keys] of [[fs,["readFile","readFileSync","open","openSync","copyFile","copyFileSync","cp","cpSync","existsSync","stat","statSync"]],
 [fp,["readFile","open","copyFile","cp","stat"]]])for(const key of keys){const original=target[key];
 target[key]=function(...args){if(denied(args[0])){process.send({type:"wp09-native-call",api:key});throw Object.assign(Error("native sentinel"),{code:"E2E_NATIVE_SENTINEL"});}
 return original.apply(this,args);};}syncBuiltinESMExports();`;
}
export async function assertNoOwnedFile(path: string): Promise<void> {
  try { await lstat(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error("E2E_UNEXPECTED_FILE");
}
