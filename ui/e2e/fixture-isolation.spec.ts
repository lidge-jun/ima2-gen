import { test, expect, assertJ6Isolation, seedBrowser, startApp } from "./fixtures/appServer";
import { runIsolationProbe, PROCESS_SENTINEL, NETWORK_SENTINEL, filesystemSentinel, assertNoOwnedFile } from "./fixtures/isolationProbes";
import { makeAppEnv } from "./fixtures/appIsolation";
import { issueAppHome } from "./fixtures/appOwnership";
import { startStubUpstream } from "./fixtures/stubUpstream";
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";
import { createServer } from "node:http";
import type { Page, TestInfo } from "@playwright/test";
import { getVerifiedRuntimeBuild, selectRuntimeSourcePaths } from "./fixtures/appRuntimeBuild";
import { verifyUiBuildReceipt } from "../../scripts/lib/uiBuildReceipt.mjs";

test.beforeAll(async ({}, info) => {
  const isolation = assertJ6Isolation();
  await proof(info, "preflight", { isolation });
});
async function proof(info: TestInfo, name: string, value: unknown) {
  await writeFile(info.outputPath("wp09-isolation-" + name + ".json"), JSON.stringify({
    sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    runId: process.env.GITHUB_RUN_ID, value,
  }, null, 2));
}

test("I1 child environment never inherits credentials, loaders or provider defaults", async ({}, info) => {
  for (const mode of ["minimax", "minimax-billing", "oauth-expired"] as const) {
    const env = makeAppEnv({ PATH: "/synthetic/bin", HOME: "/do-not-read", CODEX_HOME: "/do-not-read",
      NODE_OPTIONS: "sentinel", HTTPS_PROXY: "sentinel", OPENAI_API_KEY: "sentinel" },
    { home: "/synthetic/home", stubUrl: "http://127.0.0.1:41234/v1", mode, withoutMinimaxKey: true });
    for (const name of ["HOME", "CODEX_HOME", "NODE_OPTIONS", "HTTPS_PROXY", "OPENAI_API_KEY", "MINIMAX_API_KEY"]) expect(env[name]).toBeUndefined();
    expect(env.IMA2_OAUTH_PROXY_PORT).toBe("41234"); expect(env.IMA2_GROK_PROXY_PORT).toBe("41234");
    expect(env.IMA2_MCP_PROVIDERS).toBe(","); expect(env.IMA2_HOST).toBe("127.0.0.1");
  }
  for (const url of ["https://127.0.0.1:41234", "http://localhost:41234", "http://127.0.0.1:3333", "http://u:p@127.0.0.1:41234"]) {
    expect(() => makeAppEnv({}, { home: "/synthetic/home", stubUrl: url, mode: "minimax", withoutMinimaxKey: true })).toThrow();
  }
  await proof(info, "environment", { modes: 3, rejectedOrigins: 4, unsafeKeysAbsent: true });
});

test("I2 actual preloader denies native transport before independent sentinels", async ({}, info) => {
  const result = await runIsolationProbe(`
    const net=await import("node:net"),dns=await import("node:dns"),tls=await import("node:tls");
    const http2=await import("node:http2"),dgram=await import("node:dgram");const codes=[];
    for(const call of [()=>net.connect({host:"example.invalid",port:443}),()=>net.connect({host:"127.0.0.1",port:3333}),
      ()=>net.connect({path:"/unowned-socket"}),()=>dns.lookup("example.invalid",()=>{}),
      ()=>new dns.Resolver().resolve4("example.invalid",()=>{}),()=>tls.connect({host:"example.invalid",port:443}),
      ()=>http2.connect("https://example.invalid"),()=>dgram.createSocket("udp4"),()=>new WebSocket("ws://example.invalid")]) {
      try{call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }
    const response=await fetch(process.env.IMA2_E2E_ALLOWED_ORIGIN+"/v1/models");await response.json();
    return {codes,allowedStatus:response.status};
  `, { beforeGuard: NETWORK_SENTINEL });
  expect(result.nativeCalls).toEqual([]);
  expect(result.result).toEqual({ codes: Array(9).fill("E2E_EGRESS_DENIED"), allowedStatus: 200 });
  expect(() => result.guard.assertClean()).toThrow();
  await proof(info, "network", { result: result.result, denied: result.guard.deniedConnections, nativeCalls: result.nativeCalls, exited: result.exited });
});

