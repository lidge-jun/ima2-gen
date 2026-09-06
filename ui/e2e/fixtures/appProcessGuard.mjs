import childProcess from "node:child_process";
import workerThreads from "node:worker_threads";
import { join } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { safeDenial } from "./appPolicy.mjs";

export function createProcessClassifier(policy, bundledScripts = []) {
  const agy = process.platform === "win32" ? "agy.cmd" : "agy";
  const agyPaths = new Set([agy, join(policy.home, ".local/bin", agy), join(policy.home, ".npm-global/bin", agy)]);
  const codexNames = process.platform === "win32" ? ["codex", "codex.cmd", "codex.exe"] : ["codex"];
  return (api, args) => {
    const executable = args[0], argv = args[1];
    if (typeof executable !== "string" || !Array.isArray(argv)) return null;
    if (api === "spawn" && agyPaths.has(executable) && argv.length === 1 && argv[0] === "--version") return "agy-version";
    if (api === "execFileSync" && executable === "grok" && argv.length === 1 && argv[0] === "version") return "grok-version";
    if (api === "execFileSync") {
      if (codexNames.includes(executable) && argv.length === 2 && argv[0] === "login" && argv[1] === "status") return "codex-login-status";
      if (executable === process.execPath && argv.length === 3 && bundledScripts.includes(argv[0])
        && argv[1] === "login" && argv[2] === "status") return "codex-login-status";
    }
    return null;
  };
}
export function installProcessGuard(report, classify = () => null) {
  const restores = [];
  const patch = (target, key, api) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor || typeof descriptor.value !== "function") throw safeDenial("E2E_PROCESS_GUARD_UNSUPPORTED");
    Object.defineProperty(target, key, { ...descriptor, value: function (...args) {
      report({ type: "ima2-e2e-process-denied", api, discovery: classify(api, args) });
      throw safeDenial("E2E_PROCESS_DENIED", "fixture subprocess denied");
    } });
    restores.push(() => Object.defineProperty(target, key, descriptor));
  };
  try {
    for (const api of ["spawn", "exec", "execFile", "fork", "spawnSync", "execSync", "execFileSync"]) patch(childProcess, api, api);
    patch(childProcess.ChildProcess.prototype, "spawn", "ChildProcess.spawn");
    patch(workerThreads, "Worker", "Worker");
    syncBuiltinESMExports();
  } catch (error) { for (const undo of restores.reverse()) undo(); syncBuiltinESMExports(); throw error; }
  let restored = false;
  return () => { if (!restored) { restored = true; for (const undo of restores.reverse()) undo(); syncBuiltinESMExports(); } };
}