test("I3 direct, named, custom-promisified and Worker process calls never reach native executors", async ({}, info) => {
  const result = await runIsolationProbe(`
    const cp=await import("node:child_process"),wt=await import("node:worker_threads"),{promisify}=await import("node:util");
    const codes=[];for(const key of ["spawn","exec","execFile","fork","spawnSync","execSync","execFileSync"]){
      try{cp[key]("unowned",[]);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }
    for(const key of ["exec","execFile"]){try{await promisify(cp[key])("unowned",[]);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}}
    for(const call of [()=>new wt.Worker("unowned"),()=>cp.ChildProcess.prototype.spawn({file:"unowned",args:[]})]){
      try{call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }return {codes};
  `, { beforeGuard: PROCESS_SENTINEL });
  expect(result.nativeCalls).toEqual([]);
  expect(result.result).toEqual({ codes: Array(11).fill("E2E_PROCESS_DENIED") });
  expect(() => result.guard.assertClean()).toThrow();
  await proof(info, "process", { result: result.result, denied: result.guard.deniedProcesses, nativeCalls: result.nativeCalls, exited: result.exited });
});

test("I2 numeric loopback listener setup requires no native name resolution", async ({}, info) => {
  const result = await runIsolationProbe(`
    const {createServer}=await import("node:http");const server=createServer();let code="",nativeFrames=[];
    try {await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});}
    catch(error){code=error.code;nativeFrames=String(error.stack).split("\\n").filter(line=>line.includes("node:net:")).map(line=>line.trim());}
    const bound=server.listening;
    if(bound)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    return {bound,code,nativeFrames};
  `, { beforeGuard: NETWORK_SENTINEL });
  await proof(info, "numeric-bind", { result: result.result, denied: result.guard.deniedConnections });
  expect(result.result).toMatchObject({ bound: true, code: "" }); expect(result.nativeCalls).toEqual([]); result.guard.assertClean();
});

test("I9 platform discovery refuses native content and does not hide write attempts", async ({}, info) => {
  const result = await runIsolationProbe(`
    const fs=await import("node:fs"),fp=await import("node:fs/promises");const codes=[];
    for(const path of ["/proc/self/exe","/usr/bin/ldd"]) {
      for(const call of [()=>fs.openSync(path,"r"),()=>fs.readFileSync(path)]) {
        try{call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      }
      try{await fp.readFile(path);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      try{fs.openSync(path,"r+");codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }
    return {codes};
  `, { beforeGuard: filesystemSentinel(["/proc/self/exe", "/usr/bin/ldd"]) });
  expect(result.result).toEqual({ codes: Array(8).fill("E2E_FILESYSTEM_DENIED") });
  expect(result.nativeCalls).toEqual([]); expect(result.guard.expectedPlatformProbes).toHaveLength(6);
  expect(result.guard.deniedFilesystem).toHaveLength(2); expect(() => result.guard.assertClean()).toThrow();
  await proof(info, "platform-discovery", { result: result.result, nativeCalls: result.nativeCalls,
    expected: result.guard.expectedPlatformProbes, unexpectedWrites: result.guard.deniedFilesystem });
});

test("LAN fixture bind remains loopback and grants no wildcard egress", async ({}, info) => {
  const result = await runIsolationProbe(`
    const {createServer}=await import("node:http"),net=await import("node:net");
    const server=createServer();
    await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"0.0.0.0",resolve);});
    const address=server.address().address;
    await new Promise(resolve=>server.close(resolve));
    let code="";try{net.connect({host:"0.0.0.0",port:Number(process.env.IMA2_OAUTH_PROXY_PORT)});}catch(error){code=error.code;}
    return {address,code};
  `, { beforeGuard: `process.env.IMA2_E2E_LAN_BIND="1";process.env.IMA2_HOST="0.0.0.0";\n${NETWORK_SENTINEL}` });
  expect(result.result).toEqual({ address: "127.0.0.1", code: "E2E_EGRESS_DENIED" });
  expect(result.nativeCalls).toEqual([]);
  expect(result.guard.deniedConnections).toHaveLength(1);
  await proof(info, "lan-bind", { result: result.result, denied: result.guard.deniedConnections });
});

test("I2 redirects cannot reach an independently owned foreign listener", async ({}, info) => {
  let requests = 0;
  const foreign = createServer((_request, response) => { requests++; response.end("UNREACHABLE"); });
  try {
    await new Promise<void>((resolve, reject) => {
      foreign.once("error", reject);
      foreign.listen(0, "127.0.0.1", () => { foreign.off("error", reject); resolve(); });
    });
    const address = foreign.address();
    if (!address || typeof address === "string") throw new Error("E2E_LISTENER_ADDRESS");
    const target = `http://127.0.0.1:${address.port}/redirect-target`;
    const result = await runIsolationProbe(`
      let code="NOT_BLOCKED";
      try { const response=await fetch(process.env.IMA2_E2E_ALLOWED_ORIGIN+"/v1/image_generation",
        {method:"POST",body:JSON.stringify({prompt:"redirect-probe"})}); await response.text(); }
      catch(error) { code=error.cause?.code ?? error.code; }
      return {code};
    `, { beforeGuard: NETWORK_SENTINEL, setup: async ({ stub }) => { stub.redirectNextGeneration(target); } });
    expect(result.result).toEqual({ code: "E2E_EGRESS_DENIED" });
    expect(result.stubCalls).toEqual(["POST /v1/image_generation"]);
    expect(result.nativeCalls).toEqual([]); expect(requests).toBe(0);
    expect(() => result.guard.assertClean()).toThrow();
    await proof(info, "redirect", { result: result.result, stubCalls: result.stubCalls,
      foreignRequests: requests, nativeCalls: result.nativeCalls, denied: result.guard.deniedConnections });
  } finally {
    foreign.closeAllConnections();
    if (foreign.listening) await new Promise<void>((resolve, reject) => foreign.close((error) => error ? reject(error) : resolve()));
  }
});

test("I4 actual installed seed runs once per page and origin without a browser", async ({}, info) => {
  const installed: Array<{ fn: Function; arg: string }> = [];
  const context = { serviceWorkers: () => [], route: async () => {}, routeWebSocket: async () => {}, on: () => {} };
  // A narrow page/context test double; no Playwright browser fixture is requested.
  const page = { context: () => context, addInitScript: async (fn: Function, arg: string) => { installed.push({ fn, arg }); } } as unknown as Page;
  const options = { provider: "nai" as const, imageModel: "nai-diffusion-5-full", generationDefaults: { prompt: "initial" } };
  await seedBrowser(page, options); await seedBrowser(page, options); expect(installed).toHaveLength(1);
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value) });
  const frame = { location: { protocol: "http:" }, localStorage: storage(local), sessionStorage: storage(session), payload: installed[0]!.arg };
  const script = "(" + installed[0]!.fn.toString() + ")(payload)";
  runInNewContext(script, frame); expect(JSON.parse(local.get("ima2.generationDefaults")!).prompt).toBe("initial");
  local.set("ima2.generationDefaults", JSON.stringify({ provider: "nai", prompt: "edited" }));
  runInNewContext(script, frame); expect(JSON.parse(local.get("ima2.generationDefaults")!).prompt).toBe("edited");
  await expect(seedBrowser(page, { ...options, imageModel: "different" })).rejects.toThrow("E2E_CONFLICTING_SEED");
  await proof(info, "seed", { installations: installed.length, retainedDraft: true });
});

test("I5 held upstream records before response and snapshots mode at arrival", async ({}, info) => {
  const stub = await startStubUpstream("minimax-billing"), held = stub.holdNextGeneration();
  try {
    const request = fetch(stub.url + "/image_generation", { method: "POST", body: JSON.stringify({ prompt: "held-first" }) });
    await held.submitted; expect(stub.generationRequests).toHaveLength(1);
    expect(stub.generationReplies).toBe(0);
    expect(() => stub.holdNextGeneration()).toThrow(); stub.setMode("minimax");
    held.release(); held.release();
    expect((await (await request).json()).base_resp.status_code).toBe(1008);
    expect(stub.generationReplies).toBe(1);
    const next = await fetch(stub.url + "/image_generation", { method: "POST", body: JSON.stringify({ prompt: "second" }) });
    expect((await next.json()).base_resp.status_code).toBe(0);
    expect(stub.generationRequests.map((row) => row.body)).toEqual([{ prompt: "held-first" }, { prompt: "second" }]);
    await proof(info, "hold", { requests: stub.generationRequests.length, distinctModes: true });
  } finally { await stub.close(); }
});

test("I5 early release and close-before-arrival settle their own holds", async ({}, info) => {
  const stub = await startStubUpstream(), early = stub.holdNextGeneration();
  try {
    early.release(); early.release();
    const response = await fetch(stub.url + "/image_generation", { method: "POST", body: "{}" });
    await early.submitted;
    expect((await response.json()).base_resp.status_code).toBe(0);
    expect(stub.generationReplies).toBe(1);
    const absent = stub.holdNextGeneration();
    const rejected = expect(absent.submitted).rejects.toThrow("E2E fixture closed");
    await stub.close(); await rejected; absent.release(); absent.release();
    expect(stub.generationReplies).toBe(1);
    expect(() => stub.holdNextGeneration()).toThrow();
    await proof(info, "hold-early-close", { requests: stub.generationRequests.length, replies: stub.generationReplies });
  } finally { await stub.close(); }
});

test("I5 aborting a submitted request then closing never writes a held response", async ({}, info) => {
  const stub = await startStubUpstream(), held = stub.holdNextGeneration(), controller = new AbortController();
  let responseArrived = false;
  const pending = fetch(stub.url + "/image_generation", {
    method: "POST", body: JSON.stringify({ prompt: "abort-owned" }), signal: controller.signal,
  }).then(async (response) => { responseArrived = true; await response.arrayBuffer(); return "unexpected"; }, () => "aborted");
  try {
    await held.submitted;
    expect(stub.generationRequests).toHaveLength(1); expect(stub.generationReplies).toBe(0);
    controller.abort(); expect(await pending).toBe("aborted");
    await stub.close(); held.release(); held.release();
    expect(responseArrived).toBe(false); expect(stub.generationReplies).toBe(0);
    await proof(info, "hold-abort", { requests: stub.generationRequests.length, replies: stub.generationReplies, responseArrived });
  } finally { controller.abort(); await stub.close(); await pending; }
});

for (const config of ["valid", "missing", "malformed"] as const) test("I6 guarded startup rejects runtime poison with " + config + " primary config", async ({}, info) => {
  const home = await issueAppHome();
  if (config !== "missing") await writeFile(join(home, "config.json"), config === "valid" ? "{}" : "{invalid");
  const app = await startApp("minimax", { home, withoutMinimaxKey: true, prepareRuntime: async ({ runtimeRoot }) => {
    await mkdir(join(runtimeRoot, ".ima2"));
    await writeFile(join(runtimeRoot, ".ima2/config.json"), JSON.stringify({ apiKey: "WP09-POISON-NEVER-READ" }));
  } });
  try {
    expect(app.guard.ready).toBe(true);
    const keys = await fetch(app.baseUrl + "/api/keys/status"); expect(keys.status).toBe(200);
    expect(await keys.text()).not.toContain("WP09-POISON");
    const providers = await (await fetch(app.baseUrl + "/api/mcp/providers")).json();
    expect(providers.providers.every((row: { enabled: boolean }) => row.enabled === false)).toBe(true);
    app.guard.assertClean(); expect(app.guard.expectedLegacyProbes).toBeGreaterThan(0);
    await proof(info, "config-" + config, { guardReady: app.guard.ready, expectedMetadata: app.guard.expectedLegacyProbes,
      expectedPlatformProbes: app.guard.expectedPlatformProbes,
      unexpectedFiles: app.guard.deniedFilesystem, unexpectedProcesses: app.guard.deniedProcesses });
  } finally { await app.close(); }
});

test("I7 and I9 actual emitted discovery remains unauthenticated behind native process sentinels", async ({}, info) => {
  const result = await runIsolationProbe(`
    const {config}=await import("./config.js");
    const {detectCodexAuth,codexAuthPaths}=await import("./lib/codexDetect.js");
    const {inspectGrokWeeklyEligibility}=await import("./routes/quota.js");
    const os=await import("node:os");
    const auth=detectCodexAuth(),grok=inspectGrokWeeklyEligibility();
    return {homeOwned:os.homedir()===process.env.IMA2_E2E_HOME&&os.default.homedir()===process.env.IMA2_E2E_HOME,
      mcp:config.mcp.enabledProviders,auth:{authed:auth.authed,proxyReady:auth.proxyReady,probe:auth.probe},
      pathsOwned:Object.values(codexAuthPaths()).every(p=>p.startsWith(process.env.IMA2_E2E_HOME+"/")),
      grok:{eligible:grok.eligible,reason:grok.reason,candidateCount:grok.candidateCount,clientVersion:grok.clientVersion}};
  `, { beforeGuard: PROCESS_SENTINEL });
  expect(result.result).toEqual({ homeOwned: true, mcp: [], auth: { authed: false, proxyReady: false, probe: "error" }, pathsOwned: true,
    grok: { eligible: false, reason: "no-auth", candidateCount: 0, clientVersion: null } });
  expect(result.nativeCalls).toEqual([]); result.guard.assertClean();
  expect(result.guard.expectedDiscoveries.length).toBeGreaterThan(0);
  await proof(info, "discovery", { result: result.result, expected: result.guard.expectedDiscoveries, nativeCalls: result.nativeCalls });
});

test("I6-content runtime config poison cannot be read or copied past loader checks", async ({}, info) => {
  const result = await runIsolationProbe(`
    const fs=await import("node:fs"),fp=await import("node:fs/promises"),{promisify}=await import("node:util");
    const path=process.cwd()+"/.ima2/config.json",home=process.env.IMA2_E2E_HOME,codes=[];
    for(const call of [()=>fs.readFileSync(path),()=>fs.copyFileSync(path,home+"/copy")]) {
      try{call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }
    for(const call of [()=>promisify(fs.readFile)(path),()=>fp.readFile(path),()=>fp.copyFile(path,home+"/copy")]) {
      try{await call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
    }
    return {codes,copied:fs.existsSync(home+"/copy")};
  `, { beforeGuard: filesystemSentinel(["./.ima2"]), setup: async ({ root }) => {
    await mkdir(join(root, ".ima2")); await writeFile(join(root, ".ima2/config.json"), "POISON-NOT-CREDENTIALS");
  } });
  expect(result.result).toEqual({ codes: Array(5).fill("E2E_FILESYSTEM_DENIED"), copied: false });
  expect(result.nativeCalls).toEqual([]); expect(() => result.guard.assertClean()).toThrow();
  await proof(info, "config-content", { result: result.result, nativeCalls: result.nativeCalls, denied: result.guard.deniedFilesystem });
});

test("I8 actual filesystem guards deny outside content and nested copy links before native sentinels", async ({}, info) => {
  const outside = await mkdtemp(join(tmpdir(), "wp09-outside-"));
  await writeFile(join(outside, "sentinel.txt"), "OUTSIDE-POISON");
  try {
    const body = `
      const fs=await import("node:fs"),fp=await import("node:fs/promises"),{pathToFileURL}=await import("node:url");
      const outside=${JSON.stringify(join(outside, "sentinel.txt"))},home=process.env.IMA2_E2E_HOME,codes=[];
      for(const value of [outside,Buffer.from(outside),pathToFileURL(outside),home+"/link"]){
        try{fs.readFileSync(value);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      }
      try{await fp.readFile(outside);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      try{await fp.cp(home+"/tree",home+"/copied",{recursive:true});codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      const handle=await fp.open(home+"/safe.txt","r");try{await handle.writeFile("bad");codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      const own=await handle.readFile({encoding:"utf8"});await handle.close();
      return {codes,own,copied:fs.existsSync(home+"/copied")};
    `;
    const result = await runIsolationProbe(body, { beforeGuard: filesystemSentinel([outside]), setup: async ({ home }) => {
      await writeFile(join(home, "safe.txt"), "SAFE");
      await symlink(join(outside, "sentinel.txt"), join(home, "link"));
      await mkdir(join(home, "tree")); await symlink(join(outside, "sentinel.txt"), join(home, "tree/link"));
    } });
    expect(result.result).toEqual({ codes: Array(7).fill("E2E_FILESYSTEM_DENIED"), own: "SAFE", copied: false });
    expect(result.nativeCalls).toEqual([]); expect(() => result.guard.assertClean()).toThrow();
    expect(await readFile(join(outside, "sentinel.txt"), "utf8")).toBe("OUTSIDE-POISON");
    await proof(info, "filesystem", { result: result.result, nativeCalls: result.nativeCalls, denials: result.guard.deniedFilesystem });
  } finally { await rm(outside, { recursive: true, force: false }); }
});

test("I9 normal emitted server and model discovery have no unexpected execution", async ({}, info) => {
  let runtimeRoot = "";
  const app = await startApp("minimax", { withoutMinimaxKey: true,
    prepareRuntime: async (paths) => { runtimeRoot = paths.runtimeRoot; } });
  try {
    const response = await fetch(app.baseUrl + "/api/models"); expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    app.guard.assertClean();
    expect(app.guard.expectedDiscoveries.some((row) => row.discovery === "agy-version")).toBe(true);
    await proof(info, "normal-start", { guardReady: app.guard.ready, expected: app.guard.expectedDiscoveries,
      expectedLegacyProbes: app.guard.expectedLegacyProbes, expectedPlatformProbes: app.guard.expectedPlatformProbes, denials: app.guard.deniedConnections });
  } finally {
    await app.close(); expect(runtimeRoot).not.toBe(""); await assertNoOwnedFile(runtimeRoot);
    await proof(info, "normal-close", { projectionRemoved: true, sameHomePreserved: (await lstat(app.home)).isDirectory() });
  }
});

test("I8 flags, callbacks, native realpath and descriptor reuse retain the same boundary", async ({}, info) => {
  const outside = await mkdtemp(join(tmpdir(), "wp09-fs-overloads-"));
  const poison = join(outside, "sentinel.txt");
  await writeFile(poison, "UNCHANGED");
  try {
    const result = await runIsolationProbe(`
      const fs=await import("node:fs"),fp=await import("node:fs/promises"),{promisify}=await import("node:util");
      const home=process.env.IMA2_E2E_HOME,outside=${JSON.stringify(poison)},codes=[];
      for(const call of [()=>fs.readFileSync(Buffer.from([255])),()=>fs.readFileSync(home+"-sibling/file"),
        ()=>fs.realpathSync.native(outside),()=>fs.readFileSync("./package.json",{flag:"r+"}),
        ()=>fs.readFileSync("./package.json",{flag:fs.constants.O_RDONLY|fs.constants.O_TRUNC}),
        ()=>fs.openSync("./package.json","a"),()=>fs.createReadStream("./package.json",{flags:"r+"}),
        ()=>fs.readFileSync(938271),()=>fs.createReadStream(home+"/safe",{fd:938271})]) {
        try{call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      }
      for(const call of [()=>promisify(fs.readFile)(outside),()=>fp.readFile(outside),
        ()=>promisify(fs.realpath.native)(outside)]) {
        try{await call();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      }
      const fd=fs.openSync(home+"/safe","r"),buffer=Buffer.alloc(4);
      const count=fs.readSync(fd,buffer,0,4,0);fs.closeSync(fd);
      try{fs.readSync(fd,buffer,0,4,0);codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      const handle=await fp.open(home+"/safe","r");await handle.close();
      const next=await fp.open(home+"/safe","r");
      try{await handle.readFile();codes.push("NOT_BLOCKED");}catch(error){codes.push(error.code);}
      const nextText=await next.readFile("utf8");await next.close();
      const writable=fs.openSync(home+"/written","w+");fs.writeSync(writable,"OWNED");fs.closeSync(writable);
      return {codes,count,text:buffer.toString(),nextText,written:fs.readFileSync(home+"/written","utf8")};
    `, { beforeGuard: filesystemSentinel([outside]), setup: async ({ home }) => { await writeFile(join(home, "safe"), "SAFE"); } });
    expect(result.result).toEqual({ codes: Array(14).fill("E2E_FILESYSTEM_DENIED"), count: 4, text: "SAFE", nextText: "SAFE", written: "OWNED" });
    expect(result.nativeCalls).toEqual([]); expect(await readFile(poison, "utf8")).toBe("UNCHANGED");
    expect(() => result.guard.assertClean()).toThrow();
    await proof(info, "filesystem-overloads", { result: result.result, nativeCalls: result.nativeCalls, denied: result.guard.deniedFilesystem });
  } finally { await rm(outside, { recursive: true, force: false }); }
});

test("I9 missing emitted entry fails before child launch and preserves owned cleanup", async () => {
  let runtimeRoot = "";
  await expect(startApp("minimax", { prepareRuntime: async (paths) => {
    runtimeRoot = paths.runtimeRoot; await rm(join(runtimeRoot, "server.js"));
  } })).rejects.toThrow();
  expect(runtimeRoot).not.toBe(""); await assertNoOwnedFile(runtimeRoot);
});

test("I6-source positive inventory excludes poison without reading it", async ({}, info) => {
  const tracked = execFileSync("git", ["ls-files", "-z", "--cached"], { encoding: "utf8", cwd: join(process.cwd(), "..") }).split("\0").filter(Boolean);
  const selected = selectRuntimeSourcePaths([...tracked, ".env", ".ima2/config.json", "generated/poison.ts"]);
  for (const path of [".env", ".ima2/config.json", "generated/poison.ts"]) expect(selected).not.toContain(path);
  expect(() => selectRuntimeSourcePaths([...tracked, "lib/.codex/poison.ts"])).toThrow("E2E_SOURCE_FORBIDDEN");
  await proof(info, "source-inventory", { selected: selected.length, rejectedPoison: true });
});

test("I6-source contaminated checkout refuses before startup, without weakening hosted preflight", async ({}, info) => {
  const sentinel = join(process.cwd(), "..", ".env.wp09-owned-sentinel");
  await writeFile(sentinel, "WP09_HARMLESS_SENTINEL=1\n", { flag: "wx" });
  const identity = await lstat(sentinel);
  try { await expect(startApp()).rejects.toThrow("dotenv override"); }
  finally {
    const current = await lstat(sentinel);
    expect(current.ino).toBe(identity.ino); expect(current.dev).toBe(identity.dev);
    await unlink(sentinel);
  }
  expect(assertJ6Isolation().dotenvAbsent).toBe(true);
  await proof(info, "preflight-poison", { rejected: true, ownedSentinelRemoved: true });
});

test("I7 real migration leaves an outside synthetic source untouched", async ({}, info) => {
  const outside = await mkdtemp(join(tmpdir(), "wp09-migration-outside-"));
  await writeFile(join(outside, "poison.png"), "NOT-A-USER-IMAGE");
  try {
    const result = await runIsolationProbe(`
      const {migrateGeneratedStorage,getLegacyGeneratedCandidates}=await import("./lib/storageMigration.js");
      const fs=await import("node:fs"),home=process.env.IMA2_E2E_HOME;
      const candidates=await getLegacyGeneratedCandidates({rootDir:process.cwd()});
      const migrated=await migrateGeneratedStorage({config:{storage:{generatedDir:home+"/migrated"}}},{legacyDirs:[${JSON.stringify(outside)}]});
      return {copied:migrated.copied,hasGlobal:candidates.includes("/usr/local/lib/node_modules/ima2-gen/generated"),
        copiedFile:fs.existsSync(home+"/migrated/poison.png")};
    `, { beforeGuard: filesystemSentinel([outside]) });
    expect(result.result).toEqual({ copied: 0, hasGlobal: true, copiedFile: false });
    expect(result.nativeCalls).toEqual([]); expect(() => result.guard.assertClean()).toThrow();
    expect(result.guard.expectedLegacyProbes).toBeGreaterThan(0);
    expect(await readFile(join(outside, "poison.png"), "utf8")).toBe("NOT-A-USER-IMAGE");
    await proof(info, "migration", { result: result.result, nativeCalls: result.nativeCalls,
      metadata: result.guard.expectedLegacyProbes, denied: result.guard.deniedFilesystem });
  } finally { await rm(outside, { recursive: true, force: false }); }
});

test("I9 worker cache reuse is verified and byte tamper prevents a new launch", async ({}, info) => {
  const root = join(process.cwd(), "..");
  const first = await getVerifiedRuntimeBuild(root), again = await getVerifiedRuntimeBuild(root);
  expect(again.root).toBe(first.root); expect(again.sourceDigest).toBe(first.sourceDigest);
  const entry = join(first.root, "server.js"), original = await readFile(entry);
  let prepared = false;
  try {
    await writeFile(entry, Buffer.alloc(original.length, 32));
    await expect(startApp("minimax", { prepareRuntime: async () => { prepared = true; } })).rejects.toThrow("E2E_CACHE_TAMPER");
    expect(prepared).toBe(false);
  } finally { await writeFile(entry, original); }
  expect((await getVerifiedRuntimeBuild(root)).sourceDigest).toBe(first.sourceDigest);
  await proof(info, "cache", { sameWorkerCache: true, tamperRejectedBeforePrepare: true, restored: true });
});

test("UIR strict Tailwind build ignores unlisted candidates and Git ignore changes but includes selected sources", async ({}, info) => {
  // Three real compiler transactions; no app/browser fixture is requested here.
  // Each wrapper has three intrinsic 120s compiler limits; the outer budget
  // leaves the wrapper time to reap its compiler and release its transaction.
  test.setTimeout(1140000);
  const root = join(process.cwd(), ".."), ignore = join(root, ".gitignore");
  const originalIgnore = await readFile(ignore), ignoreIdentity = await lstat(ignore);
  const outside = join(root, "wp09-unlisted-tailwind.html"), selected = join(root, "ui/src/wp09-owned-tailwind.ts");
  const owned = new Map<string, { ino: number; dev: number }>();
  const create = async (path: string, text: string) => {
    await writeFile(path, text, { flag: "wx" }); const stat = await lstat(path); owned.set(path, { ino: stat.ino, dev: stat.dev });
  };
  const remove = async (path: string) => {
    const identity = owned.get(path); if (!identity) return;
    const stat = await lstat(path); expect(stat.ino).toBe(identity.ino); expect(stat.dev).toBe(identity.dev);
    await unlink(path); owned.delete(path);
  };
  const readReceipt = () => verifyUiBuildReceipt({ repoRoot: root, distDir: join(root, "ui/dist"), requireGitHead: true });
  const build = () => promisify(execFile)(process.execPath, [join(root, "scripts/write-ui-build-receipt.mjs")],
    { cwd: join(root, "ui"), timeout: 365000, maxBuffer: 8 * 1024 * 1024 });
  const initial = (await readReceipt()).receipt;
  let changedIgnore = false;
  try {
    // Do not spell the complete canary class in this selected E2E source: the
    // strict scanner intentionally scans it too, which would taint the oracle.
    await create(outside, '<div class="' + ["z-", "[", "991233", "]"].join("") + '"></div>');
    await writeFile(ignore, Buffer.concat([originalIgnore, Buffer.from("\n/ui/src/**\n/wp09-unlisted-tailwind.html\n")])); changedIgnore = true;
    await build();
    const unchanged = (await readReceipt()).receipt;
    expect(unchanged.sourceInputDigest).toBe(initial.sourceInputDigest); expect(unchanged.outputs).toEqual(initial.outputs);
    await create(selected, 'export const canary = "' + ["z-", "[", "991234", "]"].join("") + '";\n');
    await build();
    const changed = (await readReceipt()).receipt;
    expect(changed.sourceInputDigest).not.toBe(initial.sourceInputDigest);
    const cssFiles = changed.outputs.filter((file) => file.path.endsWith(".css")); expect(cssFiles.length).toBeGreaterThan(0);
    const css = (await Promise.all(cssFiles.map((file) => readFile(join(root, "ui/dist", file.path), "utf8")))).join("\n");
    expect(css).toMatch(/z-index:\s*991234/); expect(css).not.toMatch(/z-index:\s*991233/);
    await proof(info, "tailwind-candidates", { initial: initial.sourceInputDigest, changed: changed.sourceInputDigest,
      ignoredCandidatesExcluded: true, selectedCandidateIncluded: true, outputCount: changed.outputs.length });
  } finally {
    await remove(selected); await remove(outside);
    if (changedIgnore) {
      const current = await lstat(ignore); expect(current.ino).toBe(ignoreIdentity.ino); expect(current.dev).toBe(ignoreIdentity.dev);
      await writeFile(ignore, originalIgnore);
    }
    await build();
    const restored = (await readReceipt()).receipt;
    expect(restored.sourceInputDigest).toBe(initial.sourceInputDigest); expect(restored.outputs).toEqual(initial.outputs);
  }
});
